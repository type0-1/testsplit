import * as path from 'path';
import { parsePom } from '../../../../src/backend/detector/PomParser';

const FIXTURES = path.resolve(__dirname, 'fixtures');

describe('parsePom', () => {
  describe('Java version extraction', () => {
    it('reads java.version from <properties>', () => {
      const info = parsePom(path.join(FIXTURES, 'pom-properties.xml'));
      expect(info.javaVersion).toBe('21');
    });

    it('prefers java.version over maven.compiler.source when both present', () => {
      const info = parsePom(path.join(FIXTURES, 'pom-properties.xml'));
      expect(info.javaVersion).toBe('21');
    });

    it('reads <release> from maven-compiler-plugin configuration', () => {
      const info = parsePom(path.join(FIXTURES, 'pom-compiler-plugin.xml'));
      expect(info.javaVersion).toBe('17');
    });

    it('returns null when no Java version is declared', () => {
      const info = parsePom(path.join(FIXTURES, 'pom-minimal.xml'));
      expect(info.javaVersion).toBeNull();
    });
  });

  describe('Surefire forkCount extraction', () => {
    it('reads forkCount from maven-surefire-plugin configuration', () => {
      const info = parsePom(path.join(FIXTURES, 'pom-compiler-plugin.xml'));
      expect(info.surefireForkCount).toBe('2');
    });

    it('returns null when surefire plugin is not configured', () => {
      const info = parsePom(path.join(FIXTURES, 'pom-properties.xml'));
      expect(info.surefireForkCount).toBeNull();
    });

    it('returns null when pom has no plugins', () => {
      const info = parsePom(path.join(FIXTURES, 'pom-minimal.xml'));
      expect(info.surefireForkCount).toBeNull();
    });
  });
});
