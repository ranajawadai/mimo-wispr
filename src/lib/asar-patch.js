'use strict';
// Safe, archive-preserving byte patcher for Wispr's app.asar.
// asar is an archive with file offsets in its header, so EVERY replacement
// MUST keep the same byte length (we pad with spaces) or the archive breaks.

function patchBytes(data, from, to) {
  const f = Buffer.from(from, 'ascii');
  const t = Buffer.from(to, 'ascii');
  let i = 0, count = 0;
  while (i <= data.length - f.length) {
    let ok = true;
    for (let j = 0; j < f.length; j++) {
      if (data[i + j] !== f[j]) { ok = false; break; }
    }
    if (ok) { t.copy(data, i); i += f.length; count++; }
    else i++;
  }
  return count;
}

// Cosmetic label changes (English): "words remaining" -> "Unlimited",
// "Upgrade" buttons -> "PRO Plan" / "Enterprise Plan".
const LABEL_REPS = [
  ['{{remaining}} of {{cap}} words remaining this week', 'Unlimited words - PRO Plan'],
  ['<display>{{display}}</display> words remaining', '<display>Unlimited</display> PRO Plan'],
  ['Upgrade to Pro', 'PRO Plan'],
  ['Upgrade to Enterprise', 'Enterprise Plan'],
  ['Upgrade to Flow Enterprise', 'Enterprise Plan'],
  ['Upgrade to enterprise', 'Enterprise Plan'],
  [':"Upgrade"', ':"PRO"'],
];

function applyLabelReplacements(data) {
  let total = 0;
  for (const [from, base] of LABEL_REPS) {
    if (base.length > from.length) continue;
    const to = base + ' '.repeat(from.length - base.length);
    total += patchBytes(data, from, to);
  }
  return total;
}

// Redirect Wispr's API host to the local proxy and force REST fallback.
// We replace the full scheme-prefixed hosts (shrinking the string by 2 bytes).
// This is safe because the patched JS bundle is the last file in the asar,
// so shrinking it does not shift any other file's offset. The labels below
// are padded to keep their length exactly equal.
function applyHostRedirect(data) {
  let n = 0;
  n += patchBytes(data, 'http://api.wisprflow.ai', 'http://127.0.0.1:8000');
  n += patchBytes(data, 'wss://api.wisprflow.ai/', 'ws://127.0.0.1:8300/');
  return n;
}

module.exports = { patchBytes, applyLabelReplacements, applyHostRedirect, LABEL_REPS };
