#!/usr/bin/env node
// Wrapper to run the ES module rank script for environments expecting .js
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const target = path.join(__dirname, 'compute_ranks.mjs');

try{
  execFileSync(process.execPath, [target], { stdio: 'inherit', env: process.env });
}catch(e){
  process.exit(e.status || 1);
}
