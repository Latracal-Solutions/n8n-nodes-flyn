/*
 * Refuse to pack or publish a package with no compiled output.
 *
 * `files: ["dist"]` means npm silently ships an EMPTY tarball when dist is
 * missing or partial, and `npm pack` does not run prepublishOnly, so the usual
 * build-and-lint gate does not fire. A published empty package is unfixable:
 * the version is permanent and the name is spent.
 */
const fs = require('fs');
const path = require('path');

const required = [
  'dist/credentials/FlynApi.credentials.js',
  'dist/nodes/Flyn/Flyn.node.js',
  'dist/nodes/Flyn/flyn.svg',
  'dist/nodes/FlynTrigger/FlynTrigger.node.js',
  'dist/nodes/FlynTrigger/flyn.svg',
  // Codex files are what give the n8n.io listing its categories, aliases and
  // documentation links. Shipping without them produces a working but
  // uncategorised node, which is the opposite of why we are publishing.
  'dist/nodes/Flyn/Flyn.node.json',
  'dist/nodes/FlynTrigger/FlynTrigger.node.json',
];

const missing = required.filter((f) => !fs.existsSync(path.join(__dirname, '..', f)));
if (missing.length) {
  console.error('Refusing to pack: build output is missing:\n  ' + missing.join('\n  '));
  process.exit(1);
}

// The n8n manifest must point at files that actually exist, or the node loads
// as an empty shell with no error.
const pkg = require('../package.json');
const declared = [...(pkg.n8n?.credentials ?? []), ...(pkg.n8n?.nodes ?? [])];
const broken = declared.filter((f) => !fs.existsSync(path.join(__dirname, '..', f)));
if (broken.length) {
  console.error('Refusing to pack: package.json "n8n" paths do not exist:\n  ' + broken.join('\n  '));
  process.exit(1);
}

console.log(`dist verified: ${required.length} files, ${declared.length} n8n entries resolve`);
