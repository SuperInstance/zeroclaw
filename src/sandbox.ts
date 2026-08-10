/**
 * ZeroClaw — Sandbox System
 *
 * Sandboxes are isolated folders where ZeroClaws grow.
 * Each sandbox has:
 *   - Limited filesystem access (only their own folder)
 *   - Read access to shared resources (The Tap, wiki, public repos)
 *   - Write access only to their own folder
 *   - API budget (starts small, grows with usefulness)
 *   - Model budget (starts with rules-only, upgrades with age)
 *
 * The sandbox IS the hermit crab's shell.
 * It starts small. When the crab grows, the shell grows.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import type { SandboxConfig, ModelTier } from './types.js';
import { MODEL_PROGRESSION } from './types.js';

const SANDBOX_DEFAULTS = {
  initialStorageMB: 10,
  initialRequestsPerHour: 10,
  initialTokensPerDay: 1000,
};

export class Sandbox {
  readonly config: SandboxConfig;

  constructor(config: SandboxConfig) {
    this.config = config;
  }

  static async create(rootPath: string, clawId: string): Promise<Sandbox> {
    const sandboxPath = path.join(rootPath, clawId);

    await fs.mkdir(path.join(sandboxPath, 'memory'), { recursive: true });
    await fs.mkdir(path.join(sandboxPath, 'tiles'), { recursive: true });
    await fs.mkdir(path.join(sandboxPath, 'journal'), { recursive: true });
    await fs.mkdir(path.join(sandboxPath, 'creative'), { recursive: true });

    const config: SandboxConfig = {
      path: sandboxPath,
      apiBudget: {
        requestsPerHour: SANDBOX_DEFAULTS.initialRequestsPerHour,
        tokensPerDay: SANDBOX_DEFAULTS.initialTokensPerDay,
        tokensUsedToday: 0,
        requestsThisHour: 0,
      },
      modelAccess: ['rules'],
      maxStorageMB: SANDBOX_DEFAULTS.initialStorageMB,
      isolated: true,
    };

    return new Sandbox(config);
  }

  isWithinSandbox(targetPath: string): boolean {
    const resolved = path.resolve(targetPath);
    const sandboxResolved = path.resolve(this.config.path);
    return resolved.startsWith(sandboxResolved);
  }

  validateWrite(targetPath: string): void {
    if (this.config.isolated && !this.isWithinSandbox(targetPath)) {
      throw new Error(
        `Sandbox isolation violation: ZeroClaw cannot write to ${targetPath}. ` +
        `Sandbox is limited to ${this.config.path}`
      );
    }
  }

  hasApiBudget(): boolean {
    const budget = this.config.apiBudget;
    return (
      budget.requestsThisHour < budget.requestsPerHour &&
      budget.tokensUsedToday < budget.tokensPerDay
    );
  }

  consumeBudget(tokensUsed: number): void {
    this.config.apiBudget.requestsThisHour++;
    this.config.apiBudget.tokensUsedToday += tokensUsed;
  }

  resetBudget(period: 'hourly' | 'daily'): void {
    if (period === 'hourly') {
      this.config.apiBudget.requestsThisHour = 0;
    } else {
      this.config.apiBudget.tokensUsedToday = 0;
    }
  }

  grow(params: {
    requestsPerHour?: number;
    tokensPerDay?: number;
    maxStorageMB?: number;
    newModels?: ModelTier[];
  }): void {
    if (params.requestsPerHour) {
      this.config.apiBudget.requestsPerHour = params.requestsPerHour;
    }
    if (params.tokensPerDay) {
      this.config.apiBudget.tokensPerDay = params.tokensPerDay;
    }
    if (params.maxStorageMB) {
      this.config.maxStorageMB = params.maxStorageMB;
    }
    if (params.newModels) {
      for (const m of params.newModels) {
        if (!this.config.modelAccess.includes(m)) {
          this.config.modelAccess.push(m);
        }
      }
    }
  }

  async diskUsageBytes(): Promise<number> {
    return this.dirSize(this.config.path);
  }

  private async dirSize(dirPath: string): Promise<number> {
    let total = 0;
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          total += await this.dirSize(fullPath);
        } else {
          const stat = await fs.stat(fullPath);
          total += stat.size;
        }
      }
    } catch {
      // Directory doesn't exist yet
    }
    return total;
  }

  canUseModel(tier: ModelTier): boolean {
    return this.config.modelAccess.includes(tier);
  }

  async archive(): Promise<string> {
    const archivePath = this.config.path + '.archived';
    try {
      await fs.rename(this.config.path, archivePath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }
    return archivePath;
  }

  async save(): Promise<void> {
    const configPath = path.join(this.config.path, 'sandbox.json');
    await fs.writeFile(configPath, JSON.stringify(this.config, null, 2) + '\n');
  }

  static async load(sandboxPath: string): Promise<Sandbox> {
    const configPath = path.join(sandboxPath, 'sandbox.json');
    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content) as SandboxConfig;
    return new Sandbox(config);
  }
}

export function tiersForAge(age: number): ModelTier[] {
  const tiers: ModelTier[] = ['rules'];
  if (age >= MODEL_PROGRESSION.ollama.minAge) tiers.push('ollama');
  if (age >= MODEL_PROGRESSION.deepinfra.minAge) tiers.push('deepinfra');
  if (age >= MODEL_PROGRESSION.deepseek.minAge) tiers.push('deepseek');
  if (age >= MODEL_PROGRESSION.named.minAge) tiers.push('named');
  return tiers;
}

export function bestTierForAge(age: number): ModelTier {
  if (age >= MODEL_PROGRESSION.named.minAge) return 'named';
  if (age >= MODEL_PROGRESSION.deepseek.minAge) return 'deepseek';
  if (age >= MODEL_PROGRESSION.deepinfra.minAge) return 'deepinfra';
  if (age >= MODEL_PROGRESSION.ollama.minAge) return 'ollama';
  return 'rules';
}
