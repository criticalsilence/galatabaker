import { runMain } from './main.js';

runMain().then(
  (r) => {
    // eslint-disable-next-line no-console
    console.log('[indexer] exit', r);
    process.exit(0);
  },
  (e) => {
    console.error('[indexer] fatal', e);
    process.exit(1);
  },
);
