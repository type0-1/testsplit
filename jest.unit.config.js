const base = require('./jest.base.config');

module.exports = {
  ...base,
  testMatch: ['**/__tests__/**/unit/**/*.test.ts'],
};
