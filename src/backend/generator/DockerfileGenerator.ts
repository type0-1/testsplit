export interface DockerfileOptions {
  javaVersion?: string;
  hasMavenWrapper?: boolean;
}

/**
 * Generates a Dockerfile for a Maven/Java project.
 *
 * Structure:
 * 1. Base image: eclipse-temurin:<javaVersion>-jdk
 * 2. WORKDIR + COPY pom.xml
 * 3. dependency:go-offline layer (cached separately from source)
 * 4. COPY source + build command
 */
export function generateDockerfile(options: DockerfileOptions = {}): string {
  const javaVersion = options.javaVersion ?? '21';
  const mvn = options.hasMavenWrapper ? './mvnw' : 'mvn';

  return [
    `FROM eclipse-temurin:${javaVersion}-jdk`,
    '',
    'WORKDIR /app',
    '',
    '# Cache Maven dependencies as a separate layer',
    'COPY pom.xml .',
    `RUN ${mvn} dependency:go-offline -B`,
    '',
    '# Copy source and build',
    'COPY . .',
    `RUN ${mvn} package -DskipTests -B`,
    '',
    'CMD ["java", "-jar", "target/app.jar"]',
  ].join('\n') + '\n';
}
