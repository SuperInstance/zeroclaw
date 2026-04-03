// io.ts — Repo-native I/O: the repo IS the interface
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

export class IO {
  constructor(private repoRoot: string) {}

  async read(path: string): Promise<string> {
    return readFile(join(this.repoRoot, path), 'utf-8');
  }

  async write(path: string, content: string): Promise<void> {
    const full = join(this.repoRoot, path);
    const dir = full.substring(0, full.lastIndexOf('/'));
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    await writeFile(full, content, 'utf-8');
  }

  async exec(command: string): Promise<string> {
    try {
      return execSync(command, { cwd: this.repoRoot, timeout: 30000 }).toString().trim();
    } catch (e: any) {
      return `Error: ${e.message}`;
    }
  }

  async search(pattern: string): Promise<string> {
    return this.exec(`grep -rn "${pattern}" ${this.repoRoot} --include="*.ts" --include="*.md" --include="*.json" 2>/dev/null | head -50`);
  }

  async list(dir = '.'): Promise<string[]> {
    const entries = await readdir(join(this.repoRoot, dir), { withFileTypes: true });
    return entries.map(e => e.isDirectory() ? `${e.name}/` : e.name);
  }

  async gitCommit(message: string): Promise<void> {
    this.exec('git add -A');
    this.exec(`git commit -m "${message}" --allow-empty`);
  }

  get root(): string {
    return this.repoRoot;
  }
}
