import React, { useCallback, useEffect, useState } from "react";
import { chakra } from "@chakra-ui/system";
import {
    Flex,
    Input,
    Box,
    Code
} from '@chakra-ui/react';
import {
    buildSchema,
    DocumentNode,
    GraphQLField,
    GraphQLNamedType,
    print,
    parse,
    ASTNode,
} from "graphql";
import { Provider, useTransformerContext } from './context';
import Select from 'react-select';

// inspired by https://github.com/timqian/gql-generator/blob/20f76a0f37f31f961f8d5599cc115748c89fb614/index.js#L39-L55
const getFieldArgsDict = ({
    curerentQueryField,
    duplicateArgCounts,
    map = {},
}: {
    curerentQueryField: GraphQLField<any, any, any>
    duplicateArgCounts: any;
    map: { [key: string]: any }
}) => curerentQueryField.args.reduce((obj, argument) => {
    if (argument.name in duplicateArgCounts) {
        const index = duplicateArgCounts[argument.name] + 1;
        duplicateArgCounts[argument.name] = index;
        // @ts-ignore
        obj[`${arg.name}${index}`] = argument;
    } else if (map[argument.name]) {
        duplicateArgCounts[argument.name] = 1;
        // @ts-ignore
        obj[`${arg.name}1`] = argument;
    } else {
        // @ts-ignore
        obj[argument.name] = argument;
    }
    return obj;
}, {});

const generateGraphQLQuery = ({
    currentQueryName,
    currentDepth = 1, // インデント
    argumentsDict = {},
    duplicateArgCounts = {},
    schema,
}: {
    currentQueryName: string;
    currentDepth?: number;
    argumentsDict?: any;
    duplicateArgCounts?: any;
    schema: string;
}) => {
    // geaphqlSchema も引数かな
    const geaphqlSchema = buildSchema(schema);

    // {me: {…}, user: {…}, allUsers: {…}}
    // 現在の node の AST を取得
    const curerentQueryField = geaphqlSchema.toConfig().query?.getFields()[currentQueryName] as GraphQLField<any, any, any>;
    const currentQueryTypeName = curerentQueryField.type.toString().replace(/[[\]!]/g, '');
    const currentQureyType = geaphqlSchema.getType(currentQueryTypeName) as GraphQLNamedType;
    let queryString = '';
    let childQuery = '';

    // GraphQLInputObjectType には getFields() 関数がいるので呼べるけど、エラーになるので一旦退避
    // @ts-ignore
    const fields = currentQureyType.getFields()
    if (fields) {
        // ここに関してはもう少し考慮することがある
        // 例えばネストしてる場合、これは再帰的に generateQuery 関数を呼ぶ必要がある
        childQuery = Object.keys(fields)
            .map(field => {
                return `${'    '.repeat(currentDepth + 2)}${field}`;
            }).join('\n');
    }

    if (!('query' in currentQureyType?.toConfig() && !childQuery)) {
        queryString = `${'    '.repeat(currentDepth)}${curerentQueryField.name}`;
        if (curerentQueryField.args.length > 0) {
            const map = getFieldArgsDict({
                curerentQueryField,
                duplicateArgCounts,
                map: argumentsDict,
            });
            Object.assign(argumentsDict, map);
            const variables = Object.entries(map)
                // @ts-ignore
                .map(([varName, argument]) => `${argument.name}: $${varName}`)
                .join(', ');

            queryString += `(${variables})`;
        }

        if (childQuery) {
            queryString += ` {\n${childQuery}\n${'    '.repeat(currentDepth)}}`;
        }
    }
    return queryString;
}

// schema to map(key => query name, value => query)
const getQuerysMap = ({
    schema
}: {
    schema: string;
}) => {
    let res: { [key: string]: string } = {};
    const schemaObj = buildSchema(schema);
    const queryFields = schemaObj.toConfig().query?.getFields() as { [key: string]: GraphQLField<any, any, any> };
    Object.keys(queryFields).map(q => {
        const queryNode = generateGraphQLQuery({ schema, currentQueryName: q });
        res[q] = queryNode;
    })
    return res;
}

const getFieldsForReactSelect = ({
    schema,
    name
}: {
    schema: string;
    name: string;
}) => {
    const geaphqlSchema = buildSchema(schema);
    const curerentQueryField = geaphqlSchema.toConfig().query?.getFields()[name] as GraphQLField<any, any, any>;
    const currentQueryTypeName = curerentQueryField.type.toString().replace(/[[\]!]/g, '');
    const currentQureyType = geaphqlSchema.getType(currentQueryTypeName) as GraphQLNamedType;

    // @ts-ignore
    return Object.keys(currentQureyType.getFields()).map(t => ({ value: t, label: t }));
}

// 以下は query の AST を触る

// query から field を取得する
const getFieldByQuery = (node: ASTNode): ASTNode => {
    if (node.kind === 'Document') {
        return getFieldByQuery(node.definitions[0]);
    }

    if (node.kind === 'OperationDefinition') {
        return getFieldByQuery(node.selectionSet);
    }

    if (node.kind === 'SelectionSet') {
        return getFieldByQuery(node.selections);
    }

    if (node.kind === 'Field') {
        if (node.selectionSet === undefined) {
            return node.name;
        }
        return getFieldByQuery(node.selectionSet);
    }

    return {} as ASTNode;
}

