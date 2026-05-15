const fs = require('fs');
const path = require('path');

const files = [
  'public/js/academy.js',
  'public/js/dashboard.js'
];

function log(msg) {
  console.log(msg);
}

for (const file of files) {
  const full = path.resolve(process.cwd(), file);

  log('');
  log('--- Checking: ' + file + ' ---');

  if (!fs.existsSync(full)) {
    log('[SKIP] File not found: ' + file);
    continue;
  }

  const backup = full + '.bak-20260514-async-async-v52';
  fs.copyFileSync(full, backup);
  log('[OK] Backup created: ' + path.relative(process.cwd(), backup));

  let src = fs.readFileSync(full, 'utf8');

  const before = (src.match(/async\s+async\s+function/g) || []).length;
  log('[INFO] async async function count before: ' + before);

  src = src.replace(/async\s+async\s+function/g, 'async function');

  const after = (src.match(/async\s+async\s+function/g) || []).length;
  log('[INFO] async async function count after: ' + after);

  fs.writeFileSync(full, src);
  log('[OK] Saved fixed file: ' + file);
}

log('');
log('==================================================');
log('NODE REPAIR SCRIPT FINISHED');
log('==================================================');
