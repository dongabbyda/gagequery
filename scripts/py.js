#!/usr/bin/env node
// Run a Python 3 command with the first interpreter that exists on this machine, in UTF-8 mode.
// On Windows `python3` is often the Microsoft Store stub, so the py launcher is tried first there.
'use strict';
const { spawnSync } = require('child_process');

const candidates = process.platform === 'win32'
  ? [['py', ['-3']], ['python', []], ['python3', []]]
  : [['python3', []], ['python', []]];
const env = Object.assign({}, process.env, { PYTHONUTF8: '1' });

for (const [cmd, pre] of candidates) {
  const r = spawnSync(cmd, pre.concat(process.argv.slice(2)), { stdio: 'inherit', env });
  if (r.error && r.error.code === 'ENOENT') continue;
  process.exit(r.status === null ? 1 : r.status);
}
console.error('Python 3 was not found. Install it from python.org, then run the command again.');
process.exit(1);
