import * as tf from '@tensorflow/tfjs';
/**
 * @param [object] opts - options:
 *    {
 *      [int] input - number of inputs in the input layer
 *      [array] hidden - array of numbers representing the number
 *                                        of nodes in each hidden layer
 *      [int] output - number of output nodes
 *    }
 */
class NN {
  constructor(opts){
    this.input = opts.input
    this.hidden = opts.hidden
    this.output = opts.output
    this.model = opts.model || this.createModel()
  }

  createModel(){
    let model = tf.sequential()
    // creates hidden layers and connects them
    for(let i = 0; i < this.hidden.length; i++){
      let layer = tf.layers.dense({
        units: this.hidden[i], // number of nodes
        inputShape: i === 0 ? [this.input] : [this.hidden[i-1]],
        activation: 'sigmoid'
      })
      model.add(layer)
    }
    let output = tf.layers.dense({
      units: this.output,
      activation: 'softmax'
    })
    model.add(output)
    return model
  }

  /**
   *
   * @param {array} vals - array of values to supply the model
   */
  predict(vals){
    return tf.tidy(()=> {
      let inputs = tf.tensor2d([vals])
      let prediction = this.model.predict(inputs)
      let a = prediction.dataSync()
      return a
    })
  }

  copy() {
    return tf.tidy(() => {
      // create model with the same shape
      let modelCopy = this.createModel()
      let weights = this.model.getWeights()
      weights.map((t) => t.clone())
      modelCopy.setWeights(weights)
      return new NN({
        model: modelCopy,
        input: this.input,
        hidden: this.hidden,
        output: this.output
      })
    })
  }

  reproduce(s1, s2) {

  }

  mutate(rate) {
    return tf.tidy(() => {
      let weights = this.model.getWeights()
      let newWeights = weights.map(t => {
        let shape = t.shape
        let weightValues = t.dataSync()
        let mutatedWeights = weightValues.map(v => {
          if (Math.random() < rate) return random(-1, 1)
          else return v
        })
        return tf.tensor(mutatedWeights, shape)
      })
      this.model.setWeights(newWeights)
      return this
    })
  }

  log(){
    console.log(tf.memory())
  }
}

function random(min, max) {
  return Math.random() * (max - min) + min;
}

export default NN