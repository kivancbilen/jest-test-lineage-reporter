/**
 * Init Command
 * Initialize jest-test-lineage-reporter in a project
 */

const fs = require('fs');
const path = require('path');
const { success, error, info, warning } = require('../utils/output-formatter');

async function initCommand(options) {
  try {
    const cwd = process.cwd();
    const jestConfigPath = path.join(cwd, 'jest.config.js');
    const babelConfigPath = path.join(cwd, 'babel.config.js');
    const packageJsonPath = path.join(cwd, 'package.json');

    console.log('\n🚀 Initializing jest-test-lineage-reporter...\n');

    // Check if package.json exists
    if (!fs.existsSync(packageJsonPath)) {
      error('No package.json found. Please run "npm init" first.');
      process.exit(1);
    }

    // Read package.json to check dependencies
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const allDeps = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {}),
    };

    // Check for required dependencies
    const requiredDeps = ['jest', 'babel-jest', '@babel/core', '@babel/preset-env'];
    const missingDeps = requiredDeps.filter(dep => !allDeps[dep]);

    if (missingDeps.length > 0) {
      warning('Missing required dependencies:');
      missingDeps.forEach(dep => console.log(`  - ${dep}`));
      console.log('\n💡 Install them with:');
      console.log(`   npm install --save-dev ${missingDeps.join(' ')}\n`);

      if (!options.force) {
        error('Please install missing dependencies first, or use --force to continue anyway.');
        process.exit(1);
      }
    }

    // Create or update Jest config
    let jestConfigCreated = false;
    if (fs.existsSync(jestConfigPath)) {
      if (!options.force) {
        warning(`jest.config.js already exists. Use --force to overwrite.`);
        info('Please manually add the following to your jest.config.js:');
        console.log(`
  setupFilesAfterEnv: ['jest-test-lineage-reporter/src/testSetup.js'],

  reporters: [
    'default',
    ['jest-test-lineage-reporter', {
      outputFile: '.jest-lineage-data.json',
      enableMutationTesting: false,
    }]
  ],

  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.{js,ts}', '!src/**/*.test.{js,ts}'],

  transform: {
    '^.+\\\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
`);
      } else {
        createJestConfig(jestConfigPath, options);
        jestConfigCreated = true;
      }
    } else {
      createJestConfig(jestConfigPath, options);
      jestConfigCreated = true;
    }

    // Create or update Babel config
    let babelConfigCreated = false;
    if (fs.existsSync(babelConfigPath)) {
      if (!options.force) {
        warning(`babel.config.js already exists. Use --force to overwrite.`);
        info('Please manually add the lineage tracker plugin to your babel.config.js:');
        console.log(`
  plugins: [
    'jest-test-lineage-reporter/src/babel-plugin-lineage-tracker.js',
  ],
`);
      } else {
        createBabelConfig(babelConfigPath, options);
        babelConfigCreated = true;
      }
    } else {
      createBabelConfig(babelConfigPath, options);
      babelConfigCreated = true;
    }

    // Summary
    console.log('\n' + '═'.repeat(50));
    if (jestConfigCreated && babelConfigCreated) {
      success('Configuration complete! ✨\n');
      console.log('✅ Created jest.config.js');
      console.log('✅ Created babel.config.js\n');
    } else if (!jestConfigCreated && !babelConfigCreated) {
      info('Configuration files already exist.');
      info('Use --force to overwrite, or manually update the files.\n');
    } else {
      info('Partial configuration completed.');
      if (jestConfigCreated) console.log('✅ Created jest.config.js');
      if (babelConfigCreated) console.log('✅ Created babel.config.js');
      console.log('');
    }

    // Show next steps
    console.log('📋 Next steps:\n');
    if (missingDeps.length > 0) {
      console.log('1. Install missing dependencies:');
      console.log(`   npm install --save-dev ${missingDeps.join(' ')}\n`);
    }
    console.log(`${missingDeps.length > 0 ? '2' : '1'}. Run your tests with lineage tracking:`);
    console.log('   npx jest-lineage test\n');
    console.log(`${missingDeps.length > 0 ? '3' : '2'}. Query coverage data:`);
    console.log('   npx jest-lineage query src/yourfile.js\n');
    console.log(`${missingDeps.length > 0 ? '4' : '3'}. Generate HTML report:`);
    console.log('   npx jest-lineage report --open\n');
    console.log('═'.repeat(50) + '\n');

  } catch (err) {
    error(`Failed to initialize: ${err.message}`);
    if (options.verbose) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

function createJestConfig(filePath, options) {
  const isTypeScript = options.typescript || hasTypeScriptFiles();

  const config = `module.exports = {
  testEnvironment: 'node',

  // Required: Setup file for lineage tracking
  setupFilesAfterEnv: ['jest-test-lineage-reporter/src/testSetup.js'],

  // Add the lineage reporter
  reporters: [
    'default',
    [
      'jest-test-lineage-reporter',
      {
        outputFile: '.jest-lineage-data.json',
        enableMutationTesting: false,
      }
    ]
  ],

  // Enable coverage
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js${isTypeScript ? ',ts' : ''}}',
    '!src/**/*.test.{js${isTypeScript ? ',ts' : ''}}',
    '!src/**/*.d.ts',
  ],

  // Use babel-jest for transformation
  transform: {
    '^.+\\\\.(js|jsx${isTypeScript ? '|ts|tsx' : ''})$': 'babel-jest',
  },

  // File extensions
  moduleFileExtensions: ['js', 'jsx'${isTypeScript ? ", 'ts', 'tsx'" : ''}, 'json'],
};
`;

  fs.writeFileSync(filePath, config, 'utf8');
}

function createBabelConfig(filePath, options) {
  const isTypeScript = options.typescript || hasTypeScriptFiles();

  const config = `module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],${isTypeScript ? `
    '@babel/preset-typescript',` : ''}
  ],
  plugins: [
    // Required: Lineage tracker plugin for instrumentation
    'jest-test-lineage-reporter/src/babel-plugin-lineage-tracker.js',
  ],
};
`;

  fs.writeFileSync(filePath, config, 'utf8');
}

function hasTypeScriptFiles() {
  const cwd = process.cwd();
  const srcDir = path.join(cwd, 'src');

  if (!fs.existsSync(srcDir)) return false;

  try {
    const files = fs.readdirSync(srcDir);
    return files.some(file => file.endsWith('.ts') || file.endsWith('.tsx'));
  } catch {
    return false;
  }
}

module.exports = initCommand;
