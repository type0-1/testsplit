import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const TS_NODE = path.resolve(PROJECT_ROOT, 'node_modules/.bin/ts-node');
const CLI_PATH = path.resolve(PROJECT_ROOT, 'src/backend/cli/cli.ts');
const POM_FIXTURE = path.resolve(PROJECT_ROOT, '__tests__/backend/unit/detector/fixtures/pom-compiler-plugin.xml');
const POM_PROPERTIES_FIXTURE = path.resolve(PROJECT_ROOT, '__tests__/backend/unit/detector/fixtures/pom-properties.xml');
const POM_MINIMAL_FIXTURE = path.resolve(PROJECT_ROOT, '__tests__/backend/unit/detector/fixtures/pom-minimal.xml');

const SPAWN_OPTS = { encoding: 'utf-8' as const, cwd: PROJECT_ROOT };

jest.setTimeout(300_000);

describe('generate-dockerfile CLI integration', () => {
  test('generates Dockerfile with Java version from pom.xml compiler plugin', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testsplit-dockerfile-'));
    const outPath = path.join(tempDir, 'Dockerfile');

    try {
      const result = spawnSync(
        TS_NODE,
        ['--transpile-only', CLI_PATH, 'generate-dockerfile', '--pom', POM_FIXTURE, '--out', outPath],
        SPAWN_OPTS,
      );

      if (result.status !== 0) console.error('CLI stderr:', result.stderr);
      expect(result.status).toBe(0);

      const content = fs.readFileSync(outPath, 'utf-8');
      expect(content).toContain('FROM eclipse-temurin:17-jdk');
      expect(content).toContain('COPY pom.xml .');
      expect(content).toContain('dependency:go-offline');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('generates Dockerfile with java.version property from pom.xml', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testsplit-dockerfile-'));
    const outPath = path.join(tempDir, 'Dockerfile');

    try {
      const result = spawnSync(
        TS_NODE,
        ['--transpile-only', CLI_PATH, 'generate-dockerfile', '--pom', POM_PROPERTIES_FIXTURE, '--out', outPath],
        SPAWN_OPTS,
      );

      expect(result.status).toBe(0);

      const content = fs.readFileSync(outPath, 'utf-8');
      expect(content).toContain('FROM eclipse-temurin:21-jdk');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('defaults to Java 21 when pom has no version', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testsplit-dockerfile-'));
    const outPath = path.join(tempDir, 'Dockerfile');

    try {
      const result = spawnSync(
        TS_NODE,
        ['--transpile-only', CLI_PATH, 'generate-dockerfile', '--pom', POM_MINIMAL_FIXTURE, '--out', outPath],
        SPAWN_OPTS,
      );

      expect(result.status).toBe(0);

      const content = fs.readFileSync(outPath, 'utf-8');
      expect(content).toContain('FROM eclipse-temurin:21-jdk');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('uses mvn (not ./mvnw) when no mvnw file exists in project root', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testsplit-dockerfile-'));
    const outPath = path.join(tempDir, 'Dockerfile');

    try {
      const result = spawnSync(
        TS_NODE,
        ['--transpile-only', CLI_PATH, 'generate-dockerfile', '--pom', POM_MINIMAL_FIXTURE, '--out', outPath],
        SPAWN_OPTS,
      );

      expect(result.status).toBe(0);

      const content = fs.readFileSync(outPath, 'utf-8');
      expect(content).toContain('RUN mvn dependency:go-offline');
      expect(content).toContain('RUN mvn package -DskipTests');
      expect(content).not.toContain('./mvnw');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
