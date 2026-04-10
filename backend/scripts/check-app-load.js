/* eslint-disable no-console */
'use strict';

try {
  require('../src/app');
  console.log('app-ok');
} catch (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
}

