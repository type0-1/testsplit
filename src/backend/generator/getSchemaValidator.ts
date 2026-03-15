import { CIPlatform, CISchemaValidator } from './CISchemaValidator';
import yaml from 'js-yaml';

function parseYaml(yamlText: string): Record<string, unknown> {
  const parsed = yaml.load(yamlText);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid CI schema: YAML root must be a mapping/object');
  }

  return parsed as Record<string, unknown>;
}

function validateGitHubSchema(yamlText: string): void {
  const config = parseYaml(yamlText);

  if (!('on' in config)) {
    throw new Error('GitHub Actions schema violation: missing top-level "on"');
  }

  if (!('jobs' in config)) {
    throw new Error('GitHub Actions schema violation: missing top-level "jobs"');
  }

  const jobs = config.jobs;
  if (!jobs || typeof jobs !== 'object' || Array.isArray(jobs)) {
    throw new Error('GitHub Actions schema violation: "jobs" must be an object');
  }

  if (Object.keys(jobs as Record<string, unknown>).length === 0) {
    throw new Error('GitHub Actions schema violation: "jobs" cannot be empty');
  }
}

function validateGitLabSchema(yamlText: string): void {
  const config = parseYaml(yamlText);

  if (!('stages' in config)) {
    throw new Error('GitLab CI schema violation: missing top-level "stages"');
  }

  const stages = config.stages;
  if (!Array.isArray(stages) || stages.length === 0) {
    throw new Error('GitLab CI schema violation: "stages" must be a non-empty array');
  }

  const hasJobWithScript = Object.entries(config).some(([key, value]) => {
    if (key === 'stages') {
      return false;
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const script = (value as Record<string, unknown>).script;

    if (typeof script === 'string') {
      return script.trim().length > 0;
    }

    if (Array.isArray(script)) {
      return script.length > 0;
    }

    return false;
  });

  if (!hasJobWithScript) {
    throw new Error(
      'GitLab CI schema violation: at least one job with "script" is required',
    );
  }
}

export function getSchemaValidator(
  _platform: CIPlatform,
): CISchemaValidator | null {
  if (platform === 'github') {
    return {
      validate(yamlText: string): void {
        validateGitHubSchema(yamlText);
      },
    };
  }

  if (platform === 'gitlab') {
    return {
      validate(yamlText: string): void {
        validateGitLabSchema(yamlText);
      },
    };
  }

  return null;
}
