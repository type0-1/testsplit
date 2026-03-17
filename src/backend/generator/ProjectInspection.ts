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

function hasFile(projectRoot: string, filename: string): boolean {
  return fs.existsSync(path.join(projectRoot, filename));
}

export function inspectProjectTestCommandFormat(
  options: InspectProjectOptions = {},
): ProjectTestCommandFormat {
  const projectRoot = options.projectRoot ?? process.cwd();
  const mavenBin = options.mavenBin ?? 'mvn';
  const gradleBin = options.gradleBin ?? 'gradle';

  if (hasFile(projectRoot, 'pom.xml')) {
    return {
      tool: 'maven',
      buildCommand: (assignedClasses: string[]) =>
        `${mavenBin} test -Dtest=${assignedClasses.join(',')}`,
    };
  }

  if (
    hasFile(projectRoot, 'build.gradle') ||
    hasFile(projectRoot, 'build.gradle.kts')
  ) {
    return {
      tool: 'gradle',
      buildCommand: (assignedClasses: string[]) => {
        const classSelectors = assignedClasses
          .map((c) => `--tests ${c}`)
          .join(' ');
        return classSelectors.length > 0
          ? `${gradleBin} test ${classSelectors}`
          : `${gradleBin} test`;
      },
    };
  }

  if (hasFile(projectRoot, 'package.json')) {
    return {
      tool: 'npm',
      buildCommand: (assignedClasses: string[]) =>
        assignedClasses.length > 0
          ? `npm test -- ${assignedClasses.join(' ')}`
          : 'npm test',
    };
  }

  return {
    tool: 'maven',
    buildCommand: (assignedClasses: string[]) =>
      `${mavenBin} test -Dtest=${assignedClasses.join(',')}`,
  };
}
