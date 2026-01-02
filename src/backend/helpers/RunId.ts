// Helper for generating a run id via date in iso format

export function generateRunId(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}
