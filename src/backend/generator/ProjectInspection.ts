import * as fs from 'fs';
import * as path from 'path';

export type ProjectTestTool = 'maven' | 'gradle' | 'npm';

export interface ProjectTestCommandFormat {
  tool: ProjectTestTool;
  buildCommand: (assignedClasses: string[]) => string;
}

export interface InspectProjectOptions {
  projectRoot?: string;
  mavenBin?: string;
  gradleBin?: string;
}

function detectProjectTool(projectRoot: string): ProjectTestTool {
  if (hasFile(projectRoot, 'pom.xml')) {
    return 'maven';
  }

  if (hasFile(projectRoot, 'build.gradle') || hasFile(projectRoot, 'build.gradle.kts')) {
    return 'gradle';
  }

  if (hasFile(projectRoot, 'package.json')) {
    return 'npm';
  }

  return 'maven';
}

// Resolved absolute path(s) to the report directory. Multi-module Gradle projects return one entry per submodule.
export interface ReportPathResult {
  tool: ProjectTestTool;
  reportDirs: string[];
}

/**
 * Detects the build tool and returns the conventional test report directories.
 *
 * Maven: <root>/target/surefire-reports
 * Gradle: <root>/build/test-results/test (single-module, or one entry per submodule for multi-module projects)
 * npm: <root>/test-results  (Jest --reporters=default+junit convention)
 */

export function inspectReportPath(options: InspectProjectOptions = {}): ReportPathResult {
  const projectRoot = options.projectRoot ?? process.cwd();
  const tool = detectProjectTool(projectRoot);

  if (tool === 'maven') {
    return {
      tool: 'maven',
      reportDirs: [path.join(projectRoot, 'target', 'surefire-reports')],
    };
  }

  if (tool === 'gradle') {
    const singleModule = path.join(projectRoot, 'build', 'test-results', 'test');
    if (fs.existsSync(singleModule)) {
      return { tool: 'gradle', reportDirs: [singleModule] };
    }

    // Multi-module: find all submodule report dirs
    const submoduleDirs = collectGradleReportDirs(projectRoot);
    return {
      tool: 'gradle',
      reportDirs: submoduleDirs.length > 0 ? submoduleDirs : [singleModule],
    };
  }

  if (tool === 'npm') {
    return {
      tool: 'npm',
      reportDirs: [path.join(projectRoot, 'test-results')],
    };
  }

  // Fallback to Maven convention
  return {
    tool: 'maven',
    reportDirs: [path.join(projectRoot, 'target', 'surefire-reports')],
  };
}

function collectGradleReportDirs(projectRoot: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of fs.readdirSync(projectRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'build') continue;
      const candidate = path.join(projectRoot, entry.name, 'build', 'test-results', 'test');
      if (fs.existsSync(candidate)) results.push(candidate);
    }
  } catch {
    // Non-readable directory, return empty
  }
  return results;
}

function hasFile(projectRoot: string, filename: string): boolean {
  return fs.existsSync(path.join(projectRoot, filename));
}

export function inspectProjectTestCommandFormat( options: InspectProjectOptions = {} ): ProjectTestCommandFormat {
  const projectRoot = options.projectRoot ?? process.cwd();
  const mavenBin = options.mavenBin ?? 'mvn';
  const gradleBin = options.gradleBin ?? 'gradle';
  const tool = detectProjectTool(projectRoot);

  if (tool === 'maven') {
    return {
      tool: 'maven',
      buildCommand: (assignedClasses: string[]) => `${mavenBin} test -Dtest=${assignedClasses.join(',')}`,
    };
  }

  if (tool === 'gradle') {
    return {
      tool: 'gradle',
      buildCommand: (assignedClasses: string[]) => {
        const classSelectors = assignedClasses.map((c) => `--tests ${c}`).join(' ');
        return classSelectors.length > 0 ? `${gradleBin} test ${classSelectors}` : `${gradleBin} test`;
      },
    };
  }

  if (tool === 'npm') {
    return {
      tool: 'npm',
      buildCommand: (assignedClasses: string[]) => assignedClasses.length > 0 ? `npm test -- ${assignedClasses.join(' ')}` : 'npm test',
    };
  }

  return {
    tool: 'maven',
    buildCommand: (assignedClasses: string[]) => `${mavenBin} test -Dtest=${assignedClasses.join(',')}`,
  };
}
