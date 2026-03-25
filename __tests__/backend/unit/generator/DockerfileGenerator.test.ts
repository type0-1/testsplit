import { generateDockerfile } from '../../../../src/backend/generator/DockerfileGenerator';

describe('generateDockerfile', () => {
  it('uses eclipse-temurin with the specified Java version', () => {
    const out = generateDockerfile({ javaVersion: '17' });
    expect(out).toContain('FROM eclipse-temurin:17-jdk');
  });

  it('defaults to Java 21 when no version is provided', () => {
    const out = generateDockerfile();
    expect(out).toContain('FROM eclipse-temurin:21-jdk');
  });

  it('includes dependency:go-offline cache layer', () => {
    const out = generateDockerfile();
    expect(out).toContain('COPY pom.xml .');
    expect(out).toContain('dependency:go-offline');
  });

  it('uses mvn when hasMavenWrapper is false (default)', () => {
    const out = generateDockerfile({ hasMavenWrapper: false });
    expect(out).toContain('RUN mvn dependency:go-offline');
    expect(out).toContain('RUN mvn package -DskipTests');
    expect(out).not.toContain('./mvnw');
  });

  it('uses ./mvnw when hasMavenWrapper is true', () => {
    const out = generateDockerfile({ hasMavenWrapper: true });
    expect(out).toContain('RUN ./mvnw dependency:go-offline');
    expect(out).toContain('RUN ./mvnw package -DskipTests');
    expect(out).not.toContain('RUN mvn');
  });

  it('sets WORKDIR /app', () => {
    const out = generateDockerfile();
    expect(out).toContain('WORKDIR /app');
  });

  it('copies source after the dependency cache layer', () => {
    const out = generateDockerfile();
    const pomIdx = out.indexOf('COPY pom.xml');
    const srcIdx = out.indexOf('COPY . .');
    expect(pomIdx).toBeGreaterThanOrEqual(0);
    expect(srcIdx).toBeGreaterThan(pomIdx);
  });
});
