import p5 from 'p5'
import NN from '../nn'

function sketch (p) {
  let game,
  generation,
  canvasSize = 400,
  pause = false,
  percentOfFittest = 0.20,
  mutatePercentage = 0.1,
  popSize = 100,
  gameSize = 9,
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
      let initialPos = p.createVector(0,0)
      let randomVector = p.random([1,0],[0,1], [-1,0], [0,-1])
      this.brain = brain || new NN({input: 16, hidden: [8,6], output: 4})
      this.headPos = initialPos
      this.positions = [initialPos]


      this.heading = p.createVector(...randomVector)
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

    think(inputs) {
      let guess = this.brain.predict(inputs)
      let i = guess.indexOf(Math.max(...guess))
      if(i === 0) this.setHeading(0,-1)
      else if(i === 1) this.setHeading(0,1)
      else if(i === 2) this.setHeading(-1,0)
      else this.setHeading(1,0)
    }

    setFitness(s){
      this.fitness = s
    }

    strengthen() {
      this.score += 1
    }

    look(game) {
      // look forward
      const {w,h} = game.opts
      let result = {}
      for(let xDir = -1; xDir <= 1; xDir++) {
        for(let yDir = -1; yDir <= 1; yDir++) {
          if(xDir === 0 && yDir === 0) continue
          // init result variables
          result[`V${xDir}.${yDir}`] = null
          result[`D${xDir}.${yDir}`] = 0
          let dir = p.createVector(xDir, yDir)
          let last = this.headPos
          while (true){
            let scanner = p5.Vector.add(dir, last)
            // out of bounds
            if(scanner.x >= w || scanner.x < 0 || scanner.y >= h || scanner.y < 0) {
              result[`V${xDir}.${yDir}`] = -1
              result[`D${xDir}.${yDir}`] += 1
              break;

            } else {
              let val = game.get(scanner)
              result[`V${xDir}.${yDir}`] = val
              result[`D${xDir}.${yDir}`] += 1
              last = scanner
              if(val === 1 || val === -1) break
            }
          }
        }
      }
      // result === human decipherable object
      // ensure inputs are in the same
      let keys = Object.keys(result).sort()
      let inputs = keys.map(k => {
        let val = result[k]
        if(k[0] === 'D') return val/gameSize
        return val
      })
      return {inputs, result}
      // normalize
    }

    reproduce(partner) {
      return this.brain.mix(partner.brain)
    }

    mutate(rate) {
      return new Snake(this.brain.mutate(rate))
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
      snake.positions.forEach(pos => this.set(pos, -1))
    }

    newBait(){
      let curVal = -1, pos;
      while(curVal === -1 || curVal === 1){
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
      this.highscore = 0
      this.fittest = null
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

    fitnessFunction(snake) {
      return (snake.score + 1) * snake.life
    }

    calcPopFitness(){
      // calculate population highscore
      let popHighscore = this.population.reduce((hs,s) =>
        Math.max(this.fitnessFunction(s), hs), 0)
      // reset overall highscore if its higher
      if(popHighscore > this.highscore) this.highscore = popHighscore
      // determine snake fitness based on highscore
      console.log(popHighscore, this.highscore)
      return this.population.map(s => {
        s.setFitness(this.fitnessFunction(s)/ popHighscore)
        return s
      })
    }

    prepNextGeneration() {
      this.generationCount += 1
      // calculate fitness
      let fitPop = this.calcPopFitness()
      fitPop.sort((a,b)=> b.fitness - a.fitness)
      let elite = fitPop.slice(0, percentOfFittest * fitPop.length)
      let newPop = []
      let numChildren = p.floor(fitPop.length / elite.length)
      elite.forEach(s => {
        for(let n = 0; n < numChildren; n++){
          newPop.push(s.mutate(mutatePercentage))
        }
      })
      this.population = newPop
      console.log(`GENERATION: ${this.generationCount}, pop: ${this.population.length}`)
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
    let {inputs} = game.snake.look(game)
    game.snake.think(inputs)

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