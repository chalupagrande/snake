import p5 from 'p5'
import NN from '../nn'

function sketch (p) {
  let game,
  generation,
  canvasSize = 400,
  pause = false,
  percentOfFittest = 0.1,
  mutatePercentage = 0.1,
  numGenerations = 500,
  popSize = 100,
  gameSize = 10,
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
      let half = p.floor((gameSize-1)/2)
      let initialPos = p.createVector(half, half)
      this.brain = brain || new NN({input: 16, hidden: [8], output: 4})
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
      let raw = {}
      for(let xDir = -1; xDir <= 1; xDir++) {
        for(let yDir = -1; yDir <= 1; yDir++) {
          if(xDir === 0 && yDir === 0) continue
          // init result variables
          raw[`V${xDir}.${yDir}`] = null
          raw[`D${xDir}.${yDir}`] = 0
          let dir = p.createVector(xDir, yDir)
          let last = this.headPos
          while (true){
            let scanner = p5.Vector.add(dir, last)
            // out of bounds
            if(scanner.x >= w || scanner.x < 0 || scanner.y >= h || scanner.y < 0) {
              raw[`V${xDir}.${yDir}`] = -1
              raw[`D${xDir}.${yDir}`] += 1
              break;

            } else {
              let val = game.get(scanner)
              raw[`V${xDir}.${yDir}`] = val
              raw[`D${xDir}.${yDir}`] += 1
              last = scanner
              if(val === 1 || val === -1) break
            }
          }
        }
      }
      // result === human decipherable object
      // ensure inputs are in the same
      let inputs = [
        raw['D0.1']/gameSize,
        raw['V0.1'],
        raw['D0.-1']/gameSize,
        raw['V0.-1'],
        raw['D1.0']/gameSize,
        raw['V1.0'],
        raw['D1.1']/gameSize,
        raw['V1.1'],
        raw['D1.-1']/gameSize,
        raw['V1.-1'],
        raw['D-1.0']/gameSize,
        raw['V-1.0'],
        raw['D-1.1']/gameSize,
        raw['V-1.1'],
        raw['D-1.-1']/gameSize,
        raw['V-1.-1']]
      return {inputs, raw}
    }

    reproduce(partner) {
      return this.brain.mix(this, partner)
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
      this.scores = []
    }

    next(){
      this.citizenIndex += 1
      if(this.citizenIndex >= this.population.length) {
        if(this.generationCount > numGenerations) {
          pause = true
          console.log(this.scores)
          debugger
        }
        this.citizenIndex = 0
        this.prepNextGeneration()
      }
      return this.population[this.citizenIndex]
    }

    scoreFunc(snake) {
      return (snake.score + 1) * snake.life
    }

    calcPopFitness(){
      // calculate population highscore
      let popHighscore = this.population.reduce((hs,s) =>
        Math.max(this.scoreFunc(s), hs), 0)
      // determine snake fitness based on highscore
      let scoredPop = this.population.map(s => {
        s.setFitness(this.scoreFunc(s)/ popHighscore)
        return s
      })
      if(popHighscore > this.highscore){
        this.highscore = popHighscore
        this.fittest = scoredPop.find(s => {
          return this.scoreFunc(s) === popHighscore
        })
      }
      console.log(`POP: ${popHighscore}, OVERALL: ${this.highscore}, FITTEST: ${this.fittest.score}`)
      return scoredPop
    }

    prepNextGeneration() {
      this.generationCount += 1
      // calculate fitness
      let sortedPop = this.calcPopFitness()
      // sort poulation
      sortedPop.sort((a,b)=> b.fitness - a.fitness)
      // chose based on fitness
      let numToChose = percentOfFittest * sortedPop.length
      let chosen = []
      for(let i = 0; i < numToChose; i++){
        chosen.push(this.chooseByFitness(sortedPop))
      }
      // create new population based off mutations
      let newPop = []
      let numChildren = p.floor(sortedPop.length / chosen.length)
      chosen.forEach(s => {
        for(let n = 0; n < numChildren; n++){
          newPop.push(s.mutate(mutatePercentage))
        }
      })
      this.population = newPop

      //log
      console.log(`GENERATION: ${this.generationCount}, pop: ${this.population.length}`)
      chosen[0].brain.log()
    }

    /**
     *
     * @param {array} population - SORTED population
     */
    chooseByFitness(population) {
      let weights = []
      let total_weight = population.reduce((a, s) => {
        weights.push(s.fitness)
        return a + s.fitness
      }, 0)

      let random_num = random(0, total_weight)
      let weight_sum = 0

      for (let i = 0; i < population.length; i++) {
        weight_sum += weights[i]
        weight_sum =  +weight_sum.toFixed(2)

        if (random_num <= weight_sum) {
          return population[i]
        }
      }
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
    gameSpeed && p.frameRate(gameSpeed)
    let {inputs, raw} = game.snake.look(game)
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

function random(min, max) {
  return Math.random() * (max - min) + min;
}

export default sketch