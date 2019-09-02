import p5 from 'p5'
import {Architect, Network} from 'synaptic'

function sketch (p) {
  let game,
  generation,
  canvasSize = 400,
  pause = false,
  percentOfFittest = 0.10,
  mutatePercentage = 0.2,
  popSize = 100,
  gameSize = 7,
  gameSpeed = 0,
  scl = canvasSize / gameSize;


  /**
   *   ___ _      _   ___ ___ ___ ___
   *  / __| |    /_\ / __/ __| __/ __|
   * | (__| |__ / _ \\__ \__ \ _|\__ \
   *  \___|____/_/ \_\___/___/___|___/
   *
   */

  class Snake {
    constructor(brain) {
      // let initialPos = p.createVector(p.floor(p.random(gameSize)), p.floor(p.random(gameSize)))
      let initialPos = p.createVector(0,0)
      this.brain = brain || new Architect.Perceptron(gameSize * gameSize, 50, 20, 4);
      this.headPos = initialPos
      this.positions = [initialPos]
      this.heading = p.createVector(1,0)
      this.length = this.positions.length
      this.shouldGrow = false
      this.life = 100
      this.score = 0
      this.fitness = 0
    }

    setHeading(x,y){
      let newHeading = p.createVector(x,y)
      let combined = p5.Vector.add(this.heading, newHeading)
      // cant go backwards
      if(combined.x === 0 && combined.y === 0) return
      this.heading = newHeading
      return this.heading
    }

    move(){
      this.life -= 1
      let next = p5.Vector.add(this.headPos, this.heading)
      this.headPos = next
      if(!this.shouldGrow) this.positions.pop()
      this.shouldGrow = false
      this.positions = [next, ...this.positions]
      return {positions: this.positions, life: this.life, heading: this.heading}
    }

    grow(pos) {
      this.life += 100
      this.shouldGrow = true
    }

    think(board) {
      let inputs = []
      board.forEach(r => inputs = inputs.concat(r))
      let guess = this.brain.activate(inputs)
      let i = guess.indexOf(Math.max(...guess))
      if(i === 0) this.setHeading(0,-1)
      else if(i === 1) this.setHeading(0,1)
      else if(i === 2) this.setHeading(-1,0)
      else this.setHeading(1,0)
    }

    strengthen() {
      this.score += 1
    }
  }

  class Game {
    constructor(w,h){
      this.opts = {w,h}
      this.board = []
      this.baitLocation = null

      // init board
      for(let row = 0; row < w; row++){
        let col = [...Array(h)].map(()=>0)
        this.board.push(col)
      }
      this.newBait()
      this.snake = null
    }

    set(pos, val){
      this.board[pos.x][pos.y] = val
    }

    get(pos){
      return this.board[pos.x][pos.y]
    }

    addSnake(snake){
      this.snake = snake
      snake.positions.forEach(pos => this.set(pos, 0.5))
    }

    look() {
      // look forward
      debugger
      let result = {}
      for(let xDir = -1; xDir <= 1; xDir++) {
        for(let yDir = -1; yDir <= 1; yDir++) {
          // init result variables
          result[`${xDir},${yDir}-Value`] = -1
          result[`${xDir},${yDir}-Distance`] = 0
          let dir = p.createVector(xDir, yDir)
          let last = this.snake.headPos
          let canSee = true
          while (canSee){
            let scanner = p5.Vector.add(dir, last)
            // out of bounds
            if(scanner.x >= this.opts.w || scanner.x < 0 || scanner.y >= this.opts.h || scanner.y < 0) {
              canSee = false
              break;
            } else {
              let val = this.get(scanner)
              result[`${xDir},${yDir}-Value`] = val
              result[`${xDir},${yDir}-Distance`] += 1
              last = scanner
              if(val === 1 || val === -1){
                canSee = false
                break;
              }
            }
          }
        }
      }
      debugger
      return result
    }

    newBait(){
      if(this.baitLocation) this.set(this.baitLocation, 0.5)
      let curVal = -1, pos;
      while(curVal === -1 || curVal === 1 || curVal === 0.5){
        let x = p.floor(p.random(this.opts.w))
        let y = p.floor(p.random(this.opts.h))
        pos = p.createVector(x,y)
        curVal = this.get(pos)
      }
      this.baitLocation = pos
      this.set(pos, 1)
    }

    step(){
      let prevSnakePos = [...this.snake.positions]
      let {positions, life} = this.snake.move()
      if(life <= 0) return -1
      let status = this.updateBoard(prevSnakePos, positions, this.baitLocation)
      if(status === 1) {
        this.snake.grow()
        this.newBait()
      }
      return status
    }

    updateBoard(prevPos, curPos, bait){
      try {
        prevPos.forEach(pre => this.set(pre, 0))
        curPos.forEach(cur => this.set(cur, -1))
        this.set(curPos[0], 0.5)
      } catch {
        return -1
      }
      for(let c = 0; c < curPos.length; c++){
        let cur = curPos[c]
        let rest = [...curPos]
        rest.splice(c,1)
        // runs into itself
        for(let o = 0; o < rest.length; o++) {
          let other = rest[o]
          if(cur.equals(other)) return -1
        }
        // out of bounds
        if(cur.x >= this.opts.w || cur.x < 0 || cur.y >= this.opts.h || cur.y < 0) return -1
        // finds bait
        if(cur.equals(bait)) return 1
        return 0
      }
    }
  }

  class Generation {
    constructor(popSize) {
      this.population = [...Array(popSize)].map(()=> new Snake())
      this.citizenIndex = -1
      this.generationCount = 1
    }

    next(){
      this.citizenIndex += 1
      if(this.citizenIndex >= this.population.length) {
        this.citizenIndex = 0
        this.prepNextGeneration()
      }
      return this.population[this.citizenIndex]
    }

    prepNextGeneration() {
      this.generationCount += 1
      // calculate fitness
      let highscore = this.population.reduce((score,s) => Math.max(score,s.life * (s.score + 1)), 0)
      console.log(`highscore: ${highscore}`)
      let sortPop = this.population.map(s => {
        s.fitness = (s.life * (s.score + 1))/highscore
        return s
      })
      // sort based on fitness
      sortPop.sort((a,b) => b.fitness - a.fitness)
      // take only the fittest based on pecentOfFittest
      let fitPop = sortPop.slice(0, p.floor(percentOfFittest * sortPop.length))
      // crossover
      // let crossed = this.crossover(fitPop)
      // debugger
      let brains = fitPop.map(s => s.brain.toJSON())
      let mutated = this.mutate(brains)
      this.population = mutated
      console.log(`GENERATION: ${this.generationCount}, pop: ${this.population.length}`)
    }

    crossover(fitPop){
      let crossed = []
      for(let i = 0; i < fitPop.length; i+=2) {
        let s1 = fitPop[i]
        let s2 = fitPop[i+1] || fitPop[0]
        // calculate percentage of fitter brain to take
        let diff = Math.abs(s1.fitness - s2.fitness)
        let brainPercent = Math.min(0.5 + diff, 1)
        // get their json
        let b1 = s1.brain.toJSON()
        let b2 = s2.brain.toJSON()
        // calculate index of connections to slice from
        let consIndex = p.floor(b1.connections.length * brainPercent)
        let invConsIndex = b1.connections.length - p.floor(b1.connections.length * brainPercent)
        // slice connections
        let b1ConsS1 = b1.connections.slice(0, consIndex)
        let b2ConsS1 = b2.connections.slice(consIndex)
        let b1ConsS2 = b1.connections.slice(invConsIndex)
        let b2ConsS2 = b2.connections.slice(0,invConsIndex)
        // recombine connections
        b1.connections = [...b1ConsS1, ...b2ConsS1]
        b2.connections = [...b2ConsS2, ...b1ConsS2]

        //slice Neurons
        let neuIndex = p.floor(b1.neurons.length * brainPercent)
        let invNeuIndex = b1.neurons.length - p.floor(b1.neurons.length * brainPercent)

        let b1NeuS1 = b1.neurons.slice(0, neuIndex)
        let b2NeuS1 = b2.neurons.slice(neuIndex)
        let b1NeuS2 = b1.neurons.slice(invNeuIndex)
        let b2NeuS2 = b2.neurons.slice(0, invNeuIndex)

        b1.neurons = [...b1NeuS1, ...b2NeuS1]
        b2.neurons = [...b2NeuS2, ...b1NeuS2]

        crossed.push(b1, b2)
      }
      return crossed
    }

    mutate(toMutate){
      let offspring = []
      let numOffspring = p.floor(this.population.length / toMutate.length)
      // iterate through all the crossed over brains
      for(let i = 0; i < toMutate.length; i++){
        let brain = toMutate[i]
        let cons = [...brain.connections]
        let neurons = [...brain.neurons]
        // mutate their brains for X number of Children
        for(let k = 0; k < numOffspring; k++){
          //mutate connections
          for(let j = 0; j < cons.length; j++){
            let con = cons[j]
            if(Math.random() < mutatePercentage){
              con.weight = p.random(-1, 1)
            }
          }
          brain.connections = cons
          // mutate neurons
          for(let j = 0; j < neurons.length; j++){
            let ron = neurons[j]
            if(Math.random() < mutatePercentage){
              ron.bias = p.random(-1, 1)
            }
          }
          brain.neurons = neurons
          // create a new child
          offspring.push(new Snake(Network.fromJSON(brain)))
        }
      }
      return offspring
    }
  }

  /**
   *
   *    ___   _   __  __ ___    ___ ___  ___  ___
   *   / __| /_\ |  \/  | __|  / __/ _ \|   \| __|
   *  | (_ |/ _ \| |\/| | _|  | (_| (_) | |) | _|
   *   \___/_/ \_\_|  |_|___|  \___\___/|___/|___|
   */

  p.setup = function () {
    p.createCanvas(canvasSize, canvasSize)
    generation = new Generation(popSize)
    game = new Game(gameSize, gameSize)
    game.addSnake(generation.next())
  }

  p.myCustomRedrawAccordingToNewPropsHandler = function (props) {
    pause = props.pause
  }

  p.draw = function () {
    p.frameRate(gameSpeed || 60)
    game.snake.think(game.board)
    // console.log('looking', game.look(game.snake))

    if(pause) return p.noLoop()

    let status = game.step()
    if(status === -1) {
      game = new Game(gameSize, gameSize)
      game.addSnake(generation.next())
    } else if(status === 1) {
      game.snake.strengthen()
    }

    drawBoxes()
  }

  function drawBoxes(){
    p.background(100)
    let snakePos = game.snake.positions
    let applePos = game.baitLocation
    p.noStroke()
    p.fill(0)
    snakePos.forEach(pos => {
      p.rect(pos.x * scl, pos.y * scl, scl, scl)
    })

    p.fill(255,0,0)
    p.rect(applePos.x * scl, applePos.y * scl, scl, scl)
  }

  p.keyPressed = (e)=> {
    e.preventDefault()
    let snake = game.snake
    if (p.keyCode === p.LEFT_ARROW) {
      snake.setHeading(-1,0)
    } else if (p.keyCode === p.RIGHT_ARROW) {
      snake.setHeading(1,0)
    } else if (p.keyCode === p.UP_ARROW) {
      snake.setHeading(0,-1)
    } else if (p.keyCode === p.DOWN_ARROW) {
      snake.setHeading(0,1)
    }
  }
}

export default sketch