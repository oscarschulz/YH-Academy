const fs = require('fs');
const path = require('path');

function echo(msg = '') {
  console.log(msg);
}

function ok(msg = '') {
  console.log('[OK] ' + msg);
}

function warn(msg = '') {
  console.log('[WARN] ' + msg);
}

function fixFile(file) {
  const full = path.resolve(process.cwd(), file);

  echo('');
  echo('--- Checking ' + file + ' ---');

  if (!fs.existsSync(full)) {
    warn(file + ' not found. Skipping.');
    return;
  }

  const backup = full + '.bak-20260514-duplicate-async-v51';
  fs.copyFileSync(full, backup);
  ok('Backup created: ' + path.relative(process.cwd(), backup));

  let src = fs.readFileSync(full, 'utf8');
  const before = src;

  const beforeCount = (src.match(/\basync\s+async\s+function\b/g) || []).length;
  echo('[INFO] duplicate "async async function" count before: ' + beforeCount);

  // Fix repeated async before normal function declarations.
  while (/\basync\s+async\s+function\b/.test(src)) {
    src = src.replace(/\basync\s+async\s+function\b/g, 'async function');
  }

  // Extra safety for accidental triple async.
  while (/\basync\s+async\s+async\s+function\b/.test(src)) {
    src = src.replace(/\basync\s+async\s+async\s+function\b/g, 'async function');
  }

  const afterCount = (src.match(/\basync\s+async\s+function\b/g) || []).length;
  echo('[INFO] duplicate "async async function" count after: ' + afterCount);

  if (src !== before) {
    fs.writeFileSync(full, src);
    ok('Fixed duplicate async in ' + file);
  } else {
    ok('No duplicate async found in ' + file);
  }

  const remainingIndex = src.indexOf('async async');
  if (remainingIndex >= 0) {
    warn('There is still an "async async" pattern in ' + file + ' near index ' + remainingIndex);
    echo(src.slice(Math.max(0, remainingIndex - 120), remainingIndex + 220));
  }
}

fixFile('public/js/academy.js');
fixFile('public/js/dashboard.js');

echo('');
echo('==================================================');
echo('DUPLICATE ASYNC FIX SCRIPT FINISHED');
echo('==================================================');
