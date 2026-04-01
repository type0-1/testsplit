import { generateRunId } from '../../../../src/backend/helpers/RunId';

describe('generateRunId', () => {
  it('returns ISO timestamp with colons and dots replaced by hyphens', () => {
    const dateSpy = jest
      .spyOn(global, 'Date')
      .mockImplementation(() => ({
        toISOString: () => '2026-04-01T12:34:56.789Z',
      } as any));

    const runId = generateRunId();

    expect(runId).toBe('2026-04-01T12-34-56-789Z');
    expect(runId).not.toContain(':');
    expect(runId).not.toContain('.');

    dateSpy.mockRestore();
  });

  it('preserves other ISO characters and shape', () => {
    const dateSpy = jest
      .spyOn(global, 'Date')
      .mockImplementation(() => ({
        toISOString: () => '2030-01-02T03:04:05.006Z',
      } as any));

    const runId = generateRunId();

    expect(runId).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/);

    dateSpy.mockRestore();
  });
});
