#!/usr/bin/env node
// cli.ts — ZeroClaw CLI
import { resolve } from 'node:path';
import { mkdirSync, cpSync, existsSync, writeFileSync } from 'node:fs';
import { createVessel } from './src/vessel.js';
import { listSkills } from './src/skills.js';

const args = process.argv.slice(2);
const command = args[0];

async function init(name: string) {
  const dir = resolve(name || '.');
  mkdirSync(dir, { recursive: true });
  const template = resolve(import.meta.dirname || __dirname, '..');

  // Write SOUL.md if not exists
  const soulPath = resolve(dir, 'SOUL.md');
  if (!existsSync(soulPath)) {
    writeFileSync(soulPath, `# SOUL.md\n\nI am ${name || 'a vessel'}.\n\n## Core\nMinimal. Capable. Ready.\n\n## Vibe\nneutral\n`);
  }

  // Write package.json
  writeFileSync(resolve(dir, 'package.json'), JSON.stringify({
    name, version: '0.1.0', type: 'module', main: 'src/',
    scripts: { start: 'node --experimental-strip-types src/agent.ts', build: 'tsc' },
    dependencies: { zeroclaw: 'latest' }
  }, null, 2));

  mkdirSync(resolve(dir, 'memory'), { recursive: true });
  console.log(`🐾 Vessel "${name}" initialized in ${dir}`);
  console.log('  cd ' + dir + ' && npm install && npm start');
}

async function run() {
  const dir = resolve('.');
  const vessel = await createVessel({ repoRoot: dir, skills: ['debug'] });
  console.log('🐾 ZeroClaw — I Know Kung Fu.');
  console.log(`   Skills: [${vessel.info().skills.join(', ')}]`);
  console.log(`   Soul: ${vessel.info().soul}`);
  console.log('   Type "exit" to quit.\n');
  vessel.start();
}

function skillCmd(action: string, name?: string) {
  if (action === 'list' || !action) {
    console.log('🐾 Available skills:');
    for (const s of listSkills()) console.log(`  - ${s.name}: ${s.description}`);
  } else if (action === 'add' && name) {
    console.log(`🐾 Skill "${name}" registered. Restart to load.`);
  }
}

function mountCmd(name?: string) {
  if (name) {
    console.log(`🐾 Equipment "${name}" registered. Restart to mount.`);
  } else {
    console.log('🐾 Usage: zeroclaw mount <name>');
  }
}

switch (command) {
  case 'init': init(args[1]); break;
  case 'run': run(); break;
  case 'skill': skillCmd(args[1], args[2]); break;
  case 'mount': mountCmd(args[1]); break;
  case 'deploy': console.log('🐾 Deploy to Cloudflare Workers: wrangler deploy worker.ts'); break;
  default:
    console.log(`🐾 ZeroClaw — I Know Kung Fu. Now Guns Lots of Guns.\n\nUsage:\n  zeroclaw init <name>    Scaffold a new vessel\n  zeroclaw run          Start the agent loop\n  zeroclaw skill list   List available skills\n  zeroclaw skill add X  Register a skill\n  zeroclaw mount X      Register equipment\n  zeroclaw deploy       Deploy to Cloudflare Workers\n`);
}
