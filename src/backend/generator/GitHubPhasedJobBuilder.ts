import { ServiceRequirement } from '../detector/LifecycleDetector';
import { buildGitHubServices, buildDockerComposeStartStep, buildDockerComposeStopStep } from './LifecycleStepGenerator';
import { isMavenCommand } from './MavenCommand';

type SplitJob = { id: number; tests: string[]; needs?: number[] };
type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return typeof value === 'object' && value !== null
    ? (value as JsonObject)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isMavenStep(step: unknown): boolean {
  const stepObj = asObject(step);
  return typeof stepObj.run === 'string' && isMavenCommand(stepObj.run);
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// ---------------------------------------------------------------------------
// Matrix strategy resolution
// Resolves ${{ matrix.* }} expressions and environment variable substitutions
// so that the generated phased jobs are self-contained and do not rely on a
// GitHub Actions matrix strategy at runtime.
// ---------------------------------------------------------------------------

function buildMatrixResolver(baseJob: unknown): (json: string) => string {
  const matrixDef: Record<string, (string | number)[]> =
    (asObject(asObject(baseJob).strategy).matrix as Record<string, (string | number)[]>) ?? {};
  const javaMatrix: (string | number)[] | undefined = matrixDef['java'];
  if (javaMatrix) matrixDef['java'] = [javaMatrix[javaMatrix.length - 1]];

  return (json: string): string =>
    json.replace(/\$\{\{\s*matrix\.([\w-]+)\s*\}\}/g, (_match, key) => {
      const vals = matrixDef[key];
      return vals && vals.length > 0 ? String(vals[0]) : '';
    });
}

function stripMatrixEnvAndCollectSubstitutions(
  job: JsonObject,
  resolveMatrixRefs: (json: string) => string,
): Record<string, string> {
  const substitutions: Record<string, string> = {};

  if (!job.env) {
    return substitutions;
  }

  const env = asObject(job.env);
  for (const [k, v] of Object.entries(env)) {
    if (typeof v === 'string' && v.includes('matrix.')) {
      substitutions[k] = resolveMatrixRefs(v);
      delete env[k];
    }
  }

  if (Object.keys(env).length === 0) {
    delete job.env;
  } else {
    job.env = env;
  }

  return substitutions;
}

function buildEnvResolver(substitutions: Record<string, string>): (json: string) => string {
  return (json: string): string => {
    let result = json;
    for (const [k, v] of Object.entries(substitutions)) {
      result = result.replace(new RegExp(`\\$${k}\\b`, 'g'), v);
    }
    return result;
  };
}

function resolveStep(
  step: unknown,
  resolveMatrixRefs: (json: string) => string,
  resolveEnvRefs: (json: string) => string,
): JsonObject {
  return JSON.parse(resolveEnvRefs(resolveMatrixRefs(JSON.stringify(step))));
}

// ---------------------------------------------------------------------------
// Build job construction
// ---------------------------------------------------------------------------

function buildBuildJob(
  baseJob: unknown,
  resolveMatrixRefs: (json: string) => string,
  containerImage: string | undefined,
  githubServices: unknown,
  artifactName: string,
  artifactPath: string,
): { buildJob: JsonObject; setupSteps: JsonObject[]; resolveEnvRefs: (json: string) => string } {
  const buildJob = deepClone(asObject(baseJob));

  delete buildJob.strategy;
  delete buildJob.name;
  buildJob['runs-on'] = 'ubuntu-latest';

  const substitutions = stripMatrixEnvAndCollectSubstitutions(buildJob, resolveMatrixRefs);
  const resolveEnvRefs = buildEnvResolver(substitutions);

  if (containerImage) buildJob.container = containerImage;
  if (githubServices) buildJob.services = githubServices;

  buildJob.steps = asArray(buildJob.steps).map((step) => {
    const resolved = resolveStep(step, resolveMatrixRefs, resolveEnvRefs);
    if (isMavenStep(resolved) && typeof resolved.run === 'string' && !resolved.run.includes('-DskipTests')) {
      return { ...resolved, run: `${resolved.run.trim()} -DskipTests -Drat.skip=true` };
    }
    return resolved;
  });

  asArray(buildJob.steps).push({
    uses: 'actions/upload-artifact@v4',
    with: { name: artifactName, path: artifactPath },
  });
  buildJob.steps = asArray(buildJob.steps);

  const setupSteps = asArray(asObject(baseJob).steps)
    .filter((step) => !isMavenStep(step))
    .map((step) => resolveStep(step, resolveMatrixRefs, resolveEnvRefs));

  return { buildJob, setupSteps, resolveEnvRefs };
}

// ---------------------------------------------------------------------------
// Test job construction
// ---------------------------------------------------------------------------

function buildTestJob(
  baseJob: unknown,
  job: SplitJob,
  setupSteps: JsonObject[],
  mavenBin: string,
  artifactName: string,
  forkFlags: string[],
  resolveMatrixRefs: (json: string) => string,
  containerImage: string | undefined,
  githubServices: unknown,
  coreDetectStep: { name: string; id: string; run: string } | null,
  composeStartStep: JsonObject | null,
  composeStopStep: JsonObject | null,
): JsonObject {
  const testJob = deepClone(asObject(baseJob));
  delete testJob.strategy;
  delete testJob.name;
  testJob['runs-on'] = 'ubuntu-latest';

  stripMatrixEnvAndCollectSubstitutions(testJob, resolveMatrixRefs);

  if (containerImage) testJob.container = containerImage;
  if (githubServices) testJob.services = githubServices;

  const testSteps: JsonObject[] = [...deepClone(setupSteps)];

  if (composeStartStep) testSteps.push(composeStartStep);

  testSteps.push({ uses: 'actions/download-artifact@v4', with: { name: artifactName } });

  if (coreDetectStep) testSteps.push(coreDetectStep);

  testSteps.push({
    name: 'Run tests',
    run: [
      `${mavenBin} test`,
      `-Dtest=${[...new Set(job.tests)].join(',')}`,
      `-DfailIfNoTests=false`,
      ...forkFlags,
    ].join(' '),
  });

  if (composeStopStep) testSteps.push(composeStopStep);

  testJob.steps = testSteps;
  testJob.needs = ['build'];
  return testJob;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Transforms an existing GitHub Actions job definition into a phased
 * build + parallel-test topology. The original job is split into:
 *   - a `build` job that compiles and uploads artifacts
 *   - one `test-job-N` per entry in `jobs`, each downloading the artifact
 *     and running only its assigned test classes
 */
export function buildGitHubPhasedJobs(
  baseJob: JsonObject,
  jobs: SplitJob[],
  mavenBin: string,
  artifactName: string = 'build-artifacts',
  artifactPath: string = 'target/',
  runnerCores: number = 1,
  containerImage?: string,
  services?: ServiceRequirement[],
  hasDockerCompose?: boolean,
): Record<string, JsonObject> {
  const result: Record<string, JsonObject> = {};

  const githubServices = services ? buildGitHubServices(services) : undefined;
  const composeStartStep = hasDockerCompose ? buildDockerComposeStartStep() : null;
  const composeStopStep = hasDockerCompose ? buildDockerComposeStopStep() : null;
  const resolveMatrixRefs = buildMatrixResolver(baseJob);
  const { buildJob, setupSteps } = buildBuildJob(
    baseJob,
    resolveMatrixRefs,
    containerImage,
    githubServices,
    artifactName,
    artifactPath,
  );

  result['build'] = buildJob;

  const coreDetectStep = runnerCores > 1 ? {
    name: 'Detect available cores',
    id: 'cores',
    run: [
      'TOTAL=$(nproc)',
      "LOAD=$(awk '{print int($1+0.5)}' /proc/loadavg)",
      'IDLE=$(( TOTAL - LOAD > 1 ? TOTAL - LOAD : 1 ))',
      'echo "count=$IDLE" >> $GITHUB_OUTPUT',
    ].join('\n')
  } : null;

  const forkFlags = runnerCores > 1
    ? ['-Dsurefire.forkCount=${{ steps.cores.outputs.count }}', '-Dsurefire.reuseForks=true']
    : [];

  for (const job of jobs) {
    const testJob = buildTestJob(
      baseJob,
      job,
      setupSteps,
      mavenBin,
      artifactName,
      forkFlags,
      resolveMatrixRefs,
      containerImage,
      githubServices,
      coreDetectStep,
      composeStartStep,
      composeStopStep,
    );
    result[`test-job-${job.id}`] = testJob;
  }

  return result;
}
