import * as path from 'path';
import {
  detectTestcontainersFromSource,
  detectSpringAnnotationsFromSource,
  detectLifecycle,
} from '../../../../src/backend/detector/LifecycleDetector';

const JAVA_FIXTURES = path.resolve(__dirname, 'fixtures/java');

describe('detectTestcontainersFromSource', () => {
  it('returns empty array when no Container classes referenced', () => {
    const source = `public class Foo { @Test void bar() {} }`;
    expect(detectTestcontainersFromSource(source)).toHaveLength(0);
  });

  it('detects PostgreSQLContainer from new expression', () => {
    const source = `
      static PostgreSQLContainer<?> db = new PostgreSQLContainer<>("postgres:15");
    `;
    const result = detectTestcontainersFromSource(source);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('postgres');
    expect(result[0].source).toBe('testcontainers');
    expect(result[0].image).toContain('postgres');
  });

  it('detects KafkaContainer', () => {
    const source = `new KafkaContainer("confluentinc/cp-kafka:7.4.0");`;
    const result = detectTestcontainersFromSource(source);
    expect(result.find((r) => r.type === 'kafka')).toBeDefined();
  });

  it('detects multiple containers from one file', () => {
    const source = `
      new PostgreSQLContainer<>("postgres:15");
      new KafkaContainer("cp-kafka");
      new MongoDBContainer("mongo:6");
    `;
    const result = detectTestcontainersFromSource(source);
    const types = result.map((r) => r.type);
    expect(types).toContain('postgres');
    expect(types).toContain('kafka');
    expect(types).toContain('mongo');
  });

  it('detects RedisContainer and MySQLContainer', () => {
    const source = `new RedisContainer(); new MySQLContainer();`;
    const result = detectTestcontainersFromSource(source);
    expect(result.find((r) => r.type === 'redis')).toBeDefined();
    expect(result.find((r) => r.type === 'mysql')).toBeDefined();
  });

  it('includes port mappings in detected requirements', () => {
    const source = `new PostgreSQLContainer<>("postgres:15");`;
    const result = detectTestcontainersFromSource(source);
    expect(result[0].ports).toContain('5432:5432');
  });
});

describe('detectSpringAnnotationsFromSource', () => {
  it('returns empty array when no Spring annotations present', () => {
    const source = `@Test public void foo() {}`;
    expect(detectSpringAnnotationsFromSource(source)).toHaveLength(0);
  });

  it('detects @EmbeddedKafka', () => {
    const source = `@EmbeddedKafka(partitions = 1) public class MyTest {}`;
    const result = detectSpringAnnotationsFromSource(source);
    expect(result.find((r) => r.type === 'kafka')).toBeDefined();
    expect(result[0].source).toBe('spring');
  });

  it('detects @DataJpaTest', () => {
    const source = `@DataJpaTest public class RepoTest {}`;
    const result = detectSpringAnnotationsFromSource(source);
    expect(result.find((r) => r.type === 'postgres')).toBeDefined();
  });

  it('detects @AutoConfigureTestDatabase', () => {
    const source = `@AutoConfigureTestDatabase(replace = Replace.NONE) class MyTest {}`;
    const result = detectSpringAnnotationsFromSource(source);
    expect(result.find((r) => r.type === 'postgres')).toBeDefined();
  });
});

describe('detectLifecycle', () => {
  it('detects Testcontainers from Java fixture files', () => {
    const result = detectLifecycle(path.resolve(__dirname, 'fixtures'), JAVA_FIXTURES);
    const types = result.requirements.map((r) => r.type);
    expect(types).toContain('postgres');
    expect(types).toContain('kafka');
  });

  it('deduplicates same service type from multiple files', () => {
    // Both TestcontainersTest (postgres+kafka) and SpringKafkaTest (@EmbeddedKafka kafka) are in fixtures
    // kafka should appear only once
    const result = detectLifecycle(path.resolve(__dirname, 'fixtures'), JAVA_FIXTURES);
    const kafkaCount = result.requirements.filter((r) => r.type === 'kafka').length;
    expect(kafkaCount).toBe(1);
  });

  it('sets hasDockerCompose=false when no docker-compose.yml in project root', () => {
    const result = detectLifecycle(path.resolve(__dirname, 'fixtures'), JAVA_FIXTURES);
    expect(result.hasDockerCompose).toBe(false);
  });

  it('returns empty requirements when srcRoot does not exist', () => {
    const result = detectLifecycle(path.resolve(__dirname, 'fixtures'), '/nonexistent/src');
    expect(result.requirements).toHaveLength(0);
  });
});
