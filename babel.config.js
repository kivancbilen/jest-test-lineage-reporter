module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: {
        node: 'current'
      }
    }],
    '@babel/preset-typescript'
  ],
  plugins: [
    // Our custom lineage tracking plugin
    './src/babel-plugin-lineage-tracker.js'
  ],
  // Only apply instrumentation in test environment
  env: {
    test: {
      plugins: [
        './src/babel-plugin-lineage-tracker.js'
      ]
    }
  }
};
