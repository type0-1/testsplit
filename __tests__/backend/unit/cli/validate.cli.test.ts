jest.mock('yargs', () => {
  const chain: any = {};
  chain.command = jest.fn().mockReturnValue(chain);
  chain.demandCommand = jest.fn().mockReturnValue(chain);
  chain.help = jest.fn().mockReturnValue(chain);
  chain.version = jest.fn().mockReturnValue(chain);
  chain.alias = jest.fn().mockReturnValue(chain);
  chain.parse = jest.fn();
  return jest.fn(() => chain);
});
jest.mock('yargs/helpers', () => ({ hideBin: (a: string[]) => a.slice(2) }));
jest.mock('child_process', () => ({
  spawn: jest.fn(),
  execSync: jest.fn(),
}));

jest.mock('os', () => ({
  ...jest.requireActual('os'),
  cpus: jest.fn(() => jest.requireActual('os').cpus()),
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  readFileSync: jest.fn((filePath: string, encoding?: string) => {
    // Allow reading package.json through to get the version
    if (filePath.includes('package.json')) {
      return jest.requireActual('fs').readFileSync(filePath, encoding);
    }
    return jest.fn()();
  }),
  writeFileSync: jest.fn(),
  statSync: jest.fn(),
}));

jest.mock('yaml', () => ({ parse: jest.fn(), stringify: jest.fn(() => 'generated-yaml') }));
jest.mock('../../../../src/backend/generator/getSchemaValidator');
jest.mock('../../../../src/backend/generator/YAMLSyntaxValidator');
jest.mock('chalk', () => ({
  __esModule: true,
  default: {
    red: (s: string) => s,
    yellow: (s: string) => s,
    green: (s: string) => s,
    bold: (s: string) => s,
    dim: (s: string) => s,
  },
}));

import * as fs from 'fs';
import yargs from 'yargs';
import { validateYamlSyntax } from '../../../../src/backend/generator/YAMLSyntaxValidator';
import { getSchemaValidator } from '../../../../src/backend/generator/getSchemaValidator';
import YAML from 'yaml';

import '../../../../src/backend/cli/cli';

const mockFs = fs as jest.Mocked<typeof fs>;
const mockValidateYamlSyntax = validateYamlSyntax as jest.MockedFunction<typeof validateYamlSyntax>;
const mockGetSchemaValidator = getSchemaValidator as jest.MockedFunction<typeof getSchemaValidator>;
const mockYAML = YAML as unknown as { parse: jest.Mock; stringify: jest.Mock };

let validateHandler: (argv: any) => void;

beforeAll(() => {
  const yargsInstance = (yargs as jest.MockedFunction<typeof yargs>).mock.results[0]?.value;
  const calls: any[][] = yargsInstance.command.mock.calls;
  validateHandler = calls.find(c => c[0] === 'validate')?.[3];
});

describe('validate command handler', () => {
  beforeEach(() => {
    jest.spyOn(process, 'exit').mockImplementation((code) => { throw new Error(`exit(${code})`); });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFs.existsSync.mockReset();
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReset();
    mockYAML.parse.mockReset();
    mockValidateYamlSyntax.mockReset();
    mockGetSchemaValidator.mockReset();
  });

  afterEach(() => jest.restoreAllMocks());

  it('exits when the validation file does not exist', () => {
    mockFs.existsSync.mockReturnValue(false);

    expect(() => validateHandler({ file: '/tmp/missing.yml', platform: 'github' })).toThrow('exit(1)');
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('file does not exist'),
    );
  });

  it('exits on invalid YAML syntax and prints the parser message when available', () => {
    mockFs.readFileSync.mockReturnValue('raw');
    mockYAML.parse.mockImplementation(() => {
      throw new Error('unexpected token');
    });

    expect(() => validateHandler({ file: '/tmp/ci.yml', platform: 'github' })).toThrow('exit(1)');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Invalid YAML syntax'));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('unexpected token'));
  });

  it('exits on invalid YAML syntax and skips error message when thrown value is not an Error', () => {
    mockFs.readFileSync.mockReturnValue('raw');
    mockYAML.parse.mockImplementationOnce(() => { throw 'bad yaml'; });

    expect(() => validateHandler({ file: '/tmp/ci.yml', platform: 'github' })).toThrow('exit(1)');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Invalid YAML syntax'));
    const errorCalls = (console.error as jest.Mock).mock.calls.flat();
    expect(errorCalls.filter((m: string) => m !== undefined && String(m).includes('bad yaml'))).toHaveLength(0);
  });

  it('passes a valid github actions config', () => {
    mockFs.readFileSync.mockReturnValue('raw');
    mockYAML.parse.mockReturnValue({ on: ['push'], jobs: { 'job-1': { steps: [{ run: 'npm test' }] } } });

    expect(() => validateHandler({ file: '/tmp/ci.yml', platform: 'github' })).not.toThrow();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('valid'));
  });

  it('exits when github config has validation issues', () => {
    mockFs.readFileSync.mockReturnValue('raw');
    mockYAML.parse.mockReturnValue({ name: 'CI' }); // missing 'on' and 'jobs'

    expect(() => validateHandler({ file: '/tmp/ci.yml', platform: 'github' })).toThrow('exit(1)');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Validation failed'));
  });

  it('passes a valid gitlab ci config', () => {
    mockFs.readFileSync.mockReturnValue('raw');
    mockYAML.parse.mockReturnValue({ stages: ['test'], 'job-1': { script: ['npm test'] } });

    expect(() => validateHandler({ file: '/tmp/ci.yml', platform: 'gitlab' })).not.toThrow();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('valid'));
  });

  it('reports github validation issues for missing on, jobs, and steps', () => {
    mockFs.readFileSync.mockReturnValue('raw');
    mockYAML.parse.mockReturnValue({ jobs: { 'job-1': { steps: [] }, 'job-2': {} } });

    expect(() => validateHandler({ file: '/tmp/ci.yml', platform: 'github' })).toThrow('exit(1)');
    const allErrors = (console.error as jest.Mock).mock.calls.flat().join('\n');
    expect(allErrors).toContain('Missing required field: on (trigger)');
    expect(allErrors).toContain('Job "job-1": missing steps');
    expect(allErrors).toContain('Job "job-2": missing steps');
  });

  it('reports gitlab validation issues for missing stages, jobs, and script entries', () => {
    mockFs.readFileSync.mockReturnValue('raw');
    mockYAML.parse.mockReturnValue({ jobA: { script: [] }, jobB: {} });

    expect(() => validateHandler({ file: '/tmp/ci.yml', platform: 'gitlab' })).toThrow('exit(1)');
    const allErrors = (console.error as jest.Mock).mock.calls.flat().join('\n');
    expect(allErrors).toContain('Missing required field: stages');
    expect(allErrors).toContain('Job "jobA": missing script');
    expect(allErrors).toContain('Job "jobB": missing script');
  });

  it('reports gitlab validation issue when no jobs are defined', () => {
    mockFs.readFileSync.mockReturnValue('raw');
    mockYAML.parse.mockReturnValue({ stages: ['test'] });

    expect(() => validateHandler({ file: '/tmp/ci.yml', platform: 'gitlab' })).toThrow('exit(1)');
    const allErrors = (console.error as jest.Mock).mock.calls.flat().join('\n');
    expect(allErrors).toContain('No jobs defined');
  });
});
