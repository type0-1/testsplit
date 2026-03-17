import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { inspectProjectTestCommandFormat } from '../../../../src/backend/generator/ProjectInspection';

describe('ProjectInspection', () => {
  function createTempProject(files: string[]): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'testsplit-project-inspect-'));
    for (const file of files) {
      fs.writeFileSync(path.join(dir, file), '', 'utf-8');
    }
    return dir;
  }

  it('detects Maven from pom.xml', () => {
    const projectRoot = createTempProject(['pom.xml']);

    try {
      const format = inspectProjectTestCommandFormat({ projectRoot, mavenBin: './mvnw' });

      expect(format.tool).toBe('maven');
      expect(format.buildCommand(['TestA', 'TestB'])).toBe('./mvnw test -Dtest=TestA,TestB');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('detects Gradle from build.gradle', () => {
    const projectRoot = createTempProject(['build.gradle']);

    try {
      const format = inspectProjectTestCommandFormat({ projectRoot });

      expect(format.tool).toBe('gradle');
      expect(format.buildCommand(['pkg.ClassA', 'pkg.ClassB'])).toBe(
        'gradle test --tests pkg.ClassA --tests pkg.ClassB',
      );
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('detects npm from package.json', () => {
    const projectRoot = createTempProject(['package.json']);

    try {
      const format = inspectProjectTestCommandFormat({ projectRoot });

      expect(format.tool).toBe('npm');
      expect(format.buildCommand(['A.test.ts', 'B.test.ts'])).toBe('npm test -- A.test.ts B.test.ts');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('falls back to Maven when no known build file exists', () => {
    const projectRoot = createTempProject([]);

    try {
      const format = inspectProjectTestCommandFormat({ projectRoot });

      expect(format.tool).toBe('maven');
      expect(format.buildCommand(['OnlyTest'])).toBe('mvn test -Dtest=OnlyTest');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
