/*
  メモ: 
    - 将来的には切り離すので、ここでは呼ぶだけ
    - react, react-dom, urql, chakra-ui は devDependencies に入れる
*/

import { ChakraProvider } from '@chakra-ui/react';
import { GraphUI } from './graphui/GraphUI';

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

function App() {
  return (
    <ChakraProvider>
      <GraphUI schema={schema} />
    </ChakraProvider>
  )
}

export default App;
