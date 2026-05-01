import chalk from 'chalk';
import { COL_LABEL, COL_VALUE, COL_DELTA } from '../constants';

export function deltaStr(prev: number, curr: number, unit: string, lowerIsBetter: boolean): string {
  const diff = curr - prev;
  const sign = diff >= 0 ? '+' : '';
  const str = `${sign}${diff.toFixed(2)}${unit}`;
  if (diff === 0) return str;
  const improved = lowerIsBetter ? diff < 0 : diff > 0;
  return improved ? chalk.green(str) : chalk.red(str);
}

export function row(label: string, valA: string, valB: string, delta: string): void {
  console.log(
    label.padEnd(COL_LABEL) +
      valA.padStart(COL_VALUE) +
      valB.padStart(COL_VALUE) +
      delta.padStart(COL_DELTA),
  );
}
