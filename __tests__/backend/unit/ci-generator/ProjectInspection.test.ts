import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { inspectProjectTestCommandFormat, inspectReportPath } from '../../../../src/backend/generator/ProjectInspection';

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

  it('detects Gradle from build.gradle.kts and supports empty assigned classes', () => {
    const projectRoot = createTempProject(['build.gradle.kts']);
    try {
      const format = inspectProjectTestCommandFormat({ projectRoot, gradleBin: './gradlew' });
      expect(format.tool).toBe('gradle');
      expect(format.buildCommand([])).toBe('./gradlew test');
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

  it('builds npm command without selectors when assigned classes are empty', () => {
    const projectRoot = createTempProject(['package.json']);
    try {
      const format = inspectProjectTestCommandFormat({ projectRoot });
      expect(format.tool).toBe('npm');
      expect(format.buildCommand([])).toBe('npm test');
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

  it('uses default options, current working directory, and default maven binary', () => {
    const projectRoot = createTempProject(['pom.xml']);
    const originalCwd = process.cwd();
    try {
      process.chdir(projectRoot);
      const format = inspectProjectTestCommandFormat();
      expect(format.tool).toBe('maven');
      expect(format.buildCommand(['SmokeTest'])).toBe('mvn test -Dtest=SmokeTest');
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('uses default gradle binary when gradle build file exists in current working directory', () => {
    const projectRoot = createTempProject(['build.gradle']);
    const originalCwd = process.cwd();
    try {
      process.chdir(projectRoot);
      const format = inspectProjectTestCommandFormat();
      expect(format.tool).toBe('gradle');
      expect(format.buildCommand(['pkg.ClassA'])).toBe('gradle test --tests pkg.ClassA');
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('respects explicit tool override, returning npm command for a Maven project root', () => {
    const projectRoot = createTempProject(['pom.xml']);
    try {
      const format = inspectProjectTestCommandFormat({ projectRoot, tool: 'npm' });
      expect(format.tool).toBe('npm');
      expect(format.buildCommand(['A.test.ts'])).toBe('npm test -- A.test.ts');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('respects explicit gradle tool override for a non-Gradle project root', () => {
    const projectRoot = createTempProject(['pom.xml']);
    try {
      const format = inspectProjectTestCommandFormat({ projectRoot, tool: 'gradle', gradleBin: './gradlew' });
      expect(format.tool).toBe('gradle');
      expect(format.buildCommand(['pkg.MyTest'])).toBe('./gradlew test --tests pkg.MyTest');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('falls back to maven command format for unsupported tool values at runtime', () => {
    const projectRoot = createTempProject(['package.json']);
    try {
      const format = inspectProjectTestCommandFormat({ projectRoot, tool: 'unknown' as any, mavenBin: './mvnw' });
      expect(format.tool).toBe('maven');
      expect(format.buildCommand(['SmokeTest'])).toBe('./mvnw test -Dtest=SmokeTest');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});

describe('inspectReportPath', () => {
  function createTempProject(files: string[], dirs: string[] = []): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'testsplit-report-path-'));
    for (const file of files) {
      fs.writeFileSync(path.join(dir, file), '', 'utf-8');
    }
    for (const d of dirs) {
      fs.mkdirSync(path.join(dir, d), { recursive: true });
    }
    return dir;
  }

  it('returns target/surefire-reports for Maven project', () => {
    const projectRoot = createTempProject(['pom.xml']);
    try {
      const result = inspectReportPath({ projectRoot });
      expect(result.tool).toBe('maven');
      expect(result.reportDirs).toEqual([path.join(projectRoot, 'target', 'surefire-reports')]);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('uses default options and process.cwd() when no arguments are provided', () => {
    const projectRoot = createTempProject(['package.json']);
    const originalCwd = process.cwd();
    try {
      process.chdir(projectRoot);
      const result = inspectReportPath();
      expect(result.tool).toBe('npm');
      expect(result.reportDirs).toEqual([path.join(process.cwd(), 'test-results')]);
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('returns build/test-results/test for single-module Gradle project when directory exists', () => {
    const projectRoot = createTempProject(
      ['build.gradle'],
      ['build/test-results/test'],
    );
    try {
      const result = inspectReportPath({ projectRoot });
      expect(result.tool).toBe('gradle');
      expect(result.reportDirs).toEqual([path.join(projectRoot, 'build', 'test-results', 'test')]);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('discovers submodule report dirs for multi-module Gradle project', () => {
    const projectRoot = createTempProject(
      ['build.gradle.kts'],
      ['core/build/test-results/test', 'api/build/test-results/test'],
    );
    try {
      const result = inspectReportPath({ projectRoot });
      expect(result.tool).toBe('gradle');
      expect(result.reportDirs).toHaveLength(2);
      expect(result.reportDirs).toContain(path.join(projectRoot, 'core', 'build', 'test-results', 'test'));
      expect(result.reportDirs).toContain(path.join(projectRoot, 'api', 'build', 'test-results', 'test'));
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('includes only submodules that contain Gradle report directories', () => {
    const projectRoot = createTempProject(
      ['build.gradle.kts'],
      ['core/build/test-results/test', 'api/src'],
    );
    try {
      const result = inspectReportPath({ projectRoot });
      expect(result.tool).toBe('gradle');
      expect(result.reportDirs).toEqual([path.join(projectRoot, 'core', 'build', 'test-results', 'test')]);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('returns test-results for npm project', () => {
    const projectRoot = createTempProject(['package.json']);
    try {
      const result = inspectReportPath({ projectRoot });
      expect(result.tool).toBe('npm');
      expect(result.reportDirs).toEqual([path.join(projectRoot, 'test-results')]);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('falls back to Maven surefire-reports when no build file exists', () => {
    const projectRoot = createTempProject([]);
    try {
      const result = inspectReportPath({ projectRoot });
      expect(result.tool).toBe('maven');
      expect(result.reportDirs).toEqual([path.join(projectRoot, 'target', 'surefire-reports')]);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('falls back to singleModule path when Gradle project has no submodule report dirs', () => {
    const projectRoot = createTempProject(['build.gradle']);
    try {
      const result = inspectReportPath({ projectRoot });
      expect(result.tool).toBe('gradle');
      expect(result.reportDirs).toEqual([path.join(projectRoot, 'build', 'test-results', 'test')]);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('falls back to singleModule when readdirSync throws due to unreadable directory', () => {
    const projectRoot = createTempProject(['build.gradle']);
    // Pass tool: 'gradle' explicitly so detectProjectTool is bypassed when dir is unreadable.
    fs.chmodSync(projectRoot, 0o000);
    try {
      const result = inspectReportPath({ projectRoot, tool: 'gradle' });
      expect(result.tool).toBe('gradle');
      expect(result.reportDirs).toEqual([path.join(projectRoot, 'build', 'test-results', 'test')]);
    } finally {
      fs.chmodSync(projectRoot, 0o755);
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('respects explicit tool override, returning npm report dir even for a Maven project root', () => {
    const projectRoot = createTempProject(['pom.xml']);
    try {
      const result = inspectReportPath({ projectRoot, tool: 'npm' });
      expect(result.tool).toBe('npm');
      expect(result.reportDirs).toEqual([path.join(projectRoot, 'test-results')]);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('respects explicit gradle override even when detection would choose npm', () => {
    const projectRoot = createTempProject(['package.json']);
    try {
      const result = inspectReportPath({ projectRoot, tool: 'gradle' });
      expect(result.tool).toBe('gradle');
      expect(result.reportDirs).toEqual([path.join(projectRoot, 'build', 'test-results', 'test')]);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('falls back to maven report path for unsupported tool values at runtime', () => {
    const projectRoot = createTempProject(['package.json']);
    try {
      const result = inspectReportPath({ projectRoot, tool: 'unknown' as any });
      expect(result.tool).toBe('maven');
      expect(result.reportDirs).toEqual([path.join(projectRoot, 'target', 'surefire-reports')]);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
