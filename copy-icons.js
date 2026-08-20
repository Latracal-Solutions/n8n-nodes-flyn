/* Copy node icons into dist/ alongside the compiled JS that references them. */
const fs = require('fs');
const path = require('path');

for (const dir of ['Flyn', 'FlynTrigger']) {
  const from = path.join(__dirname, 'nodes', dir, 'flyn.svg');
  const to = path.join(__dirname, 'dist', 'nodes', dir, 'flyn.svg');
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  console.log(`icon -> ${path.relative(__dirname, to)}`);
}
