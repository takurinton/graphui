import { useEffect, useState } from "react";
import { Flex } from '@chakra-ui/react';
import {
    ASTNode,
    buildSchema,
    DocumentNode,
    GraphQLField,
    GraphQLNamedType,
    GraphQLSchema,
    parse,
    print,
} from "graphql";
import { Provider } from './context';


const initialQuery = `
query findUser($userId: ID!) {
    user(id: $userId) {
      ...UserFields
    }
  }
  
  fragment UserFields on User {
    id
    username
  }
`;

const schema = `
type User {
    id: ID!
    username: String!
    email: String!
    role: Role!
}

type Hoge {
    a: Int!
    b: String!
    c: Role
}

type Query {
    me: User!
    user(id: ID!): User
    allUsers: [User]
    hoge: Hoge
}

enum Role {
    USER
    ADMIN
}
`;

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

    const isQueryExists = 'query' in currentQureyType?.toConfig();
    if (isQueryExists) {
        console.log('hoge');
    }

    if (!(isQueryExists && !childQuery)) {
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
            queryString += `{\n${childQuery}\n${'    '.repeat(currentDepth)}}`;
        }
    }
}

export const GraphUI = () => {
    // set current query string
    const [query, setQuery] = useState('')
    // query to astnode
    const [ast, setAst] = useState<DocumentNode>(parse(initialQuery));

    const schemaObj = buildSchema(schema);
    const queryFields = schemaObj.toConfig().query?.getFields() as { [key: string]: GraphQLField<any, any, any> };
    Object.keys(queryFields).map(q => {
        const queryNode = generateGraphQLQuery({ schema, currentQueryName: q });
    })

    useEffect(() => {
        // TODO: query を作成する関数をひとまとめにしてここで query にセットする
        setQuery(initialQuery);
    }, []);

    return (
        <>
            <Provider
                root={ast}
                onChangeNode={ast => {
                    setAst(ast);
                    setQuery(print(ast));
                    console.log(print(ast))
                }}
            >
                <Flex>
                    takurinton
                </Flex>
            </Provider>
        </>
    )
};