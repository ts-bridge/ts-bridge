#!/usr/bin/env node
import { main } from './cli.js';

main(process.argv).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
