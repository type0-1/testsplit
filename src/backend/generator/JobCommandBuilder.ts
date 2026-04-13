export type JobCommandBuilder = (tests: string[]) => string;

export function resolveJobCommandBuilder(
  mavenBinOrBuilder: string | JobCommandBuilder,
): JobCommandBuilder {
  if (typeof mavenBinOrBuilder === 'function') {
    return mavenBinOrBuilder;
  }

  return (tests: string[]) => `${mavenBinOrBuilder} test -Dtest=${tests.join(',')}`;
}