import { workerData, parentPort, isMainThread } from 'worker_threads';

import { main } from './worker-utils.js';

if (isMainThread || !parentPort) {
  throw new Error('This module must be run as a worker.');
}

await main(workerData);