const Indent = ({ children }: { children: React.ReactNode }) => {
    return <Box pl={4}>{children}</Box>;
}

const RootRenderer = ({ node }: { node: ASTNode }) => {
    if (node.kind === 'Document') {
        return (
            <Box>
                {node.definitions.map((def, index) => {
                    return <RootRenderer key={index} node={def} />;
                })}
            </Box>
        );
    }

    if (node.kind === 'OperationDefinition') {
        return (
            <Box border="1px solid white" boxSizing="border-box">
                <RootRenderer node={node.selectionSet} />
            </Box>
        );
    }
    if (node.kind === 'SelectionSet') {
        return (
            <Box>
                <Indent>
                    {node.selections.map((selection, index) => {
                        return (
                            <Box key={index}>
                                <RootRenderer node={selection} />
                            </Box>
                        );
                    })}
                </Indent>
            </Box>
        );
    }

    if (node.kind === 'Field') {
        return (
            <Box d="inline">
                {node.alias && (
                    <>
                        <RootRenderer node={node.alias} />
                        {`: `}
                    </>
                )}
                <RootRenderer node={node.name} />
                {'('}
                {node.arguments && (
                    <Indent>
                        {node.arguments.map((arg, idx) => {
                            return <RootRenderer key={idx} node={arg} />;
                        })}
                    </Indent>
                )}
                {')'}
                {node.directives?.map((t, idx) => {
                    return <RootRenderer key={idx} node={t} />;
                })}
            </Box>
        );
    }
    if (node.kind === 'Argument') {
        return (
            <Box>
                <RootRenderer node={node.name} />
                {': '}
                <RootRenderer node={node.value} />
            </Box>
        );
    }
    // Literal
    if (node.kind === 'Name') {
        return (
            <Box d="inline">
                <Code>{node.value}</Code>
            </Box>
        );
    }

    /** --- Literal --- */
    if (node.kind === 'StringValue') {
        return (
            <Box d="inline">
                <Code>"{node.value}"</Code>
            </Box>
        );
    }
    if (node.kind === 'BooleanValue') {
        return (
            <Box d="inline">
                <Code>{node.value}</Code>
            </Box>
        );
    }

    if (node.kind === 'ListValue') {
        return (
            <Box d="inline">
                {'['}
                {node.values.map((t, idx) => {
                    return (
                        <Box>
                            {`${idx ? ', ' : ''}`}
                            <RootRenderer node={t} />
                        </Box>
                    );
                })}
                {']'}
            </Box>
        );
    }
    return <Box>UnknownNode: {node.kind}</Box>;
}


const SelectBox = ({
    selectedFields,
    fields,
    onChange,
}: {
    selectedFields: { label: string; value: string }[];
    fields: { label: string; value: string }[];
    onChange: (newValue: any) => void;
}) => {
    const api = useTransformerContext();

    const handleChangeFields = useCallback((newValue) => {
        api.updateNode(newValue);
        onChange(newValue)
    }, [selectedFields]);

    return (
        <Box>
            <Select
                defaultValue={selectedFields}
                isMulti
                name="colors"
                options={fields}
                className="basic-multi-select"
                classNamePrefix="select"
                onChange={handleChangeFields}
            />
        </Box>
    )
}

export const GraphUI = ({
    schema
}: {
    schema: string
}) => {
    const querysMap = getQuerysMap({ schema });
    const initialQueryName = Object.keys(querysMap)[0];

    // query name
    const [queryName, setQueryName] = useState(initialQueryName);
    // set current query string
    const [query, setQuery] = useState(`query ${queryName} {
    ${querysMap[initialQueryName]}
}`)
    // query to astnode
    const [ast, setAst] = useState<DocumentNode | any>(parse(query));
    // fields
    const fields = getFieldsForReactSelect({ schema, name: queryName });
    const [selectedFields, setSelectedFields] = useState(fields);

    const handleChangeQueryName = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        const newQuery = `query ${value} {
    ${querysMap[initialQueryName]}
}`;

        setQueryName(value);
        setQuery(newQuery)
        setAst(parse(newQuery));
    }, [queryName, query]);

    return (
        <>
            <Provider
                root={ast}
                onChangeNode={ast => {
                    setAst(ast);
                    setQuery(print(ast));
                }}
            >
                <Flex>
                    <chakra.p fontSize="md">query name: </chakra.p>
                    <Input size="md" placeholder='query name' value={queryName} onChange={(event) => handleChangeQueryName(event)} />
                </Flex>
                <SelectBox
                    selectedFields={selectedFields}
                    fields={fields}
                    onChange={setSelectedFields}
                />
                <Box>
                    {/* {ast === null ? <>loading</> : <RootRenderer node={ast} />} */}
                    <Box pb={3} />
                    <pre>
                        <Code>
                            {query}
                        </Code>
                    </pre>
                </Box>
            </Provider>
        </>
    )
};
