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

  it('omits ports block when ports array is empty', () => {
    const reqWithEmptyPorts: ServiceRequirement = {
      type: 'redis',
      image: 'redis:7',
      source: 'testcontainers',
      ports: [],
      env: { PASSWORD: 'secret' },
    };
    const result = buildGitHubServices([reqWithEmptyPorts]);
    expect(result!['redis'].ports).toBeUndefined();
    expect(result!['redis'].env).toBeDefined();
  });

  it('omits ports block when ports is undefined', () => {
    const reqWithoutPorts: ServiceRequirement = {
      type: 'mongo',
      image: 'mongo:6',
      source: 'testcontainers',
      env: { MONGO_INITDB_ROOT_PASSWORD: 'test' },
    };
    const result = buildGitHubServices([reqWithoutPorts]);
    expect(result!['mongo'].ports).toBeUndefined();
    expect(result!['mongo'].image).toBe('mongo:6');
  });

  it('always includes image property in entry', () => {
    const reqMinimal: ServiceRequirement = {
      type: 'redis',
      image: 'redis:7',
      source: 'testcontainers',
    };
    const result = buildGitHubServices([reqMinimal]);
    expect(result!['redis'].image).toBe('redis:7');
  });

  it('uses req.type as the service key', () => {
    const result = buildGitHubServices([pgReq]);
    expect(Object.keys(result!)).toContain('postgres');
    expect(result!['postgres']).toBeDefined();
  });

  it('handles multiple services with different properties', () => {
    const mysqlReq: ServiceRequirement = {
      type: 'mysql',
      image: 'mysql:8',
      source: 'testcontainers',
      ports: ['3306:3306'],
      env: { MYSQL_ROOT_PASSWORD: 'secret' },
    };
    const result = buildGitHubServices([pgReq, kafkaReq, mysqlReq]);
    expect(Object.keys(result!)).toHaveLength(3);
    expect(result!['postgres'].ports).toContain('5432:5432');
    expect(result!['kafka'].ports).toContain('9092:9092');
    expect(result!['mysql'].env).toBeDefined();
  });

  it('includes all ports when multiple ports are provided', () => {
    const reqMultiplePorts: ServiceRequirement = {
      type: 'kafka',
      image: 'confluentinc/cp-kafka:7.4.0',
      source: 'testcontainers',
      ports: ['9092:9092', '29092:29092'],
      env: { KAFKA_ADVERTISED_LISTENERS: 'value' },
    };
    const result = buildGitHubServices([reqMultiplePorts]);
    expect(result!['kafka'].ports).toEqual(['9092:9092', '29092:29092']);
  });

  it('includes all env entries when multiple env vars are provided', () => {
    const reqMultipleEnv: ServiceRequirement = {
      type: 'postgres',
      image: 'postgres:15',
      source: 'testcontainers',
      ports: ['5432:5432'],
      env: { POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'mydb', POSTGRES_USER: 'admin' },
    };
    const result = buildGitHubServices([reqMultipleEnv]);
    expect(Object.keys(result!['postgres'].env)).toHaveLength(3);
    expect(result!['postgres'].env.POSTGRES_PASSWORD).toBe('test');
    expect(result!['postgres'].env.POSTGRES_DB).toBe('mydb');
    expect(result!['postgres'].env.POSTGRES_USER).toBe('admin');
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
