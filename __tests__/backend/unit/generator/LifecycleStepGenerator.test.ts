import {
  buildGitHubServices,
  buildGitLabServices,
  buildDockerComposeStartStep,
  buildDockerComposeStopStep,
  buildDockerComposeBeforeScript,
} from '../../../../src/backend/generator/LifecycleStepGenerator';
import { ServiceRequirement } from '../../../../src/backend/detector/LifecycleDetector';

const pgReq: ServiceRequirement = {
  type: 'postgres',
  image: 'postgres:15',
  source: 'testcontainers',
  ports: ['5432:5432'],
  env: { POSTGRES_PASSWORD: 'test' },
};

const kafkaReq: ServiceRequirement = {
  type: 'kafka',
  image: 'confluentinc/cp-kafka:7.4.0',
  source: 'testcontainers',
  ports: ['9092:9092'],
  env: {},
};

describe('buildGitHubServices', () => {
  it('returns undefined for empty requirements', () => {
    expect(buildGitHubServices([])).toBeUndefined();
  });

  it('produces a services block keyed by service type', () => {
    const result = buildGitHubServices([pgReq]);
    expect(result).toBeDefined();
    expect(result!['postgres']).toBeDefined();
    expect(result!['postgres'].image).toBe('postgres:15');
  });

  it('includes ports in the services block', () => {
    const result = buildGitHubServices([pgReq]);
    expect(result!['postgres'].ports).toContain('5432:5432');
  });

  it('includes env vars in the services block', () => {
    const result = buildGitHubServices([pgReq]);
    expect(result!['postgres'].env.POSTGRES_PASSWORD).toBe('test');
  });

  it('omits env block when env is empty', () => {
    const result = buildGitHubServices([kafkaReq]);
    expect(result!['kafka'].env).toBeUndefined();
  });

  it('handles multiple services', () => {
    const result = buildGitHubServices([pgReq, kafkaReq]);
    expect(Object.keys(result!)).toEqual(['postgres', 'kafka']);
  });
});

describe('buildGitLabServices', () => {
  it('returns undefined for empty requirements', () => {
    expect(buildGitLabServices([])).toBeUndefined();
  });

  it('returns array of image strings', () => {
    const result = buildGitLabServices([pgReq, kafkaReq]);
    expect(result).toEqual(['postgres:15', 'confluentinc/cp-kafka:7.4.0']);
  });
});

describe('buildDockerComposeStartStep', () => {
  it('produces a step named "Start services"', () => {
    const step = buildDockerComposeStartStep();
    expect(step.name).toBe('Start services');
    expect(step.run).toContain('docker compose up -d');
  });
});

describe('buildDockerComposeStopStep', () => {
  it('produces a step with always() condition', () => {
    const step = buildDockerComposeStopStep();
    expect(step.name).toBe('Stop services');
    expect(step.if).toBe('always()');
    expect(step.run).toContain('docker compose down');
  });
});

describe('buildDockerComposeBeforeScript', () => {
  it('includes docker compose up -d', () => {
    const lines = buildDockerComposeBeforeScript();
    expect(lines.some((l) => l.includes('docker compose up -d'))).toBe(true);
  });
});
