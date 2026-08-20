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

const copy = (fromDir, toDir, files) => {
  for (const file of files) {
    const from = path.join(__dirname, fromDir, file);
    if (!fs.existsSync(from)) continue;
    const to = path.join(__dirname, 'dist', toDir, file);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    console.log(`asset -> ${path.relative(__dirname, to)}`);
  }
};

for (const dir of ['Flyn', 'FlynTrigger']) {
  copy(path.join('nodes', dir), path.join('nodes', dir), [
    'flyn.svg',
    'flyn.dark.svg',
    `${dir}.node.json`,
  ]);
}
// Credentials carry their own icon too, and n8n resolves it relative to the
// compiled credential file, so it has to land in dist/credentials.
copy('credentials', 'credentials', ['flyn.svg', 'flyn.dark.svg']);

/*
 * Verify the build produced everything before anyone can pack it.
 *
 * `files: ["dist"]` means npm ships an EMPTY tarball when the build has not run,
 * and `npm pack` executes prepack rather than prepublishOnly, so the usual gate
 * does not fire. A published empty package is unfixable: the version is
 * permanent and the name is spent. This already caught one such tarball.
 */
const required = [
  'dist/credentials/FlynApi.credentials.js',
  'dist/nodes/Flyn/Flyn.node.js',
  'dist/nodes/Flyn/Flyn.node.json',
  'dist/nodes/Flyn/flyn.svg',
  'dist/nodes/FlynTrigger/FlynTrigger.node.js',
  'dist/nodes/FlynTrigger/FlynTrigger.node.json',
  'dist/nodes/FlynTrigger/flyn.svg',
  'dist/nodes/Flyn/flyn.dark.svg',
  'dist/nodes/FlynTrigger/flyn.dark.svg',
  'dist/credentials/flyn.svg',
  'dist/credentials/flyn.dark.svg',
];

const missing = required.filter((f) => !fs.existsSync(path.join(__dirname, f)));
if (missing.length) {
  console.error('Build incomplete, refusing to continue:\n  ' + missing.join('\n  '));
  process.exit(1);
}

// The n8n manifest must point at files that exist, or the node loads as an empty
// shell with no error at all.
const pkg = require('./package.json');
const declared = [...(pkg.n8n?.credentials ?? []), ...(pkg.n8n?.nodes ?? [])];
const broken = declared.filter((f) => !fs.existsSync(path.join(__dirname, f)));
if (broken.length) {
  console.error('package.json "n8n" paths do not resolve:\n  ' + broken.join('\n  '));
  process.exit(1);
}

console.log(`dist verified: ${required.length} files, ${declared.length} n8n entries resolve`);
