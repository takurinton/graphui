import { useState } from "react";
import { Flex } from '@chakra-ui/react';
import { ASTNode, buildSchema, DocumentNode, GraphQLSchema, ObjectTypeDefinitionNode, parse, print, printIntrospectionSchema, printSchema } from "graphql";
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

type Query {
    me: User!
    user(id: ID!): User
    allUsers: [User]
}

enum Role {
    USER
    ADMIN
}
`;

const getQueryAstNode = (schema: GraphQLSchema) => {
    const queryObj = schema.getQueryType();
    const astNode = queryObj?.astNode;

    return astNode;
}

const buildQuery = (node: any): any => {
    console.log(node);
    if (node.kind === 'ObjectTypeDefinition') {
        return buildQuery(node.fields);
    }

    if (Array.isArray(node)) {
        return node.map(n => buildQuery(n));
    }

    if (node.kind === 'FieldDefinition') {
        return buildQuery(node.name);
    }

    if (node.kind === 'Name') {
        return node.value;
    }

    if (node.kind === undefined) {
        // TODO
    }
}

export const GraphUI = () => {
    // set current query string
    const [query, setQuery] = useState(initialQuery)
    // query to astnode
    const [ast, setAst] = useState<DocumentNode>(parse(initialQuery));
    // wip: schema to query
    const schemaObj = buildSchema(schema);
    const node = getQueryAstNode(schemaObj);
    const q = buildQuery(node);
    console.log(q);

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