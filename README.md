# CHIP-8 Emulator (browser)

Educational CHIP-8 emulator you can run in the browser and host on GitHub Pages.

**Legal note:** only load ROMs you have the legal right to use (public-domain, homebrew, or ones you've legally dumped yourself). This repo does not include copyrighted games.

## How to use

1. Open `index.html` in a browser (or enable GitHub Pages and visit `https://<username>.github.io/<repo>/`).
2. Use the file picker or drag & drop a `.ch8` ROM file.
3. Or paste a direct URL to a ROM and click "Load URL" (server must set CORS).
4. Keyboard mapping:
   - `1 2 3 4` → CHIP-8 keys `1 2 3 C`
   - `Q W E R` → `4 5 6 D`
   - `A S D F` → `7 8 9 E`
   - `Z X C V` → `A 0 B F`

## Notes for learning
- This implementation is intentionally compact for readability.
- To practice legally:
  - Use public-domain CHIP-8 demos (search for "chip8 public domain roms" or build your own tiny ROM bytes).
  - Write tiny test ROMs yourself to learn about opcodes.


