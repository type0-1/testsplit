import { ServiceRequirement } from '../detector/LifecycleDetector';

/**
 * Converts detected ServiceRequirements into a GitHub Actions `services:` block.
 * Returns undefined if there are no service requirements.
 */
export function buildGitHubServices(
  requirements: ServiceRequirement[],
): Record<string, unknown> | undefined {
  if (requirements.length === 0) return undefined;

  const services: Record<string, unknown> = {};

  for (const req of requirements) {
    const entry: Record<string, unknown> = { image: req.image };
    if (req.ports && req.ports.length > 0) entry.ports = req.ports;
    if (req.env && Object.keys(req.env).length > 0) entry.env = req.env;
    services[req.type] = entry;
  }

  return services;
}

/**
 * Converts detected ServiceRequirements into a GitLab CI `services:` array.
 * Returns undefined if there are no service requirements.
 */
export function buildGitLabServices(requirements: ServiceRequirement[]): string[] | undefined {
  if (requirements.length === 0) return undefined;
  return requirements.map((r) => r.image);
}

/**
 * Generates a GitHub Actions step that starts docker compose services.
 */
export function buildDockerComposeStartStep(): Record<string, unknown> {
  return {
    name: 'Start services',
    run: 'docker compose up -d\ndocker compose wait --no-deps 2>/dev/null || sleep 5',
  };
}

/**
 * Generates a GitHub Actions step that tears down docker compose services.
 */
export function buildDockerComposeStopStep(): Record<string, unknown> {
  return {
    name: 'Stop services',
    if: 'always()',
    run: 'docker compose down',
  };
}

/**
 * GitLab CI before_script lines to start docker compose services.
 */
export function buildDockerComposeBeforeScript(): string[] {
  return ['docker compose up -d', 'sleep 5'];
}
