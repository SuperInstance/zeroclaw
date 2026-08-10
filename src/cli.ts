/**
 * ZeroClaw — CLI Interface
 *
 * Usage:
 *   npx tsx src/cli.ts spawn   [--name <name>]
 *   npx tsx src/cli.ts cycle   [--id <claw-id>] [--input <text>]
 *   npx tsx src/cli.ts inspect [--id <claw-id>]
 *   npx tsx src/cli.ts list
 *   npx tsx src/cli.ts promote --id <claw-id> --name <new-name>
 *   npx tsx src/cli.ts demo
 */

import { ZeroClawLifecycle } from './lifecycle.js';
import * as path from 'path';

async function cli() {
  const [command, ...args] = process.argv.slice(2);
  const root = path.resolve(process.env.ZEROCLAW_ROOT || './sandboxes');
  const lifecycle = new ZeroClawLifecycle(root);

  const opts: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
      opts[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }

  switch (command) {
    case 'spawn': {
      const claw = await lifecycle.spawn(opts.name ? { name: opts.name } : undefined);
      console.log(`Spawned: ${claw.name} (${claw.id})`);
      console.log(`Folder: ${claw.folder}`);
      break;
    }

    case 'cycle': {
      const id = opts.id;
      if (!id) { console.error('--id required'); process.exit(1); }
      await lifecycle.load(id);
      const obs = opts.input ? {
        type: 'message' as const,
        content: opts.input,
        source: 'cli',
        timestamp: new Date().toISOString(),
      } : undefined;
      const result = await lifecycle.cycle(id, obs);
      console.log(`Cycle complete: ${JSON.stringify(result, null, 2)}`);
      break;
    }

    case 'inspect': {
      const id = opts.id;
      if (!id) { console.error('--id required'); process.exit(1); }
      await lifecycle.load(id);
      console.log(lifecycle.summary(id));
      break;
    }

    case 'list': {
      const { promises: fs } = await import('fs');
      try {
        const entries = await fs.readdir(path.join(root, 'sandboxes'), { withFileTypes: true });
        const dirs = entries.filter(e => e.isDirectory());
        if (dirs.length === 0) {
          console.log('No ZeroClaws found.');
          break;
        }
        for (const dir of dirs) {
          try {
            const state = JSON.parse(
              await fs.readFile(path.join(root, 'sandboxes', dir.name, 'state.json'), 'utf-8')
            );
            console.log(`${state.name} (${state.id}) — age ${state.age}, tiles ${state.tileCount}, model ${state.model}`);
          } catch {
            console.log(`${dir.name} — (no state)`);
          }
        }
      } catch {
        console.log('No sandboxes directory found.');
      }
      break;
    }

    case 'promote': {
      const id = opts.id;
      const name = opts.name;
      if (!id || !name) { console.error('--id and --name required'); process.exit(1); }
      await lifecycle.load(id);
      const claw = await lifecycle.promote(id, name);
      console.log(`Promoted: ${claw.name} (${claw.id})`);
      break;
    }

    case 'demo': {
      await import('./main.js');
      break;
    }

    default:
      console.log('ZeroClaw CLI');
      console.log('Commands: spawn, cycle, inspect, list, promote, demo');
  }
}

cli().catch(console.error);
