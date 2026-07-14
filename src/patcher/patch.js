'use strict';
// Patches every installed Wispr Flow app.asar:
//   1. redirects the API host to the local Mimo Wisper proxy
//   2. swaps the quota/upgrade UI text for "Unlimited" / "PRO Plan"
// Backs up each original asar once. Run from the dashboard's "First-time Setup".
//
// Note: the asar header on these builds is not the standard 8-byte-size+JSON
// layout, so we do NOT re-parse it. The byte-swap technique is proven safe:
// the patched JS bundle is the last file in the archive, so replacing its
// content (even shrinking it) does not shift any other file's offset.

const fs = require('fs');
const { findWisprRoots } = require('./find-wispr');
const { applyHostRedirect, applyLabelReplacements } = require('../lib/asar-patch');

const roots = findWisprRoots();
if (!roots.length) {
  console.error('Could not find Wispr Flow app.asar. Is Wispr Flow installed?');
  process.exit(2);
}

let patchedAny = false;
for (const asar of roots) {
  const bak = asar + '.bak';
  if (!fs.existsSync(bak)) {
    fs.copyFileSync(asar, bak);
    console.log('Backup created: ' + bak);
  }

  const data = fs.readFileSync(asar);
  const nHost = applyHostRedirect(data);
  const nLabel = applyLabelReplacements(data);

  const hostOk = data.indexOf(Buffer.from('http://127.0.0.1:8000')) >= 0 ||
                 data.indexOf(Buffer.from('ws://127.0.0.1:8300/')) >= 0 ||
                 data.indexOf(Buffer.from('api.wisprflow.ai')) < 0;
  fs.writeFileSync(asar, data);

  console.log('Patched: ' + asar);
  console.log('  host redirects: ' + nHost + ', label replacements: ' + nLabel);
  if (!hostOk) console.log('  WARNING: redirect target not present after patch (already patched or new layout).');
  patchedAny = true;
}

console.log(patchedAny ? 'Done. Restart Wispr Flow for changes to take effect.' : 'Nothing to patch.');
