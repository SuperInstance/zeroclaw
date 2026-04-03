// equipment.ts — "Guns Lots of Guns"
// Equipment is EXTERNAL: repos, libraries, APIs, tools. The agent MOUNTS equipment.

export interface Equipment {
  name: string;
  type: 'repo' | 'library' | 'api' | 'tool';
  mounted: boolean;
  mount: () => Promise<void>;
  unmount: () => Promise<void>;
  use: (action: string, params: any) => Promise<any>;
}

const registry = new Map<string, Equipment>();

export function registerEquipment(eq: Equipment): void {
  registry.set(eq.name, eq);
}

export function getEquipment(name: string): Equipment | undefined {
  return registry.get(name);
}

export function listEquipment(): Equipment[] {
  return Array.from(registry.values());
}

export function removeEquipment(name: string): boolean {
  return registry.delete(name);
}

export async function mountAll(): Promise<void> {
  for (const eq of registry.values()) {
    if (!eq.mounted) await eq.mount();
  }
}

export async function unmountAll(): Promise<void> {
  for (const eq of registry.values()) {
    if (eq.mounted) await eq.unmount();
  }
}

// Factory for simple equipment
export function createEquipment(config: {
  name: string;
  type: Equipment['type'];
  mount?: () => Promise<void>;
  unmount?: () => Promise<void>;
  handler: (action: string, params: any) => Promise<any>;
}): Equipment {
  return {
    name: config.name,
    type: config.type,
    mounted: false,
    mount: async () => { await config.mount?.(); config.mounted = true; },
    unmount: async () => { await config.unmount?.(); config.mounted = false; },
    use: config.handler,
  };
}
