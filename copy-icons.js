/*
 * Copy node icons AND codex files into dist/ alongside the compiled JS.
 *
 * tsc emits only .js, so both the .svg and the .node.json would be left behind.
 * A missing codex is not an error, n8n just logs "No codex available", but it is
 * what supplies the categories, aliases and documentation links that the
 * n8n.io integrations page renders. Since that page is the whole reason for
 * publishing, the codex is not optional in practice.
 */
const fs = require('fs');
const path = require('path');

for (const dir of ['Flyn', 'FlynTrigger']) {
  for (const file of ['flyn.svg', `${dir}.node.json`]) {
    const from = path.join(__dirname, 'nodes', dir, file);
    if (!fs.existsSync(from)) continue;
    const to = path.join(__dirname, 'dist', 'nodes', dir, file);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    console.log(`asset -> ${path.relative(__dirname, to)}`);
  }
}
