export type CIPlatform = 'github' | 'gitlab';

export interface CISchemaValidator {
  validate(yaml: string): void;
}
