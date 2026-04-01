jest.mock('chalk', () => ({
  __esModule: true,
  default: {
    green: jest.fn((msg: string) => `GREEN:${msg}`),
    yellow: jest.fn((msg: string) => `YELLOW:${msg}`),
    red: jest.fn((msg: string) => `RED:${msg}`),
    cyan: jest.fn((msg: string) => `CYAN:${msg}`),
  },
}));

import chalk from 'chalk';
import { success, warning, error, info } from '../../../../src/backend/utils/cliColors';

describe('cliColors', () => {
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('success logs a green check message', () => {
    success('Done');

    expect(chalk.green).toHaveBeenCalledWith('✔ Done');
    expect(logSpy).toHaveBeenCalledWith('GREEN:✔ Done');
  });

  test('warning warns with a yellow warning message', () => {
    warning('Careful');

    expect(chalk.yellow).toHaveBeenCalledWith('⚠ Careful');
    expect(warnSpy).toHaveBeenCalledWith('YELLOW:⚠ Careful');
  });

  test('error logs an error with a red cross message', () => {
    error('Failed');

    expect(chalk.red).toHaveBeenCalledWith('✖ Failed');
    expect(errorSpy).toHaveBeenCalledWith('RED:✖ Failed');
  });

  test('info logs a cyan message without a symbol', () => {
    info('Heads up');

    expect(chalk.cyan).toHaveBeenCalledWith('Heads up');
    expect(logSpy).toHaveBeenCalledWith('CYAN:Heads up');
  });
});
