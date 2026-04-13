jest.mock('fs');
jest.mock('path');
jest.mock('../../../../src/backend/detector/PomParser');
jest.mock('../../../../src/backend/detector/JUnit5DependencyDetector');
jest.mock('../../../../src/backend/detector/JUnit4DependencyDetector');
jest.mock('../../../../src/backend/detector/TestNGDependencyDetector');
jest.mock('../../../../src/backend/detector/SuiteXMLParser');
jest.mock('../../../../src/backend/detector/LifecycleDetector');

import * as fs from 'fs';
import * as path from 'path';
import { runDetection } from '../../../../src/backend/core/DetectionOrchestrator';
import { parsePom } from '../../../../src/backend/detector/PomParser';
import { detectJUnit5Dependencies } from '../../../../src/backend/detector/JUnit5DependencyDetector';
import { detectJUnit4Dependencies } from '../../../../src/backend/detector/JUnit4DependencyDetector';
import { detectTestNGDependencies } from '../../../../src/backend/detector/TestNGDependencyDetector';
import { parseSuiteXML, buildSuiteTaskDependencies } from '../../../../src/backend/detector/SuiteXMLParser';
import { detectLifecycle } from '../../../../src/backend/detector/LifecycleDetector';

const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
const mockJoin = path.join as jest.MockedFunction<typeof path.join>;
const mockParsePom = parsePom as jest.MockedFunction<typeof parsePom>;
const mockDetectJUnit5 = detectJUnit5Dependencies as jest.MockedFunction<typeof detectJUnit5Dependencies>;
const mockDetectJUnit4 = detectJUnit4Dependencies as jest.MockedFunction<typeof detectJUnit4Dependencies>;
const mockDetectTestNG = detectTestNGDependencies as jest.MockedFunction<typeof detectTestNGDependencies>;
const mockParseSuiteXML = parseSuiteXML as jest.MockedFunction<typeof parseSuiteXML>;
const mockBuildSuiteTaskDependencies = buildSuiteTaskDependencies as jest.MockedFunction<typeof buildSuiteTaskDependencies>;
const mockDetectLifecycle = detectLifecycle as jest.MockedFunction<typeof detectLifecycle>;

beforeEach(() => {
  jest.clearAllMocks();
  mockJoin.mockImplementation((...args) => args.join('/'));
  mockExistsSync.mockReturnValue(false);
  mockDetectLifecycle.mockReturnValue({
    requirements: [],
    hasDockerCompose: false,
  });
});

