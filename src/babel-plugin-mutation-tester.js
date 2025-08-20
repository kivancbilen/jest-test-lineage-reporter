/**
 * Babel Plugin for Mutation Testing
 * Creates targeted mutations for specific lines based on lineage tracking data
 */

/**
 * Creates a mutation testing plugin that targets a specific line and mutation type
 * @param {number} targetLine - Line number to mutate
 * @param {string} mutationType - Type of mutation to apply
 * @param {Object} config - Mutation configuration
 */
function createMutationPlugin(targetLine, mutationType, config = {}) {
  return function({ types: t }, options = {}) {
    return {
      name: 'mutation-tester',
      visitor: {
        Program: {
          enter(path, state) {
            state.filename = state.file.opts.filename;
            state.shouldMutate = false;
            state.mutationApplied = false;
            state.targetLine = targetLine;
            state.mutationType = mutationType;
            state.config = { ...config, ...options };
          }
        },

        // ARITHMETIC OPERATORS: +, -, *, /, %
        BinaryExpression(path, state) {
          if (!shouldApplyMutation(path, state, 'arithmetic')) return;

          const operator = path.node.operator;
          const mutations = {
            '+': '-',   // Addition to Subtraction
            '-': '+',   // Subtraction to Addition  
            '*': '/',   // Multiplication to Division
            '/': '*',   // Division to Multiplication
            '%': '*',   // Modulo to Multiplication
            '==': '!=', // Equality to Inequality
            '!=': '==', // Inequality to Equality
            '===': '!==', // Strict equality to strict inequality
            '!==': '===', // Strict inequality to strict equality
            '<': '>=',  // Less than to Greater/Equal
            '>': '<=',  // Greater than to Less/Equal
            '<=': '>',  // Less/Equal to Greater
            '>=': '<'   // Greater/Equal to Less
          };

          if (mutations[operator]) {
            path.node.operator = mutations[operator];
            state.mutationApplied = true;
            logMutation(state, `${operator} → ${mutations[operator]}`);
          }
        },

        // LOGICAL OPERATORS: &&, ||
        LogicalExpression(path, state) {
          if (!shouldApplyMutation(path, state, 'logical')) return;

          const operator = path.node.operator;
          const mutations = {
            '&&': '||',  // AND to OR
            '||': '&&'   // OR to AND
          };

          if (mutations[operator]) {
            path.node.operator = mutations[operator];
            state.mutationApplied = true;
            logMutation(state, `${operator} → ${mutations[operator]}`);
          }
        },

        // UNARY OPERATORS: !, ++, --
        UnaryExpression(path, state) {
          if (!shouldApplyMutation(path, state, 'logical')) return;

          if (path.node.operator === '!') {
            // Remove negation: !condition → condition
            path.replaceWith(path.node.argument);
            state.mutationApplied = true;
            logMutation(state, '! → (removed)');
          }
        },

        // UPDATE EXPRESSIONS: ++, --
        UpdateExpression(path, state) {
          if (!shouldApplyMutation(path, state, 'increments')) return;

          const operator = path.node.operator;
          const mutations = {
            '++': '--',  // Increment to Decrement
            '--': '++'   // Decrement to Increment
          };

          if (mutations[operator]) {
            path.node.operator = mutations[operator];
            state.mutationApplied = true;
            logMutation(state, `${operator} → ${mutations[operator]}`);
          }
        },

        // ASSIGNMENT OPERATORS: =, +=, -=, etc.
        AssignmentExpression(path, state) {
          if (!shouldApplyMutation(path, state, 'assignment')) return;

          const operator = path.node.operator;
          const mutations = {
            '+=': '-=',  // Add-assign to Subtract-assign
            '-=': '+=',  // Subtract-assign to Add-assign
            '*=': '/=',  // Multiply-assign to Divide-assign
            '/=': '*=',  // Divide-assign to Multiply-assign
            '%=': '*='   // Modulo-assign to Multiply-assign
          };

          if (mutations[operator]) {
            path.node.operator = mutations[operator];
            state.mutationApplied = true;
            logMutation(state, `${operator} → ${mutations[operator]}`);
          }
        },

        // CONDITIONAL STATEMENTS: if, while, for
        IfStatement(path, state) {
          if (!shouldApplyMutation(path, state, 'conditional')) return;

          // Negate condition: if (x > 0) → if (!(x > 0))
          const { types: t } = require('@babel/core');
          path.node.test = t.unaryExpression('!', t.parenthesizedExpression(path.node.test));
          state.mutationApplied = true;
          logMutation(state, 'if condition → !(condition)');
        },

        // WHILE LOOPS
        WhileStatement(path, state) {
          if (!shouldApplyMutation(path, state, 'conditional')) return;

          const { types: t } = require('@babel/core');
          path.node.test = t.unaryExpression('!', t.parenthesizedExpression(path.node.test));
          state.mutationApplied = true;
          logMutation(state, 'while condition → !(condition)');
        },

        // FOR LOOPS
        ForStatement(path, state) {
          if (!shouldApplyMutation(path, state, 'conditional')) return;

          // Only mutate if there's a test condition
          if (path.node.test) {
            const { types: t } = require('@babel/core');
            path.node.test = t.unaryExpression('!', t.parenthesizedExpression(path.node.test));
            state.mutationApplied = true;
            logMutation(state, 'for condition → !(condition)');
          }
        },

        // RETURN STATEMENTS
        ReturnStatement(path, state) {
          if (!shouldApplyMutation(path, state, 'returns')) return;

          const { types: t } = require('@babel/core');

          if (path.node.argument) {
            // Apply type-safe mutations based on the argument type
            if (t.isNumericLiteral(path.node.argument)) {
              // For numbers, change to 0 instead of null to avoid type errors
              const originalValue = path.node.argument.value;
              const newValue = originalValue === 0 ? 1 : 0;
              path.node.argument = t.numericLiteral(newValue);
              state.mutationApplied = true;
              logMutation(state, `return ${originalValue} → return ${newValue}`);
            } else if (t.isBooleanLiteral(path.node.argument)) {
              // For booleans, flip the value
              const originalValue = path.node.argument.value;
              path.node.argument = t.booleanLiteral(!originalValue);
              state.mutationApplied = true;
              logMutation(state, `return ${originalValue} → return ${!originalValue}`);
            } else if (t.isStringLiteral(path.node.argument)) {
              // For strings, change to empty string
              const originalValue = path.node.argument.value;
              path.node.argument = t.stringLiteral("");
              state.mutationApplied = true;
              logMutation(state, `return "${originalValue}" → return ""`);
            } else if (t.isBinaryExpression(path.node.argument)) {
              // For binary expressions like a + b, try to mutate the operator or operands
              const expr = path.node.argument;
              if (expr.operator === '+') {
                // Change + to - for arithmetic expressions
                expr.operator = '-';
                state.mutationApplied = true;
                logMutation(state, `return a + b → return a - b`);
              } else if (expr.operator === '-') {
                // Change - to + for arithmetic expressions
                expr.operator = '+';
                state.mutationApplied = true;
                logMutation(state, `return a - b → return a + b`);
              } else if (expr.operator === '*') {
                // Change * to / for arithmetic expressions
                expr.operator = '/';
                state.mutationApplied = true;
                logMutation(state, `return a * b → return a / b`);
              } else if (expr.operator === '/') {
                // Change / to * for arithmetic expressions
                expr.operator = '*';
                state.mutationApplied = true;
                logMutation(state, `return a / b → return a * b`);
              } else {
                // For other binary expressions, skip to avoid breaking module loading
                logMutation(state, `return expression → skipped (complex binary expression)`);
              }
            } else {
              // For other complex expressions, skip mutation to avoid breaking module loading
              // This is more conservative but safer
              logMutation(state, `return expression → skipped (complex expression)`);
            }
          }
        },

        // LITERAL VALUES: numbers, booleans, strings
        Literal(path, state) {
          if (!shouldApplyMutation(path, state, 'literals')) return;

          const value = path.node.value;

          if (typeof value === 'number') {
            // Mutate numbers: 5 → 0, 0 → 1, negative → positive
            const newValue = value === 0 ? 1 : (value > 0 ? 0 : Math.abs(value));
            path.node.value = newValue;
            state.mutationApplied = true;
            logMutation(state, `${value} → ${newValue}`);
          } else if (typeof value === 'boolean') {
            // Flip booleans: true → false, false → true
            path.node.value = !value;
            state.mutationApplied = true;
            logMutation(state, `${value} → ${!value}`);
          } else if (typeof value === 'string' && value.length > 0) {
            // Empty strings: "hello" → ""
            path.node.value = "";
            state.mutationApplied = true;
            logMutation(state, `"${value}" → ""`);
          }
        },

        // NUMERIC LITERALS (for newer Babel versions)
        NumericLiteral(path, state) {
          if (!shouldApplyMutation(path, state, 'literals')) return;

          const value = path.node.value;
          const newValue = value === 0 ? 1 : (value > 0 ? 0 : Math.abs(value));
          path.node.value = newValue;
          state.mutationApplied = true;
          logMutation(state, `${value} → ${newValue}`);
        },

        // BOOLEAN LITERALS
        BooleanLiteral(path, state) {
          if (!shouldApplyMutation(path, state, 'literals')) return;

          const value = path.node.value;
          path.node.value = !value;
          state.mutationApplied = true;
          logMutation(state, `${value} → ${!value}`);
        },

        // STRING LITERALS
        StringLiteral(path, state) {
          if (!shouldApplyMutation(path, state, 'literals')) return;

          const value = path.node.value;
          if (value.length > 0) {
            path.node.value = "";
            state.mutationApplied = true;
            logMutation(state, `"${value}" → ""`);
          }
        }
      }
    };
  };
}

