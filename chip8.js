// chip8.js — simple CHIP-8 emulator for browser
// Note: educational implementation, not optimized for performance
class CHIP8 {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    // logical CHIP-8 display is 64x32
    this.W = 64; this.H = 32;
    this.scaleX = canvas.width / this.W;
    this.scaleY = canvas.height / this.H;
    this.screen = new Uint8Array(this.W * this.H);
    this.V = new Uint8Array(16);       // registers V0..VF
    this.I = 0;                        // index register
    this.pc = 0x200;                   // program counter starts at 0x200
    this.stack = [];
    this.memory = new Uint8Array(4096);
    this.delayTimer = 0;
    this.soundTimer = 0;
    this.paused = false;
    this.speed = 600; // cycles per second
    this._lastCycle = 0;
    this._keys = new Array(16).fill(false);

    this._initFont();
    this._setupKeyboard();
  }

  _initFont() {
    // standard CHIP-8 fontset, each char 5 bytes
    const font = [
      0xF0,0x90,0x90,0x90,0xF0, // 0
      0x20,0x60,0x20,0x20,0x70, // 1
      0xF0,0x10,0xF0,0x80,0xF0, // 2
      0xF0,0x10,0xF0,0x10,0xF0, // 3
      0x90,0x90,0xF0,0x10,0x10, // 4
      0xF0,0x80,0xF0,0x10,0xF0, // 5
      0xF0,0x80,0xF0,0x90,0xF0, // 6
      0xF0,0x10,0x20,0x40,0x40, // 7
      0xF0,0x90,0xF0,0x90,0xF0, // 8
      0xF0,0x90,0xF0,0x10,0xF0, // 9
      0xF0,0x90,0xF0,0x90,0x90, // A
      0xE0,0x90,0xE0,0x90,0xE0, // B
      0xF0,0x80,0x80,0x80,0xF0, // C
      0xE0,0x90,0x90,0x90,0xE0, // D
      0xF0,0x80,0xF0,0x80,0xF0, // E
      0xF0,0x80,0xF0,0x80,0x80  // F
    ];
    this.memory.set(font, 0x50); // font at 0x50
  }

  reset() {
    this.screen.fill(0);
    this.V.fill(0);
    this.I = 0;
    this.pc = 0x200;
    this.stack = [];
    this.memory.fill(0);
    this._initFont();
    this.delayTimer = 0;
    this.soundTimer = 0;
    this.paused = false;
  }

  setPaused(v) {
    this.paused = v;
  }

  loadROM(uint8arr) {
    // load ROM bytes starting at 0x200
    this.memory.fill(0, 0x200);
    this.memory.set(uint8arr, 0x200);
    this.pc = 0x200;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._lastCycle = performance.now();
    requestAnimationFrame(this._frame.bind(this));
  }

  stop() {
    this._running = false;
  }

  _frame(ts) {
    if (!this._running) return;
    const elapsed = ts - this._lastCycle;
    // run cycles depending on elapsed time and speed
    const cyclesToRun = Math.floor(this.speed * (elapsed / 1000));
    if (!this.paused) {
      for (let i=0;i<Math.max(1, cyclesToRun);i++) this._cycle();
      // update timers at ~60Hz
      if (elapsed >= (1000/60)) {
        if (this.delayTimer > 0) this.delayTimer--;
        if (this.soundTimer > 0) this.soundTimer--;
        this._lastCycle = ts;
      }
    } else {
      // still update lastCycle so elapsed doesn't blow up
      this._lastCycle = ts;
    }
    this._draw();
    requestAnimationFrame(this._frame.bind(this));
  }

  _cycle() {
    // fetch
    const op = (this.memory[this.pc] << 8) | this.memory[this.pc+1];
    this.pc += 2;
    // decode & execute few common opcodes (educational subset)
    const nnn = op & 0x0FFF;
    const nn = op & 0x00FF;
    const n = op & 0x000F;
    const x = (op >> 8) & 0x0F;
    const y = (op >> 4) & 0x0F;

    switch (op & 0xF000) {
      case 0x0000:
        if (op === 0x00E0) { // CLS
          this.screen.fill(0);
        } else if (op === 0x00EE) { // RET
          this.pc = this.stack.pop();
        }
        break;
      case 0x1000: // JP addr
        this.pc = nnn;
        break;
      case 0x2000: // CALL addr
        this.stack.push(this.pc);
        this.pc = nnn;
        break;
      case 0x3000: // SE Vx, byte
        if (this.V[x] === nn) this.pc += 2;
        break;
      case 0x4000: // SNE Vx, byte
        if (this.V[x] !== nn) this.pc += 2;
        break;
      case 0x5000: // SE Vx, Vy
        if (this.V[x] === this.V[y]) this.pc += 2;
        break;
      case 0x6000: // LD Vx, byte
        this.V[x] = nn;
        break;
      case 0x7000: // ADD Vx, byte
        this.V[x] = (this.V[x] + nn) & 0xFF;
        break;
      case 0x8000:
        switch (n) {
          case 0x0: this.V[x] = this.V[y]; break; // LD
          case 0x1: this.V[x] |= this.V[y]; break; // OR
          case 0x2: this.V[x] &= this.V[y]; break; // AND
          case 0x3: this.V[x] ^= this.V[y]; break; // XOR
          case 0x4: {
            const sum = this.V[x] + this.V[y];
            this.V[0xF] = sum > 0xFF ? 1 : 0;
            this.V[x] = sum & 0xFF;
            break;
          }
          case 0x5: {
            this.V[0xF] = this.V[x] > this.V[y] ? 1 : 0;
            this.V[x] = (this.V[x] - this.V[y]) & 0xFF;
            break;
          }
        }
        break;
      case 0xA000: // LD I, addr
        this.I = nnn;
        break;
      case 0xC000: // RND Vx, byte
        this.V[x] = (Math.floor(Math.random()*256) & nn);
        break;
      case 0xD000: { // DRW Vx, Vy, nibble
        const vx = this.V[x] % this.W;
        const vy = this.V[y] % this.H;
        this.V[0xF] = 0;
        for (let row=0; row<n; row++) {
          const sprite = this.memory[this.I + row];
          for (let col=0; col<8; col++) {
            const bit = (sprite >> (7-col)) & 1;
            if (!bit) continue;
            const sx = (vx + col) % this.W;
            const sy = (vy + row) % this.H;
            const idx = sx + sy*this.W;
            if (this.screen[idx]) this.V[0xF] = 1;
            this.screen[idx] ^= 1;
          }
        }
        break;
      }
      case 0xE000:
        if ((op & 0x00FF) === 0x9E) { // SKP Vx
          if (this._keys[this.V[x]]) this.pc += 2;
        } else if ((op & 0x00FF) === 0xA1) { // SKNP Vx
          if (!this._keys[this.V[x]]) this.pc += 2;
        }
        break;
      case 0xF000:
        switch (op & 0x00FF) {
          case 0x07: this.V[x] = this.delayTimer; break;
          case 0x15: this.delayTimer = this.V[x]; break;
          case 0x18: this.soundTimer = this.V[x]; break;
          case 0x1E: this.I = (this.I + this.V[x]) & 0xFFF; break;
          case 0x29: this.I = 0x50 + (this.V[x] * 5); break; // sprite for digit
          case 0x33: { // BCD store
            const val = this.V[x];
            this.memory[this.I] = Math.floor(val/100);
            this.memory[this.I+1] = Math.floor((val%100)/10);
            this.memory[this.I+2] = val%10;
            break;
          }
          case 0x55: // LD [I], V0..Vx
            for (let i=0;i<=x;i++) this.memory[this.I+i] = this.V[i];
            break;
          case 0x65: // LD V0..Vx, [I]
            for (let i=0;i<=x;i++) this.V[i] = this.memory[this.I+i];
            break;
        }
        break;
      default:
        // unknown opcode — ignore
        break;
    }
  }

  _draw() {
    const ctx = this.ctx;
    const cw = this.canvas.width, ch = this.canvas.height;
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,cw,ch);
    ctx.fillStyle = '#0f0';
    const sx = cw / this.W, sy = ch / this.H;
    for (let y=0;y<this.H;y++) {
      for (let x=0;x<this.W;x++) {
        if (this.screen[x + y*this.W]) {
          ctx.fillRect(Math.floor(x*sx), Math.floor(y*sy), Math.ceil(sx), Math.ceil(sy));
        }
      }
    }
  }

  _setupKeyboard() {
    // Chip-8 keypad layout (hex):
    // 1 2 3 C
    // 4 5 6 D
    // 7 8 9 E
    // A 0 B F
    // We'll map to common keyboard keys:
    // 1 2 3 4 -> 1 2 3 4
    // Q W E R -> 4 5 6 7
    // A S D F -> 8 9 A B
    // Z X C V -> C 0 D F  (typical mapping)
    const keyMap = {
      '1':0x1, '2':0x2, '3':0x3, '4':0xC,
      'q':0x4, 'w':0x5, 'e':0x6, 'r':0xD,
      'a':0x7, 's':0x8, 'd':0x9, 'f':0xE,
      'z':0xA, 'x':0x0, 'c':0xB, 'v':0xF
    };
    window.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if (keyMap[k] !== undefined) this._keys[keyMap[k]] = true;
      // prevent page scroll when using arrow keys in some programs
      if (Object.keys(keyMap).includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', e => {
      const k = e.key.toLowerCase();
      if (keyMap[k] !== undefined) this._keys[keyMap[k]] = false;
    });
  }
}

