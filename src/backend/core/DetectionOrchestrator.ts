import * as fs from 'fs';
import * as path from 'path';

import { parsePom } from '../detector/PomParser';
import { detectJUnit5Dependencies } from '../detector/JUnit5DependencyDetector';
import { detectJUnit4Dependencies } from '../detector/JUnit4DependencyDetector';
import { detectTestNGDependencies } from '../detector/TestNGDependencyDetector';
import { parseSuiteXML, buildSuiteTaskDependencies } from '../detector/SuiteXMLParser';
import { detectLifecycle, ServiceRequirement } from '../detector/LifecycleDetector';

export interface DetectionResult {
  containerImage: string | undefined;
  dependencyMap: Map<string, string[]> | undefined;
  lifecycle: {
    requirements: ServiceRequirement[];
    hasDockerCompose: boolean;
  };
}

export function runDetection(
  projectRoot: string,
  srcDir: string,
  suiteXMLPath: string,
  pomPath: string,
): DetectionResult {
  // Container image: auto-detect from Dockerfile + pom.xml java version
  let containerImage: string | undefined;
  if (fs.existsSync(path.join(projectRoot, 'Dockerfile'))) {
    const javaVersion = fs.existsSync(pomPath) ? parsePom(pomPath).javaVersion : null;
    containerImage = `eclipse-temurin:${javaVersion ?? '21'}-jdk`;
  }

  // Dependency map: scan Java source + suite XML
  let dependencyMap: Map<string, string[]> | undefined;
  const hasSrc = fs.existsSync(srcDir);
  const hasSuiteXML = fs.existsSync(suiteXMLPath);

  if (hasSrc || hasSuiteXML) {
    let tasks: { id: string; duration: number; dependencies?: string[] }[] = [];

    if (hasSrc) {
      tasks = detectJUnit5Dependencies(srcDir, tasks);
      tasks = detectJUnit4Dependencies(srcDir, tasks);
      tasks = detectTestNGDependencies(srcDir, tasks);
    }

    if (hasSuiteXML) {
      const suites = parseSuiteXML(suiteXMLPath);
      tasks = buildSuiteTaskDependencies(suites, tasks);
    }

    const withDeps = tasks.filter((t) => t.dependencies && t.dependencies.length > 0);
    if (withDeps.length > 0) {
      dependencyMap = new Map(withDeps.map((t) => [t.id, t.dependencies!]));
    }
  }

  // Lifecycle: Testcontainers, Spring annotations, docker-compose
  const lifecycle = detectLifecycle(projectRoot, srcDir);

  return { containerImage, dependencyMap, lifecycle };
}
