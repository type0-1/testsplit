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

jest.mock('../../../../src/backend/generator/DockerfileGenerator', () => ({
  generateDockerfile: jest.fn(() => 'generated-dockerfile'),
}));
jest.mock('../../../../src/backend/detector/PomParser', () => ({
  parsePom: jest.fn(() => ({})),
}));
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
import { generateDockerfile } from '../../../../src/backend/generator/DockerfileGenerator';
import { parsePom } from '../../../../src/backend/detector/PomParser';

import '../../../../src/backend/cli/cli';

const mockFs = fs as jest.Mocked<typeof fs>;
const mockGenerateDockerfile = generateDockerfile as jest.MockedFunction<typeof generateDockerfile>;
const mockParsePom = parsePom as jest.MockedFunction<typeof parsePom>;

let generateDockerfileHandler: (argv: any) => void;

beforeAll(() => {
  const yargsInstance = (yargs as jest.MockedFunction<typeof yargs>).mock.results[0]?.value;
  const calls: any[][] = yargsInstance.command.mock.calls;
  generateDockerfileHandler = calls.find((c) => {
    const commandName = c[0];
    if (Array.isArray(commandName)) {
      return commandName.includes('dockerfile') || commandName.includes('generate-dockerfile');
    }
    return String(commandName) === 'dockerfile' || String(commandName) === 'generate-dockerfile';
  })?.[3];
});

describe('generate-dockerfile command handler', () => {
  beforeEach(() => {
    jest.spyOn(process, 'exit').mockImplementation((code) => { throw new Error(`exit(${code})`); });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFs.existsSync.mockReset();
    mockFs.writeFileSync.mockReset();
    mockParsePom.mockReset();
    mockGenerateDockerfile.mockReset();
  });

  afterEach(() => jest.restoreAllMocks());

  it('writes dockerfile without java version or mvnw logs when neither pom nor mvnw exist', () => {
    mockFs.existsSync
      .mockReturnValueOnce(false) // mvnw does not exist
      .mockReturnValueOnce(false); // pom.xml does not exist
    mockGenerateDockerfile.mockReturnValue('FROM eclipse-temurin:21-jdk');

    expect(() => generateDockerfileHandler({ pom: '/tmp/pom.xml', out: '/tmp/Dockerfile' })).not.toThrow();

    expect(mockGenerateDockerfile).toHaveBeenCalledWith({ javaVersion: undefined, hasMavenWrapper: false });
    const allLogs = (console.log as jest.Mock).mock.calls.flat().join('\n');
    expect(allLogs).not.toContain('Java version');
    expect(allLogs).not.toContain('Using ./mvnw');
  });

  it('writes dockerfile without java version log when pom exists but has no javaVersion', () => {
    mockFs.existsSync
      .mockReturnValueOnce(false) // mvnw does not exist
      .mockReturnValueOnce(true);  // pom.xml exists
    mockParsePom.mockReturnValue({} as any); // no javaVersion property
    mockGenerateDockerfile.mockReturnValue('FROM eclipse-temurin:21-jdk');

    expect(() => generateDockerfileHandler({ pom: '/tmp/pom.xml', out: '/tmp/Dockerfile' })).not.toThrow();

    expect(mockGenerateDockerfile).toHaveBeenCalledWith({ javaVersion: undefined, hasMavenWrapper: false });
    const allLogs = (console.log as jest.Mock).mock.calls.flat().join('\n');
    expect(allLogs).not.toContain('Java version');
  });

  it('writes dockerfile and logs java version and maven wrapper when both are detected', () => {
    mockFs.existsSync
      .mockReturnValueOnce(true)  // mvnw exists
      .mockReturnValueOnce(true); // pom.xml exists
    mockParsePom.mockReturnValue({ javaVersion: '21' } as any);
    mockGenerateDockerfile.mockReturnValue('FROM eclipse-temurin:21-jdk');

    expect(() => generateDockerfileHandler({ pom: '/tmp/pom.xml', out: '/tmp/Dockerfile' })).not.toThrow();

    expect(mockGenerateDockerfile).toHaveBeenCalledWith({ javaVersion: '21', hasMavenWrapper: true });
    expect(mockFs.writeFileSync).toHaveBeenCalledWith('/tmp/Dockerfile', 'FROM eclipse-temurin:21-jdk', 'utf-8');
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Dockerfile written to /tmp/Dockerfile'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Java version: 21'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Using ./mvnw'));
  });
});
