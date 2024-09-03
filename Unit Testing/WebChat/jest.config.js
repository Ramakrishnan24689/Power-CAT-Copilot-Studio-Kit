module.exports = {
  setupFilesAfterEnv: ['<rootDir>/setupJest.ts'],
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx|mjs)$': 'babel-jest', // Updated to handle .mjs files
  },
  moduleNameMapper: {
    '\\.css$': 'identity-obj-proxy', // Mocks CSS imports
  },
  transformIgnorePatterns: [
    '/node_modules/(?!react-markdown|remark-gfm|devlop|swiper|adaptivecards)/',
  ],
};
