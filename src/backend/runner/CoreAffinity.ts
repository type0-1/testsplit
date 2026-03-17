import { platform } from 'os';

type CurrentLoadResult = {
  cpus: Array<{ load: number }>;
};

type SystemInformationLike = {
  currentLoad: () => Promise<CurrentLoadResult>;
};

function loadSystemInformation(): SystemInformationLike | null {
  try {
    return require('systeminformation') as SystemInformationLike;
  } catch {
    return null;
  }
}

/**
 * References:
 * https://www.npmjs.com/package/systeminformation - per-core CPU load via si.currentLoad()
 * https://man7.org/linux/man-pages/man1/taskset.1.html - taskset -c <core> <cmd> pins a process to a CPU core
 */

export interface CoreLoad {
  index: number;
  load: number;
}

/**
 * Returns the indices of the N least-loaded CPU cores, sorted by ascending load and falls back to cores 0,1,..,N-1 if 
 * systeminformation fails
 */

export async function getLeastLoadedCores(count: number): Promise<number[]> {
  try {
    const si = loadSystemInformation();
    if (!si) {
      return Array.from({ length: count }, (_, i) => i);
    }

    const load = await si.currentLoad();
    const sorted: CoreLoad[] = load.cpus
      .map((cpu: { load: number }, index: number) => ({ index, load: cpu.load }))
      .sort((a: CoreLoad, b: CoreLoad) => a.load - b.load);
    return sorted.slice(0, count).map((c) => c.index);
  } catch {
    return Array.from({ length: count }, (_, i) => i);
  }
}

/**
 * On Linux, wraps cmd with taskset -c <coreId> to pin the process to a specific core.
 * On macOS/Windows, returns cmd unchanged (no equivalent CLI tool).
 */
export function wrapWithAffinity(cmd: string, coreId: number): string {
  if (platform() === 'linux') {
    return `taskset -c ${coreId} ${cmd}`;
  }
  return cmd;
}
