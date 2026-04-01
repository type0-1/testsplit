import { renderBar } from '../../../../src/backend/utils/Terminal';

describe('renderBar', () => {
  test('returns an empty bar when max is zero or less', () => {
    expect(renderBar(5, 0, 10)).toBe('░'.repeat(10));
    expect(renderBar(5, -1, 8)).toBe('░'.repeat(8));
  });

  test('renders filled and empty sections proportionally', () => {
    expect(renderBar(5, 10, 10)).toBe('█'.repeat(5) + '░'.repeat(5));
  });

  test('uses a default width of 20', () => {
    expect(renderBar(10, 10)).toBe('█'.repeat(20));
  });
});