describe('DetectionOrchestrator', () => {
  describe('container image detection', () => {
    it('detects Dockerfile and parses Java version from pom.xml', () => {
      mockExistsSync.mockImplementation((filePath: any) => {
        const str = String(filePath);
        return str.includes('Dockerfile') || str.includes('pom.xml');
      });
      mockParsePom.mockReturnValue({ javaVersion: '17', surefireForkCount: null });

      const result = runDetection('/project', '/src', '/suite.xml', '/pom.xml');

      expect(result.containerImage).toBe('eclipse-temurin:17-jdk');
    });

    it('uses default Java 21 when pom.xml does not exist', () => {
      mockExistsSync.mockImplementation((filePath: any) => {
        const str = String(filePath);
        return str.includes('Dockerfile');
      });

      const result = runDetection('/project', '/src', '/suite.xml', '/pom.xml');

      expect(result.containerImage).toBe('eclipse-temurin:21-jdk');
    });

    it('uses default Java 21 when parsePom returns null javaVersion', () => {
      mockExistsSync.mockImplementation((filePath: any) => {
        const str = String(filePath);
        return str.includes('Dockerfile') || str.includes('pom.xml');
      });
      mockParsePom.mockReturnValue({ javaVersion: null, surefireForkCount: null });

      const result = runDetection('/project', '/src', '/suite.xml', '/pom.xml');

      expect(result.containerImage).toBe('eclipse-temurin:21-jdk');
    });

    it('does not set containerImage when Dockerfile does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const result = runDetection('/project', '/src', '/suite.xml', '/pom.xml');

      expect(result.containerImage).toBeUndefined();
    });
  });

  describe('dependency map detection', () => {
    it('detects dependencies from source directory using all detectors', () => {
      mockExistsSync.mockImplementation((filePath: any) => {
        const str = String(filePath);
        return str.includes('src');
      });

      mockDetectJUnit5.mockReturnValue([]);
      mockDetectJUnit4.mockReturnValue([]);
      mockDetectTestNG.mockReturnValue([]);

      const result = runDetection('/project', '/src', '/suite.xml', '/pom.xml');

      expect(mockDetectJUnit5).toHaveBeenCalledWith('/src', []);
      expect(mockDetectJUnit4).toHaveBeenCalledWith('/src', []);
      expect(mockDetectTestNG).toHaveBeenCalledWith('/src', []);
    });

    it('parses suite XML when it exists', () => {
      mockExistsSync.mockImplementation((filePath: any) => {
        const str = String(filePath);
        return str.includes('suite.xml');
      });

      const suites = [{ name: 'Suite1', classes: ['com.example.Test1'] }];
      mockBuildSuiteTaskDependencies.mockReturnValue([]);
      mockParseSuiteXML.mockReturnValue(suites);

      const result = runDetection('/project', '/src', '/suite.xml', '/pom.xml');

      expect(mockParseSuiteXML).toHaveBeenCalledWith('/suite.xml');
      expect(mockBuildSuiteTaskDependencies).toHaveBeenCalledWith(suites, []);
    });

    it('creates dependency map only when dependencies exist', () => {
      mockExistsSync.mockImplementation((filePath: any) => {
        const str = String(filePath);
        return str.includes('src');
      });

      const tasksWithDeps = [
        { id: 'TestA', duration: 1.0, dependencies: ['TestB'] },
        { id: 'TestB', duration: 2.0, dependencies: [] },
      ];

      mockDetectJUnit5.mockReturnValue(tasksWithDeps);
      mockDetectJUnit4.mockReturnValue(tasksWithDeps);
      mockDetectTestNG.mockReturnValue(tasksWithDeps);

      const result = runDetection('/project', '/src', '/suite.xml', '/pom.xml');

      expect(result.dependencyMap).toBeDefined();
      expect(result.dependencyMap?.get('TestA')).toEqual(['TestB']);
      expect(result.dependencyMap?.has('TestB')).toBe(false); // No dependencies
    });

    it('does not create dependency map when no dependencies are found', () => {
      mockExistsSync.mockImplementation((filePath: any) => {
        const str = String(filePath);
        return str.includes('src');
      });

      const tasksWithoutDeps = [
        { id: 'TestA', duration: 1.0 },
        { id: 'TestB', duration: 2.0 },
      ];

      mockDetectJUnit5.mockReturnValue(tasksWithoutDeps);
      mockDetectJUnit4.mockReturnValue(tasksWithoutDeps);
      mockDetectTestNG.mockReturnValue(tasksWithoutDeps);

      const result = runDetection('/project', '/src', '/suite.xml', '/pom.xml');

      expect(result.dependencyMap).toBeUndefined();
    });

    it('does not create dependency map when no src or suite XML exists', () => {
      mockExistsSync.mockReturnValue(false);

      const result = runDetection('/project', '/src', '/suite.xml', '/pom.xml');

      expect(result.dependencyMap).toBeUndefined();
      expect(mockDetectJUnit5).not.toHaveBeenCalled();
      expect(mockParseSuiteXML).not.toHaveBeenCalled();
    });

    it('handles empty dependencies array in tasks', () => {
      mockExistsSync.mockImplementation((filePath: any) => {
        const str = String(filePath);
        return str.includes('src');
      });

      const tasksWithEmptyDeps = [
        { id: 'TestA', duration: 1.0, dependencies: [] },
      ];

      mockDetectJUnit5.mockReturnValue(tasksWithEmptyDeps);
      mockDetectJUnit4.mockReturnValue(tasksWithEmptyDeps);
      mockDetectTestNG.mockReturnValue(tasksWithEmptyDeps);

      const result = runDetection('/project', '/src', '/suite.xml', '/pom.xml');

      expect(result.dependencyMap).toBeUndefined();
    });
  });

  describe('lifecycle detection', () => {
    it('calls detectLifecycle with projectRoot and srcDir', () => {
      const mockLifecycle = {
        requirements: [{ type: 'postgres' as const, image: 'postgres:14', source: 'testcontainers' as const }],
        hasDockerCompose: true,
      };
      mockDetectLifecycle.mockReturnValue(mockLifecycle);

      const result = runDetection('/my-project', '/my-src', '/suite.xml', '/pom.xml');

      expect(mockDetectLifecycle).toHaveBeenCalledWith('/my-project', '/my-src');
      expect(result.lifecycle).toEqual(mockLifecycle);
    });

    it('includes lifecycle in result', () => {
      const mockLifecycle = {
        requirements: [],
        hasDockerCompose: false,
      };
      mockDetectLifecycle.mockReturnValue(mockLifecycle);

      const result = runDetection('/project', '/src', '/suite.xml', '/pom.xml');

      expect(result.lifecycle).toBe(mockLifecycle);
    });
  });

  describe('complete detection flow', () => {
    it('returns complete DetectionResult with all fields', () => {
      mockExistsSync.mockImplementation((filePath: any) => {
        const str = String(filePath);
        return str.includes('Dockerfile') || str.includes('pom.xml') || str.includes('src');
      });

      mockParsePom.mockReturnValue({ javaVersion: '11', surefireForkCount: null });

      const tasksWithDeps = [
        { id: 'Test1', duration: 1.0, dependencies: ['Test2'] },
        { id: 'Test2', duration: 2.0 },
      ];
      mockDetectJUnit5.mockReturnValue(tasksWithDeps);
      mockDetectJUnit4.mockReturnValue(tasksWithDeps);
      mockDetectTestNG.mockReturnValue(tasksWithDeps);

      const mockLifecycle = {
        requirements: [
          { type: 'postgres' as const, image: 'postgres:15', source: 'testcontainers' as const },
        ],
        hasDockerCompose: true,
      };
      mockDetectLifecycle.mockReturnValue(mockLifecycle);

      const result = runDetection('/project', '/src', '/suite.xml', '/pom.xml');

      expect(result.containerImage).toBe('eclipse-temurin:11-jdk');
      expect(result.dependencyMap).toBeDefined();
      expect(result.dependencyMap?.get('Test1')).toEqual(['Test2']);
      expect(result.lifecycle).toEqual(mockLifecycle);
    });

    it('handles multiple dependencies per task', () => {
      mockExistsSync.mockImplementation((filePath: any) => {
        const str = String(filePath);
        return str.includes('src');
      });

      const tasksWithMultipleDeps = [
        { id: 'TestA', duration: 1.0, dependencies: ['TestB', 'TestC', 'TestD'] },
        { id: 'TestB', duration: 2.0 },
        { id: 'TestC', duration: 3.0 },
        { id: 'TestD', duration: 4.0 },
      ];
      mockDetectJUnit5.mockReturnValue(tasksWithMultipleDeps);
      mockDetectJUnit4.mockReturnValue(tasksWithMultipleDeps);
      mockDetectTestNG.mockReturnValue(tasksWithMultipleDeps);

      const result = runDetection('/project', '/src', '/suite.xml', '/pom.xml');

      expect(result.dependencyMap?.get('TestA')).toEqual(['TestB', 'TestC', 'TestD']);
    });
  });
});
