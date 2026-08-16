'use strict';

module.exports = {
  preset: '../../../jest-preset.front.js',
  displayName: 'Core ecommerce-base',
  moduleNameMapper: {
    '^@tests/(.*)$': '<rootDir>/admin/tests/$1',
  },
  setupFilesAfterEnv: ['./admin/tests/setup.ts'],
};
