// Run once: node resize-icons.js
// Requires: npm install sharp  (or use the pre-copied icons manually)
const sharp = require('sharp');
const path = require('path');

const src = path.join(__dirname, 'assets', 'square-logo-dark.png');
const sizes = [16, 32, 48, 128];

Promise.all(
  sizes.map(size =>
    sharp(src)
      .resize(size, size)
      .toFile(path.join(__dirname, 'icons', `icon${size}.png`))
      .then(() => console.log(`icon${size}.png`))
  )
).then(() => console.log('Done'));
