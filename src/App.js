import React, { useState } from 'react';
import P5Wrapper from 'react-p5-wrapper'
import snake from './sketches/snake'

function App() {
  let [pause, setPause] = useState(false)
  return (
    <div className="App">
      <h1>SNAKE Neural Net genetic algorithm</h1>
      <button onClick={() => setPause(!pause)}>pause</button>
      <P5Wrapper sketch={snake} pause={pause} />
    </div>
  );
}

export default App;
