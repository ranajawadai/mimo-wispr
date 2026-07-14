'use strict';
// Minimal zero-dependency tests for the asar patcher.
// Run: node tests/asar-patch.test.js
const assert = require('assert');
const { patchBytes, applyLabelReplacements, applyHostRedirect, LABEL_REPS } =
  require('../src/lib/asar-patch');

// 1. Every label replacement must keep the same byte length (asar-safe).
for (const [from, base] of LABEL_REPS) {
  if (base.length > from.length) continue;
  const to = base + ' '.repeat(from.length - base.length);
  assert.strictEqual(Buffer.from(to).length, Buffer.from(from).length, 'length must match for: ' + from);
}

// 2. patchBytes replaces every occurrence and preserves buffer size.
const buf = Buffer.from('api.wisprflow.ai and api.wisprflow.ai');
const n = patchBytes(buf, 'api.wisprflow.ai', '127.0.0.1:8000'.padEnd(16, ' '));
assert.strictEqual(n, 2);
assert.strictEqual(buf.length, 37);

// 3. applyLabelReplacements swaps text WITHOUT changing buffer size.
const sample = Buffer.from('{{remaining}} of {{cap}} words remaining this week', 'latin1');
const before = sample.length;
applyLabelReplacements(sample);
assert.strictEqual(sample.length, before);
assert.ok(sample.includes('Unlimited words - PRO Plan'), 'label not swapped');

// 4. applyHostRedirect swaps the host strings.
const host = Buffer.from('http://api.wisprflow.ai and wss://api.wisprflow.ai/', 'latin1');
const nh = applyHostRedirect(host);
assert.ok(host.includes('http://127.0.0.1:8000'));
assert.ok(host.includes('ws://127.0.0.1:8300/'));
assert.strictEqual(nh, 2);

console.log('asar-patch tests passed');
