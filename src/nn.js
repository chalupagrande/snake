import {Architect} from 'synaptic'


class NN {
  constructor(numInputs){
    this.network = new Architect.Perceptron(numInputs, 30, 8, 4);
  }

  /**
   *
   * @param {GAME BOARD} board - takes a game board from snake
   * @returns
   */
  guess(board){
    let inputs = []
    board.forEach(r => inputs = inputs.concat(r))
    return this.network.activate(inputs)
  }

  mutate(){

  }
}


export default NN