// src/ci/validation/YamlSyntaxValidator.ts
import yaml from 'js-yaml';

export function validateYamlSyntax(yamlText: string): void {
  try {
    yaml.load(yamlText);
  } catch (err) {
    throw new Error(`Invalid YAML generated: ${(err as Error).message}`);
  }
}
