module.exports = {
  setupFilesAfterEnv: ['<rootDir>/setupJest.ts'],
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx|mjs)$': 'babel-jest',
  },
  moduleNameMapper: {
    '\\.css$': 'identity-obj-proxy',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!react-markdown|remark-gfm|devlop|swiper|adaptivecards)/',
  ],
};
