const base = require('./jest.base.config');

module.exports = {
  ...base,
  testMatch: ['**/__tests__/**/integration/**/*.test.ts'],
};
