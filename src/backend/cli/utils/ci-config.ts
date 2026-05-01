import { validateYamlSyntax } from '../../generator/YAMLSyntaxValidator';
import { getSchemaValidator } from '../../generator/getSchemaValidator';

type Platform = 'github' | 'gitlab';

export function prependSchedulingHeader(yaml: string, algorithm: string, riskFactor: number): string {
  const header = [
    '# Scheduling settings used for this distribution',
    `# algorithm: ${algorithm}`,
    `# risk_factor: ${riskFactor}`,
    '',
  ].join('\n');

  return `${header}${yaml}`;
}

export function validateFinalCIConfig(yaml: string, platform: Platform): void {
  try {
    validateYamlSyntax(yaml);
    
    const schemaValidator = getSchemaValidator(platform);
    schemaValidator?.validate(yaml);
  } catch (err: unknown) {
    const details = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Final ${platform} CI config validation failed: ${details}`,
      { cause: err },
    );
  }
}
