import * as fs from 'fs';
import * as path from 'path';

export type ServiceType = 'postgres' | 'mysql' | 'kafka' | 'mongo' | 'redis' | 'compose';

export interface ServiceRequirement {
  type: ServiceType;
  image: string;
  source: 'testcontainers' | 'spring' | 'compose';
  ports?: string[];
  env?: Record<string, string>;
}

// Known Testcontainers class, canonical service definition
const TESTCONTAINERS_MAP: Record<string, Omit<ServiceRequirement, 'source'>> = {
  PostgreSQLContainer: {
    type: 'postgres',
    image: 'postgres:15',
    ports: ['5432:5432'],
    env: { POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'testdb' },
  },
  MySQLContainer: {
    type: 'mysql',
    image: 'mysql:8',
    ports: ['3306:3306'],
    env: { MYSQL_ROOT_PASSWORD: 'test', MYSQL_DATABASE: 'testdb' },
  },
  KafkaContainer: {
    type: 'kafka',
    image: 'confluentinc/cp-kafka:7.4.0',
    ports: ['9092:9092'],
    env: {},
  },
  MongoDBContainer: {
    type: 'mongo',
    image: 'mongo:6',
    ports: ['27017:27017'],
    env: {},
  },
  RedisContainer: {
    type: 'redis',
    image: 'redis:7',
    ports: ['6379:6379'],
    env: {},
  },
};

// Spring annotation → service definition
const SPRING_ANNOTATION_MAP: Record<string, Omit<ServiceRequirement, 'source'>> = {
  '@EmbeddedKafka': {
    type: 'kafka',
    image: 'confluentinc/cp-kafka:7.4.0',
    ports: ['9092:9092'],
    env: {},
  },
  '@DataJpaTest': {
    type: 'postgres',
    image: 'postgres:15',
    ports: ['5432:5432'],
    env: { POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'testdb' },
  },
  '@AutoConfigureTestDatabase': {
    type: 'postgres',
    image: 'postgres:15',
    ports: ['5432:5432'],
    env: { POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'testdb' },
  },
};

export interface LifecycleDetectionResult {
  requirements: ServiceRequirement[];
  hasDockerCompose: boolean;
}

/**
 * Scans the project for startup lifecycle requirements.
 * Detects: docker-compose.yml, Testcontainers usage, Spring service annotations.
 * Returns deduplicated ServiceRequirement[] ordered by type.
 */
export function detectLifecycle(projectRoot: string, srcRoot: string): LifecycleDetectionResult {
  const composePath = path.join(projectRoot, 'docker-compose.yml');
  const hasDockerCompose = fs.existsSync(composePath);

  const requirements = new Map<ServiceType, ServiceRequirement>();

  if (!hasDockerCompose) {
    const javaFiles = collectJavaFiles(srcRoot);

    for (const file of javaFiles) {
      const source = fs.readFileSync(file, 'utf-8');

      for (const req of detectTestcontainersFromSource(source)) {
        if (!requirements.has(req.type)) requirements.set(req.type, req);
      }

      for (const req of detectSpringAnnotationsFromSource(source)) {
        if (!requirements.has(req.type)) requirements.set(req.type, req);
      }
    }
  }

  return {
    requirements: [...requirements.values()],
    hasDockerCompose,
  };
}

export function detectTestcontainersFromSource(source: string): ServiceRequirement[] {
  if (!source.includes('Container')) return [];

  const found: ServiceRequirement[] = [];

  for (const [className, def] of Object.entries(TESTCONTAINERS_MAP)) {
    // Match: new PostgreSQLContainer or static field declaration
    if (new RegExp(`\\bnew\\s+${className}\\b|\\b${className}\\s*[<(]`).test(source)) {
      found.push({ ...def, source: 'testcontainers' });
    }
  }

  return found;
}

export function detectSpringAnnotationsFromSource(source: string): ServiceRequirement[] {
  if (!source.includes('@')) return [];

  const found: ServiceRequirement[] = [];

  for (const [annotation, def] of Object.entries(SPRING_ANNOTATION_MAP)) {
    if (source.includes(annotation)) {
      found.push({ ...def, source: 'spring' });
    }
  }

  return found;
}

function collectJavaFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectJavaFiles(full));
    } else if (entry.name.endsWith('.java')) {
      results.push(full);
    }
  }
  return results;
}
