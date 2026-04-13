export function isMavenCommand(line: string): boolean {
  return /^(mvn|\.\/mvnw)\b/.test(line.trim());
}

export function isMavenTestCommand(line: string): boolean {
  const trimmed = line.trim();
  return isMavenCommand(trimmed) && !trimmed.includes('-DskipTests');
}