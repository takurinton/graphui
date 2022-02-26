/*
  メモ: 
    - 将来的には切り離すので、ここでは呼ぶだけ
    - react, react-dom, urql, chakra-ui は devDependencies に入れる
*/

import { GraphUI } from './graphui/GraphUI';

function App() {
  return (
    <GraphUI />
  )
}

export default App;
