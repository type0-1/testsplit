import fs from 'fs';
import path from 'path';
import { TestResult } from '../../models/TestResult';

const WARN_INLINE_LIMIT = 10;
const REPORTS_DIR = path.resolve('.data', 'reports');

export function reportZeroDurationTests(zeroDuration: TestResult[]): void {
  if (zeroDuration.length === 0) return;

  if (zeroDuration.length > WARN_INLINE_LIMIT) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(REPORTS_DIR, 'zero-duration.txt'), zeroDuration.map((t) => t.name).join('\n') + '\n');
    console.warn(`Warning: ${zeroDuration.length} test(s) reported zero duration (sub-millisecond), these will be scheduled with equal weight - see .data/reports/zero-duration.txt`);
    return;
  }

  const preview = zeroDuration.map((t) => t.name).join(', ');
  console.warn(`Warning: ${zeroDuration.length} test(s) reported zero duration (sub-millisecond), these will be scheduled with equal weight: ${preview}`);
}

export function reportOutlierTests(outliers: string[]): void {
  if (outliers.length === 0) return;

  if (outliers.length > WARN_INLINE_LIMIT) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(REPORTS_DIR, 'outliers.txt'), outliers.join('\n') + '\n');
    console.warn(`Warning: ${outliers.length} test(s) have outlier durations within this run - see .data/reports/outliers.txt`);
    return;
  }

  const preview = outliers.join(', ');
  console.warn(`Warning: ${outliers.length} test(s) have outlier durations within this run: ${preview}`);
}
