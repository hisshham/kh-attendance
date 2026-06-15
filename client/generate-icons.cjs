/**
 * PWA Icon Generator
 * Generates PNG icons from SVG for all required PWA sizes.
 * Uses pure Canvas API — no external dependencies needed.
 * 
 * Run: node generate-icons.js
 */
const fs = require('fs');
const path = require('path');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const ICONS_DIR = path.join(__dirname, 'public', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
}

// Since we can't use canvas in vanilla Node, we'll create simple solid-color PNG icons
// with proper dimensions as placeholders. For production, use an online SVG-to-PNG converter.

function createMinimalPNG(size) {
    // Create a minimal valid PNG file with a colored background
    // This is a proper PNG with IHDR, IDAT, and IEND chunks
    
    const width = size;
    const height = size;
    
    // PNG signature
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    
    // IHDR chunk
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);  // width
    ihdrData.writeUInt32BE(height, 4); // height
    ihdrData.writeUInt8(8, 8);         // bit depth
    ihdrData.writeUInt8(2, 9);         // color type (RGB)
    ihdrData.writeUInt8(0, 10);        // compression
    ihdrData.writeUInt8(0, 11);        // filter
    ihdrData.writeUInt8(0, 12);        // interlace
    
    const ihdrChunk = createChunk('IHDR', ihdrData);
    
    // IDAT chunk - raw image data with zlib compression
    // Create raw scanline data (filter byte + RGB pixels per row)
    const rawData = [];
    
    // Background colors (dark slate: #0f172a)
    const bgR = 15, bgG = 23, bgB = 42;
    // Accent color (blue: #3b82f6) for a centered circle
    const acR = 59, acG = 130, acB = 246;
    
    const cx = width / 2;
    const cy = height / 2;
    const radius = width * 0.35;
    
    for (let y = 0; y < height; y++) {
        rawData.push(0); // filter byte (none)
        for (let x = 0; x < width; x++) {
            const dx = x - cx;
            const dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < radius) {
                // Gradient from blue to purple
                const t = dist / radius;
                const r = Math.round(acR + (139 - acR) * t);
                const g = Math.round(acG + (92 - acG) * t);
                const b = Math.round(acB + (246 - acB) * t);
                rawData.push(r, g, b);
            } else {
                rawData.push(bgR, bgG, bgB);
            }
        }
    }
    
    // Compress with zlib (deflate)
    const zlib = require('zlib');
    const compressed = zlib.deflateSync(Buffer.from(rawData));
    const idatChunk = createChunk('IDAT', compressed);
    
    // IEND chunk
    const iendChunk = createChunk('IEND', Buffer.alloc(0));
    
    return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    
    const typeBuffer = Buffer.from(type, 'ascii');
    const crcInput = Buffer.concat([typeBuffer, data]);
    
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcInput), 0);
    
    return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
        crc ^= buf[i];
        for (let j = 0; j < 8; j++) {
            if (crc & 1) {
                crc = (crc >>> 1) ^ 0xEDB88320;
            } else {
                crc = crc >>> 1;
            }
        }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

console.log('Generating PWA icons...');

for (const size of SIZES) {
    const filename = `icon-${size}x${size}.png`;
    const filepath = path.join(ICONS_DIR, filename);
    const png = createMinimalPNG(size);
    fs.writeFileSync(filepath, png);
    console.log(`  ✅ ${filename} (${png.length} bytes)`);
}

console.log(`\n🎉 Generated ${SIZES.length} icons in ${ICONS_DIR}`);
