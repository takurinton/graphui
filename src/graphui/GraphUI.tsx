import React, { useCallback, useState } from "react";
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
  currentQueryField,
  duplicateArgCounts,
  map = {},
}: {
  currentQueryField: GraphQLField<any, any, any>
  duplicateArgCounts: any;
  map: { [key: string]: any }
}) => currentQueryField.args.reduce((obj, argument) => {
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
  // graphqlSchema も引数かな
  const graphqlSchema = buildSchema(schema);

  // {me: {…}, user: {…}, allUsers: {…}}
  // 現在の node の AST を取得
  const currentQueryField = graphqlSchema.toConfig().query?.getFields()[currentQueryName] as GraphQLField<any, any, any>;
  const currentQueryTypeName = currentQueryField.type.toString().replace(/[[\]!]/g, '');
  const currentQueryType = graphqlSchema.getType(currentQueryTypeName) as GraphQLNamedType;
  let queryString = '';
  let childQuery = '';

  // GraphQLInputObjectType には getFields() 関数がいるので呼べるけど、エラーになるので一旦退避
  // @ts-ignore
  const fields = currentQueryType.getFields()
  if (fields) {
    // ここに関してはもう少し考慮することがある
    // 例えばネストしてる場合、これは再帰的に generateQuery 関数を呼ぶ必要がある
    childQuery = Object.keys(fields)
      .map(field => {
        return `${'  '.repeat(currentDepth + 1)}${field}`;
      }).join('\n');
  }

  if (!('query' in currentQueryType?.toConfig() && !childQuery)) {
    queryString = `${' '.repeat(currentDepth)}${currentQueryField.name}`;
    if (currentQueryField.args.length > 0) {
      const map = getFieldArgsDict({
        currentQueryField,
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
      queryString += ` {\n${childQuery}\n${' '.repeat(currentDepth)}}`;
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
  const graphqlSchema = buildSchema(schema);
  const currentQueryField = graphqlSchema.toConfig().query?.getFields()[name] as GraphQLField<any, any, any>;
  const currentQueryTypeName = currentQueryField.type.toString().replace(/[[\]!]/g, '');
  const currentQueryType = graphqlSchema.getType(currentQueryTypeName) as GraphQLNamedType;

  // @ts-ignore
  return Object.keys(currentQueryType.getFields()).map(t => ({ value: t, label: t }));
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
    if (node.selectionSet === undefined) {
      if (node.arguments === []) {
        return (
          <Box d="inline">
            <RootRenderer node={node.name} />
            {node.alias && (
              <>
                <RootRenderer node={node.alias} />
                {`: `}
              </>
            )}
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
      return <RootRenderer node={node.name} />
    }
    return (
      <Box d="inline">
        <RootRenderer node={node.name} />
        {' {'}
        <RootRenderer node={node.selectionSet} />
        {'}'}
      </Box>
    )
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
        name="fields"
        options={fields}
        className="basic-multi-select"
        classNamePrefix="select"
        onChange={handleChangeFields}
      />
    </Box>
  )
}

const SelectQuery = ({
  selectedQuery,
  queries,
  onChange,
}: {
  selectedQuery: { label: string; value: string };
  queries: string[];
  onChange: (newValue: any) => void;
}) => {
  const api = useTransformerContext();

  const queriesForSelect = queries.map(query => ({ label: query, value: query }))
  const handleChangeFields = useCallback((newValue) => {
    api.updateNode(newValue);
    onChange(newValue)
  }, [selectedQuery]);

  return (
    <Box>
      <Select
        defaultValue={selectedQuery}
        name="fields"
        options={queriesForSelect}
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
  const queries = Object.keys(querysMap);
  const initialQueryName = queries[0];

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

  const handleChangeQueryName = useCallback(({ label, value }) => {
    const newQuery = `query ${value} {
  ${querysMap[value]}
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
          <SelectQuery
            selectedQuery={{ label: initialQueryName, value: initialQueryName }}
            queries={queries}
            onChange={handleChangeQueryName}
          />
        </Flex>
        {ast === null ? <>loading</> : <RootRenderer node={ast} />}
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
