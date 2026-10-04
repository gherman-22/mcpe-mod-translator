const fs = require('fs');
const zlib = require('zlib');

// Create an uncompressed/deflated RGBA PNG
function createPng(width, height, drawFn) {
  const rowSize = width * 4 + 1;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type: None
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = drawFn(x, y, width, height);
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: RGBA (6)
  ihdr[10] = 0; // Compression: Deflate
  ihdr[11] = 0; // Filter: Standard
  ihdr[12] = 0; // Interlace: None

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type);
    const crcVal = crc32(Buffer.concat([typeBuf, data]));
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crcVal >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// CRC32 implementation
function crc32(buf) {
  let table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[n] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

// Emerald icon drawing
function drawEmeraldIcon(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const radius = w * 0.44;

  // Background rounded squircle
  const cornerR = w * 0.22;
  const isInsideBg = Math.abs(dx) < (w/2 - 4) && Math.abs(dy) < (h/2 - 4);

  // Border & background gradient
  if (Math.abs(dx) > (w/2 - 2) || Math.abs(dy) > (h/2 - 2)) {
    return [0, 0, 0, 0];
  }

  // Emerald Gem shape (hexagon/diamond)
  const gemY = cy - h * 0.04;
  const gemSize = w * 0.28;
  const gemDx = Math.abs(x - cx);
  const gemDy = Math.abs(y - gemY);

  const inGem = (gemDx / gemSize + gemDy / (gemSize * 1.25)) < 1.0;
  const inInnerGem = (gemDx / (gemSize * 0.7) + gemDy / (gemSize * 0.85)) < 1.0;

  if (inInnerGem) {
    return [52, 211, 153, 255]; // Bright emerald #34d399
  }
  if (inGem) {
    return [16, 185, 129, 255]; // Core emerald #10b981
  }

  // Dark background gradient
  const grad = Math.min(255, Math.floor(18 + (y / h) * 20));
  return [10, 15, 26, 255]; // Deep dark navy #0a0f1a
}

// Generate icons
const icon192 = createPng(192, 192, drawEmeraldIcon);
fs.writeFileSync('public/icon-192.png', icon192);

const icon512 = createPng(512, 512, drawEmeraldIcon);
fs.writeFileSync('public/icon-512.png', icon512);
fs.writeFileSync('public/apple-touch-icon.png', icon192);

console.log('Successfully created public/icon-192.png and public/icon-512.png');
