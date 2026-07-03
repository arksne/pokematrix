/**
 * Generate placeholder pixel-art trainer avatar PNGs.
 * Creates simple 56x56 colored PNGs for each trainer sprite ID.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../public/avatars');

// Simple 8x8 pixel-art trainer sprites (each color is a palette index)
// Row-major, each row is 8 bytes (8 pixels)
const AVATARS = {
  'trainer_f': {
    // Female trainer (Leaf-style) — red hat, brown hair, white shirt
    palette: [0x1a1a2e, 0xffffff, 0xff6b6b, 0x8b4513, 0xffd700, 0x4ecdc4, 0x2c2c54, 0x95a5a6],
    pixels: [
      0,0,0,0,1,1,1,1,
      0,0,0,1,2,2,2,2,
      0,0,1,1,2,2,2,2,
      0,0,0,0,3,3,3,3,
      0,0,1,1,4,4,1,1,
      0,1,1,1,5,5,5,0,
      0,0,1,0,6,0,6,0,
      0,0,1,0,1,0,1,0,
    ],
  },
  'trainer_m': {
    // Male trainer (Red-style) — blue hat, black hair, white shirt
    palette: [0x1a1a2e, 0xffffff, 0x3498db, 0x2c2c2c, 0xe74c3c, 0x2ecc71, 0x8b4513, 0x95a5a6],
    pixels: [
      0,0,0,0,1,1,1,1,
      0,0,0,1,2,2,2,2,
      0,0,1,1,2,2,2,2,
      0,0,0,0,3,3,3,0,
      0,0,0,0,4,4,1,1,
      0,0,1,1,5,5,5,0,
      0,0,1,0,3,0,6,0,
      0,0,1,0,1,0,1,0,
    ],
  },
  'ninja': {
    // Ninja (Koga-style) — purple outfit, headband
    palette: [0x1a1a2e, 0x9b59b6, 0x8e44ad, 0x2c2c54, 0xe74c3c, 0xf1c40f, 0x95a5a6, 0xffffff],
    pixels: [
      0,0,0,1,1,1,0,0,
      0,0,1,1,1,1,1,0,
      0,0,0,2,2,2,2,0,
      0,0,0,3,3,3,3,0,
      0,1,0,0,4,4,0,0,
      1,1,0,5,5,5,5,0,
      0,0,1,0,6,0,3,0,
      0,0,1,0,1,0,1,0,
    ],
  },
  'sailor': {
    // Sailor — white hat, blue stripes
    palette: [0x1a1a2e, 0xffffff, 0x2980b9, 0x2c3e50, 0xf39c12, 0x95a5a6, 0x8b4513, 0xe74c3c],
    pixels: [
      0,0,1,1,1,1,0,0,
      0,1,1,2,2,1,1,0,
      0,0,1,2,2,1,0,0,
      0,0,0,3,3,3,3,0,
      0,1,0,0,4,4,0,0,
      1,1,1,5,5,5,5,0,
      0,0,1,0,6,0,6,0,
      0,0,1,0,1,0,1,0,
    ],
  },
  'super_nerd': {
    // Super Nerd — glasses, green shirt
    palette: [0x1a1a2e, 0x27ae60, 0x2ecc71, 0x7f8c8d, 0xf39c12, 0x2c3e50, 0x8b4513, 0xffffff],
    pixels: [
      0,0,0,1,1,1,0,0,
      0,0,1,1,1,1,1,0,
      0,0,2,3,2,3,2,0,
      0,0,2,3,2,3,0,0,
      0,0,0,0,4,4,0,0,
      0,1,1,1,5,5,5,0,
      0,1,0,0,6,0,6,0,
      0,1,0,0,1,0,1,0,
    ],
  },
  'beauty': {
    // Beauty — pink dress, blonde hair
    palette: [0x1a1a2e, 0xff69b4, 0xff1493, 0xffd700, 0xf0e68c, 0x8b4513, 0xffffff, 0x95a5a6],
    pixels: [
      0,0,0,1,1,1,0,0,
      0,0,1,1,1,1,1,0,
      0,1,0,2,2,2,2,0,
      0,0,0,3,3,3,3,0,
      0,0,1,1,4,4,0,0,
      0,0,1,5,5,5,5,0,
      0,0,1,0,6,0,6,0,
      0,0,1,0,1,0,1,0,
    ],
  },
  'gentleman': {
    // Gentleman — suit, top hat, mustache
    palette: [0x1a1a2e, 0x34495e, 0x2c3e50, 0xffffff, 0x95a5a6, 0xf1c40f, 0x8b4513, 0x7f8c8d],
    pixels: [
      0,1,1,1,1,1,1,0,
      0,1,1,1,1,1,1,0,
      0,0,2,2,2,2,0,0,
      0,0,0,3,3,3,3,0,
      0,1,0,0,4,4,0,0,
      1,1,1,5,5,0,0,0,
      0,0,1,0,6,0,6,0,
      0,0,1,0,1,0,1,0,
    ],
  },
};

function createPNG(width, height, palette, pixelData) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);   // width
  ihdr.writeUInt32BE(height, 4);  // height
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 3;  // color type: indexed (palette)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // PLTE chunk (palette)
  const plte = Buffer.alloc(palette.length * 3);
  for (let i = 0; i < palette.length; i++) {
    plte.writeUInt8((palette[i] >> 16) & 0xff, i * 3);     // R
    plte.writeUInt8((palette[i] >> 8) & 0xff, i * 3 + 1);  // G
    plte.writeUInt8(palette[i] & 0xff, i * 3 + 2);         // B
  }
  const plteChunk = makeChunk('PLTE', plte);

  // IDAT chunk (image data — filtered rows then zlib-compressed)
  // Each row: filter byte (0 = None) + pixel indices
  const rawData = Buffer.alloc(height * (1 + width));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width);
    rawData[rowStart] = 0; // filter: None
    const srcRow = pixelData[y] || pixelData[y % pixelData.length];
    for (let x = 0; x < width; x++) {
      const pxIdx = (y < pixelData.length && x < pixelData[0].length)
        ? pixelData[y][x]
        : 0;
      rawData[rowStart + 1 + x] = Math.min(pxIdx, palette.length - 1);
    }
  }
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, plteChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeB, data]);
  const crc = crc32(crcData);
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crc, 0);
  return Buffer.concat([len, typeB, data, crcB]);
}

// CRC32 implementation for PNG
function crc32(data) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Main
mkDirSync(OUT_DIR);

for (const [name, spec] of Object.entries(AVATARS)) {
  // Scale up 8x8 to 56x56 (each pixel becomes 7x7)
  const SCALE = 7;
  const SIZE = 8 * SCALE;
  const scaledPixels = [];
  for (let y = 0; y < 8; y++) {
    for (let sy = 0; sy < SCALE; sy++) {
      const row = [];
      for (let x = 0; x < 8; x++) {
        const color = spec.pixels[y * 8 + x];
        for (let sx = 0; sx < SCALE; sx++) {
          row.push(color);
        }
      }
      scaledPixels.push(row);
    }
  }

  const png = createPNG(SIZE, SIZE, spec.palette, scaledPixels);
  const outPath = join(OUT_DIR, `${name}.png`);
  writeFileSync(outPath, png);
  console.log(`✓ Generated ${name}.png (${png.length} bytes)`);
}

console.log('\nAll avatars generated in:', OUT_DIR);

function mkDirSync(dir) {
  try { mkdirSync(dir, { recursive: true }); } catch (_) {}
}
