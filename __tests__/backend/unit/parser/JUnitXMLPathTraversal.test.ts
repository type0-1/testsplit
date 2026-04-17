import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseJUnitXMLPath } from '../../../../src/backend/parser/JUnitXMLPathTraversal';

describe('JUnitXMLPathTraversal', () => {
  test('parses a single xml file', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'path-traversal-single-'));
    const file = path.join(tempDir, 'report.xml');
    fs.writeFileSync(file, '<testsuite/>', 'utf-8');

    const parseXMLFile = jest.fn().mockReturnValue([{ id: 'single' }]);

    try {
      const results = parseJUnitXMLPath(file, parseXMLFile);
      expect(parseXMLFile).toHaveBeenCalledTimes(1);
      expect(parseXMLFile).toHaveBeenCalledWith(file);
      expect(results).toEqual([{ id: 'single' }]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('ignores non-xml files', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'path-traversal-non-xml-'));
    const file = path.join(tempDir, 'report.txt');
    fs.writeFileSync(file, 'not xml', 'utf-8');

    const parseXMLFile = jest.fn().mockReturnValue([{ id: 'x' }]);

    try {
      const results = parseJUnitXMLPath(file, parseXMLFile);
      expect(results).toEqual([]);
      expect(parseXMLFile).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('recursively parses xml files in nested directories only', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'path-traversal-recursive-'));
    const nested = path.join(tempDir, 'nested');
    fs.mkdirSync(nested, { recursive: true });

    const a = path.join(tempDir, 'a.xml');
    const b = path.join(nested, 'b.xml');
    const ignore = path.join(nested, 'ignore.md');

    fs.writeFileSync(a, '<testsuite/>', 'utf-8');
    fs.writeFileSync(b, '<testsuite/>', 'utf-8');
    fs.writeFileSync(ignore, '# ignore', 'utf-8');

    const parseXMLFile = jest.fn((filePath: string) => [{ filePath }]);

    try {
      const results = parseJUnitXMLPath(tempDir, parseXMLFile);
      const parsedFiles = results.map((r) => r.filePath).sort();

      expect(parsedFiles).toEqual([a, b].sort());
      expect(parseXMLFile).toHaveBeenCalledTimes(2);
      expect(parseXMLFile).toHaveBeenCalledWith(a);
      expect(parseXMLFile).toHaveBeenCalledWith(b);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
