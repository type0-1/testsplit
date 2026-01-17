export function renderBar(value: number, max: number, width = 20): string {
  if (max <= 0) {
    return '░'.repeat(width);
  }

  const filledLength = Math.round((value / max) * width);
  const filled = '█'.repeat(filledLength);
  const empty = '░'.repeat(width - filledLength);

  return filled + empty;
}