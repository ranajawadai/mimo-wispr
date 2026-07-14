'use strict';
// Locate the installed Wispr Flow app.asar in a version-tolerant way.
const fs = require('fs');
const path = require('path');

function findWisprRoots() {
  const base = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'WisprFlow') : null;
  if (!base || !fs.existsSync(base)) return [];
  return fs.readdirSync(base)
    .filter((d) => fs.existsSync(path.join(base, d, 'resources', 'app.asar')))
    .map((d) => path.join(base, d, 'resources', 'app.asar'));
}

function findAsar() {
  const roots = findWisprRoots();
  if (!roots.length) return null;
  // Prefer the most recently modified asar (latest installed version).
  roots.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return roots[0];
}

function findExe() {
  const base = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'WisprFlow') : null;
  if (!base) return null;
  const p = path.join(base, 'Wispr Flow.exe');
  return fs.existsSync(p) ? p : null;
}

module.exports = { findAsar, findExe, findWisprRoots };
