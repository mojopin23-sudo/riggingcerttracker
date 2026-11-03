import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const FONT = {
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
};

function crc32(buffer) {
  let crc = ~0;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size, pixels) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const start = y * (stride + 1);
    raw[start] = 0;
    pixels.copy(raw, start + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function inside(x, y, size, radius) {
  const inset = radius;
  const left = x < inset;
  const right = x >= size - inset;
  const top = y < inset;
  const bottom = y >= size - inset;
  if (!(left || right) || !(top || bottom)) return true;
  const cx = left ? inset : size - inset - 1;
  const cy = top ? inset : size - inset - 1;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function setPixel(pixels, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const index = (y * size + x) * 4;
  pixels[index] = color[0];
  pixels[index + 1] = color[1];
  pixels[index + 2] = color[2];
  pixels[index + 3] = color[3];
}

function fillRect(pixels, size, x, y, width, height, color) {
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) setPixel(pixels, size, x + col, y + row, color);
  }
}

function drawText(pixels, size, text, originX, originY, scale, color) {
  let cursor = originX;
  for (const char of text) {
    const glyph = FONT[char];
    for (let row = 0; row < glyph.length; row += 1) {
      for (let col = 0; col < glyph[row].length; col += 1) {
        if (glyph[row][col] !== "1") continue;
        fillRect(pixels, size, cursor + col * scale, originY + row * scale, scale, scale, color);
      }
    }
    cursor += (glyph[0].length + 1) * scale;
  }
}

function make(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const green = [30, 42, 36, 255];
  const orange = [226, 91, 18, 255];
  const paper = [246, 241, 231, 255];
  const radius = Math.round(size * 0.18);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!inside(x, y, size, radius)) continue;
      setPixel(pixels, size, x, y, green);
    }
  }
  const scale = Math.max(1, Math.round(size / 28));
  const textWidth = (5 + 1 + 5 + 1 + 5) * scale;
  const textHeight = 7 * scale;
  const textX = Math.round((size - textWidth) / 2);
  const textY = Math.round(size * 0.3);
  drawText(pixels, size, "331", textX, textY, scale, paper);
  const barWidth = Math.round(size * 0.46);
  fillRect(
    pixels,
    size,
    Math.round((size - barWidth) / 2),
    textY + textHeight + Math.round(size * 0.06),
    barWidth,
    Math.max(2, Math.round(size * 0.035)),
    orange,
  );
  return png(size, pixels);
}

const publicDir = path.join(process.cwd(), "public");
fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, "icon-192.png"), make(192));
fs.writeFileSync(path.join(publicDir, "icon-512.png"), make(512));
fs.writeFileSync(path.join(publicDir, "apple-touch-icon.png"), make(180));
fs.mkdirSync(path.join(process.cwd(), "app"), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), "app", "icon.png"), make(192));
console.log("icons written");
