// One-off tool: repair mojibake introduced by ANSI round-trips.
// Resurrects UTF-8 that was misdecoded as windows-1252, line by line, up to 3 passes.
const fs = require('fs');
const path = require('path');

function cp1252Table() {
  const toChar = {};
  for (let b = 0; b < 256; b++) toChar[b] = String.fromCharCode(b);
  const special = {
    0x80: '\u20AC', 0x82: '\u201A', 0x83: '\u0192', 0x84: '\u201E', 0x85: '\u2026',
    0x86: '\u2020', 0x87: '\u2021', 0x88: '\u02C6', 0x89: '\u2030', 0x8A: '\u0160',
    0x8B: '\u2039', 0x8C: '\u0152', 0x8E: '\u017D', 0x91: '\u2018', 0x92: '\u2019',
    0x93: '\u201C', 0x94: '\u201D', 0x95: '\u2022', 0x96: '\u2013', 0x97: '\u2014',
    0x98: '\u02DC', 0x99: '\u2122', 0x9A: '\u0161', 0x9B: '\u203A', 0x9C: '\u0153',
    0x9E: '\u017E', 0x9F: '\u0178',
  };
  for (const [b, c] of Object.entries(special)) toChar[+b] = c;
  const toByte = {};
  for (const [b, c] of Object.entries(toChar)) toByte[c] = +b;
  return { toChar, toByte };
}

const { toByte } = cp1252Table();
const SIGNATURE = /[\u00C2\u00C3\u00E2\u20AC\u201A\u201E\u00F0\u0178\u00E3\u2020\u2122]/;

function reviveLine(line) {
  let cur = line;
  for (let pass = 0; pass < 3; pass++) {
    if (!SIGNATURE.test(cur)) return cur;
    const bytes = Buffer.alloc(cur.length);
    let ok = true;
    for (let i = 0; i < cur.length; i++) {
      const b = toByte[cur[i]];
      if (b === undefined) { ok = false; break; }
      bytes[i] = b;
    }
    if (!ok) return cur;
    let out;
    try { out = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return cur; }
    cur = out;
    if (!SIGNATURE.test(cur)) return cur;
  }
  return cur;
}

function walk(dir, ext, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, acc);
    else if (ext.some(x => p.endsWith(x))) acc.push(p);
  }
  return acc;
}

const root = path.join(__dirname, '..', 'src');
const files = walk(root, ['.tsx', '.ts', '.css', '.md'], []);
let fixed = 0, changedFiles = 0;
for (const f of files) {
  const buf = fs.readFileSync(f);
  const text = buf.toString('utf8');
  const lines = text.split(/\r?\n/);
  let dirty = false;
  const out = lines.map((ln, i) => {
    if (!SIGNATURE.test(ln)) return ln;
    const revived = reviveLine(ln);
    if (revived !== ln) { dirty = true; }
    return revived;
  });
  if (dirty) {
    const newline = text.includes('\r\n') ? '\r\n' : '\n';
    fs.writeFileSync(f, out.join(newline));
    changedFiles++;
  }
}
console.log('fixed files:', changedFiles);