/**
 * Determines if a mutation should be applied to the current node
 */
function shouldApplyMutation(path, state, operatorType) {
  const lineNumber = path.node.loc?.start.line;
  
  // Check if this is the target line
  if (lineNumber !== state.targetLine) {
    return false;
  }

  // Check if this operator type is enabled
  if (state.config.mutationOperators && !state.config.mutationOperators[operatorType]) {
    return false;
  }

  // Check if we've already applied a mutation (one per line)
  if (state.mutationApplied) {
    return false;
  }

  return true;
}

/**
 * Logs mutation information
 */
function logMutation(state, description) {
  if (state.config.enableDebugLogging) {
    console.log(`🧬 Mutation applied at ${state.filename}:${state.targetLine} - ${description}`);
  }
}

/**
 * Gets all possible mutations for a given line of code by analyzing the AST
 */
function getPossibleMutations(filePath, lineNumber, sourceCode) {
  try {
    const babel = require('@babel/core');
    const fs = require('fs');

    // Read the full file content
    const fullFileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fullFileContent.split('\n');
    const targetLine = lines[lineNumber - 1];

    if (!targetLine) return [];

    const possibleMutations = [];

    // Parse the entire file to get proper AST context
    const ast = babel.parseSync(fullFileContent, {
      filename: filePath,
      parserOpts: {
        sourceType: "module",
        allowImportExportEverywhere: true,
        plugins: ["typescript", "jsx"],
      },
    });

    // Traverse the AST to find nodes on the target line
    babel.traverse(ast, {
      enter(path) {
        const nodeLineNumber = path.node.loc?.start.line;
        if (nodeLineNumber !== lineNumber) return;

        // Check what types of mutations are possible based on the AST nodes
        if (path.isBinaryExpression()) {
          const operator = path.node.operator;
          if (['+', '-', '*', '/', '%'].includes(operator)) {
            possibleMutations.push('arithmetic');
          }
          if (['==', '!=', '===', '!==', '<', '>', '<=', '>='].includes(operator)) {
            possibleMutations.push('comparison');
          }
        }

        if (path.isLogicalExpression()) {
          possibleMutations.push('logical');
        }

        if (path.isUnaryExpression() && path.node.operator === '!') {
          possibleMutations.push('logical');
        }

        if (path.isUpdateExpression()) {
          possibleMutations.push('increments');
        }

        if (path.isAssignmentExpression() && path.node.operator !== '=') {
          possibleMutations.push('assignment');
        }

        // Only add conditional mutations for actual conditional statements
        if (path.isIfStatement() || path.isWhileStatement() ||
            (path.isForStatement() && path.node.test)) {
          possibleMutations.push('conditional');
        }

        if (path.isReturnStatement()) {
          possibleMutations.push('returns');
        }

        if (path.isLiteral() || path.isNumericLiteral() ||
            path.isBooleanLiteral() || path.isStringLiteral()) {
          possibleMutations.push('literals');
        }
      }
    });

    // Remove duplicates
    return [...new Set(possibleMutations)];

  } catch (error) {
    // If AST analysis fails, return empty array to skip this line
    return [];
  }
}

module.exports = {
  createMutationPlugin,
  getPossibleMutations
};
