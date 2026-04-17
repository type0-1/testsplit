import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as zlib from 'zlib';
import { rotateHistoricalDeltas, cleanupOldArchivedDeltas } from '../../../../src/backend/storage/DeltaStore';

function writeFakeJsonDelta(dir: string, name: string, content = '{}'): void {
  fs.writeFileSync(path.join(dir, name), content, 'utf-8');
}

function writeFakeGzDelta(dir: string, name: string): void {
  const gz = zlib.gzipSync(Buffer.from('{}', 'utf-8'));
  fs.writeFileSync(path.join(dir, name), gz);
}

describe('rotateHistoricalDeltas', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deltastore-rotate-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('does nothing when uncompressed delta count is at or below the limit', () => {
    for (let i = 0; i < 50; i++) {
      writeFakeJsonDelta(tempDir, `delta-${String(i).padStart(5, '0')}.json`);
    }

    rotateHistoricalDeltas(tempDir);

    const jsonFiles = fs.readdirSync(tempDir).filter((f) => f.endsWith('.json'));
    expect(jsonFiles).toHaveLength(50);
  });

  it('compresses oldest files when count exceeds 50', () => {
    for (let i = 0; i < 55; i++) {
      writeFakeJsonDelta(tempDir, `delta-${String(i).padStart(5, '0')}.json`);
    }

    rotateHistoricalDeltas(tempDir);

    const jsonFiles = fs.readdirSync(tempDir).filter((f) => f.endsWith('.json') && !f.endsWith('.gz'));
    const gzFiles = fs.readdirSync(tempDir).filter((f) => f.endsWith('.json.gz'));

    expect(jsonFiles).toHaveLength(50);
    expect(gzFiles).toHaveLength(5);
  });

  it('removes the original .json file after compressing', () => {
    for (let i = 0; i < 51; i++) {
      writeFakeJsonDelta(tempDir, `delta-${String(i).padStart(5, '0')}.json`);
    }

    rotateHistoricalDeltas(tempDir);

    expect(fs.existsSync(path.join(tempDir, 'delta-00000.json'))).toBe(false);
    expect(fs.existsSync(path.join(tempDir, 'delta-00000.json.gz'))).toBe(true);
  });

  it('does not touch non-delta json files', () => {
    writeFakeJsonDelta(tempDir, 'other-file.json');
    for (let i = 0; i < 51; i++) {
      writeFakeJsonDelta(tempDir, `delta-${String(i).padStart(5, '0')}.json`);
    }

    rotateHistoricalDeltas(tempDir);

    expect(fs.existsSync(path.join(tempDir, 'other-file.json'))).toBe(true);
  });
});

describe('cleanupOldArchivedDeltas', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deltastore-cleanup-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('does nothing when archived count is at or below the limit', () => {
    for (let i = 0; i < 500; i++) {
      writeFakeGzDelta(tempDir, `delta-${String(i).padStart(5, '0')}.json.gz`);
    }

    cleanupOldArchivedDeltas(tempDir);

    const gzFiles = fs.readdirSync(tempDir).filter((f) => f.endsWith('.json.gz'));
    expect(gzFiles).toHaveLength(500);
  });

  it('deletes oldest archived files when count exceeds 500', () => {
    for (let i = 0; i < 505; i++) {
      writeFakeGzDelta(tempDir, `delta-${String(i).padStart(5, '0')}.json.gz`);
    }

    cleanupOldArchivedDeltas(tempDir);

    const gzFiles = fs.readdirSync(tempDir).filter((f) => f.endsWith('.json.gz'));
    expect(gzFiles).toHaveLength(500);
  });

  it('deletes the oldest (alphabetically first) files', () => {
    for (let i = 0; i < 502; i++) {
      writeFakeGzDelta(tempDir, `delta-${String(i).padStart(5, '0')}.json.gz`);
    }

    cleanupOldArchivedDeltas(tempDir);

    expect(fs.existsSync(path.join(tempDir, 'delta-00000.json.gz'))).toBe(false);
    expect(fs.existsSync(path.join(tempDir, 'delta-00001.json.gz'))).toBe(false);
    expect(fs.existsSync(path.join(tempDir, 'delta-00002.json.gz'))).toBe(true);
  });
});
