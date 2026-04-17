import fs from 'fs';
import path from 'path';
import { TestResult } from '../../models/TestResult';

const WARN_INLINE_LIMIT = 10;
const REPORTS_DIR = path.resolve('.data', 'reports');

export function reportZeroDurationTests(zeroDuration: TestResult[]): void {
  if (zeroDuration.length === 0) return;

  const preview = zeroDuration.slice(0, WARN_INLINE_LIMIT).map((t) => t.name).join(', ');
  const suffix = zeroDuration.length > WARN_INLINE_LIMIT
    ? ` (and ${zeroDuration.length - WARN_INLINE_LIMIT} more - see .data/reports/zero-duration.txt)`
    : '';
  console.warn(`Warning: ${zeroDuration.length} test(s) reported zero duration (sub-millisecond), these will be scheduled with equal weight: ${preview}${suffix}`);

  if (zeroDuration.length > WARN_INLINE_LIMIT) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(REPORTS_DIR, 'zero-duration.txt'), zeroDuration.map((t) => t.name).join('\n') + '\n');
  }
}

export function reportOutlierTests(outliers: string[]): void {
  if (outliers.length === 0) return;

  const preview = outliers.slice(0, WARN_INLINE_LIMIT).join(', ');
  const suffix = outliers.length > WARN_INLINE_LIMIT
    ? ` (and ${outliers.length - WARN_INLINE_LIMIT} more - see .data/reports/outliers.txt)`
    : '';
  console.warn(`Warning: ${outliers.length} test(s) have outlier durations within this run: ${preview}${suffix}`);

  if (outliers.length > WARN_INLINE_LIMIT) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(REPORTS_DIR, 'outliers.txt'), outliers.join('\n') + '\n');
  }
}
