import { readFileSync } from 'fs';
import { XMLParser } from 'fast-xml-parser';

export interface PomInfo {
  javaVersion: string | null;
  surefireForkCount: string | null;
}

const PARSER = new XMLParser({ ignoreAttributes: true, parseTagValue: false });

export function parsePom(pomPath: string): PomInfo {
  const content = readFileSync(pomPath, 'utf-8');
  const parsed = PARSER.parse(content);
  const project = parsed?.project ?? {};

  return {
    javaVersion: extractJavaVersion(project),
    surefireForkCount: extractSurefireForkCount(project),
  };
}

function extractJavaVersion(project: Record<string, unknown>): string | null {
  const props = (project.properties ?? {}) as Record<string, unknown>;

  for (const key of ['java.version', 'maven.compiler.release', 'maven.compiler.source']) {
    if (props[key] != null) return String(props[key]);
  }

  const compiler = findPlugin(project, 'maven-compiler-plugin');
  if (compiler?.configuration != null) {
    const cfg = compiler.configuration as Record<string, unknown>;
    if (cfg.release != null) return String(cfg.release);
    if (cfg.source != null) return String(cfg.source);
  }

  return null;
}

function extractSurefireForkCount(project: Record<string, unknown>): string | null {
  const surefire = findPlugin(project, 'maven-surefire-plugin');
  const forkCount = (surefire?.configuration as Record<string, unknown> | undefined)?.forkCount;
  return forkCount != null ? String(forkCount) : null;
}

function findPlugin(
  project: Record<string, unknown>,
  artifactId: string,
): Record<string, unknown> | null {
  const build = (project.build ?? {}) as Record<string, unknown>;
  const raw = (build.plugins as Record<string, unknown> | undefined)?.plugin;
  if (raw == null) return null;
  const plugins = Array.isArray(raw) ? raw : [raw];
  return (
    (plugins as Record<string, unknown>[]).find((p) => p.artifactId === artifactId) ?? null
  );
}
