import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

import { generateDockerfile } from '../../generator/DockerfileGenerator';
import { parsePom } from '../../detector/PomParser';

export function buildDockerfileCommand(y: any): any {
  return y
    .option('pom', {
      type: 'string',
      default: 'pom.xml',
      describe: 'Path to pom.xml (used to detect Java version and Maven wrapper)',
    })
    .option('out', {
      type: 'string',
      default: 'Dockerfile',
      describe: 'Output path for the generated Dockerfile',
    });
}

export function handleDockerfileCommand(argv: any): void {
  const pomPath = path.resolve(argv.pom as string);
  const outPath = path.resolve(argv.out as string);

  let javaVersion: string | undefined;
  const hasMavenWrapper = fs.existsSync(path.resolve('mvnw'));

  if (fs.existsSync(pomPath)) {
    const pomInfo = parsePom(pomPath);
    if (pomInfo.javaVersion) javaVersion = pomInfo.javaVersion;
  }

  const content = generateDockerfile({ javaVersion, hasMavenWrapper });
  fs.writeFileSync(outPath, content, 'utf-8');
  console.log(chalk.green(`Dockerfile written to ${outPath}`));
  if (javaVersion) {
    console.log(chalk.dim(`  Java version: ${javaVersion}`));
  }
  if (hasMavenWrapper) {
    console.log(chalk.dim('  Using ./mvnw'));
  }
}