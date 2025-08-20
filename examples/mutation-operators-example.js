/**
 * Example: Simple Mutation Operators for Your Existing Babel Plugin
 * This shows how easy it would be to add mutation capabilities
 */

// Add these to your existing babel-plugin-lineage-tracker.js visitor:

const mutationOperators = {
  // 1. ARITHMETIC OPERATORS (5 minutes to implement)
  BinaryExpression(path, state) {
    if (!state.shouldMutate) return;
    
    const operator = path.node.operator;
    const mutations = {
      '+': '-',   // Addition to Subtraction
      '-': '+',   // Subtraction to Addition  
      '*': '/',   // Multiplication to Division
      '/': '*',   // Division to Multiplication
      '%': '*',   // Modulo to Multiplication
      '==': '!=', // Equality to Inequality
      '!=': '==', // Inequality to Equality
      '<': '>=',  // Less than to Greater/Equal
      '>': '<=',  // Greater than to Less/Equal
      '<=': '>',  // Less/Equal to Greater
      '>=': '<'   // Greater/Equal to Less
    };
    
    if (mutations[operator]) {
      path.node.operator = mutations[operator];
      state.mutationApplied = true;
    }
  },

  // 2. LOGICAL OPERATORS (3 minutes to implement)
  LogicalExpression(path, state) {
    if (!state.shouldMutate) return;
    
    const operator = path.node.operator;
    const mutations = {
      '&&': '||',  // AND to OR
      '||': '&&'   // OR to AND
    };
    
    if (mutations[operator]) {
      path.node.operator = mutations[operator];
      state.mutationApplied = true;
    }
  },

  // 3. UNARY OPERATORS (2 minutes to implement)
  UnaryExpression(path, state) {
    if (!state.shouldMutate) return;
    
    if (path.node.operator === '!') {
      // Remove negation: !condition -> condition
      path.replaceWith(path.node.argument);
      state.mutationApplied = true;
    }
  },

  // 4. CONDITIONAL BOUNDARIES (5 minutes to implement)
  IfStatement(path, state) {
    if (!state.shouldMutate) return;
    
    // Negate condition: if (x > 0) -> if (!(x > 0))
    const { types: t } = require('@babel/core');
    path.node.test = t.unaryExpression('!', path.node.test);
    state.mutationApplied = true;
  },

  // 5. RETURN VALUES (3 minutes to implement)
  ReturnStatement(path, state) {
    if (!state.shouldMutate) return;
    
    const { types: t } = require('@babel/core');
    
    // Return null instead of actual value
    if (path.node.argument) {
      path.node.argument = t.nullLiteral();
      state.mutationApplied = true;
    }
  },

  // 6. LITERAL VALUES (5 minutes to implement)
  Literal(path, state) {
    if (!state.shouldMutate) return;
    
    const { types: t } = require('@babel/core');
    const value = path.node.value;
    
    if (typeof value === 'number') {
      // Mutate numbers: 5 -> 0, 0 -> 1
      path.node.value = value === 0 ? 1 : 0;
      state.mutationApplied = true;
    } else if (typeof value === 'boolean') {
      // Flip booleans: true -> false, false -> true
      path.node.value = !value;
      state.mutationApplied = true;
    } else if (typeof value === 'string' && value.length > 0) {
      // Empty strings: "hello" -> ""
      path.node.value = "";
      state.mutationApplied = true;
    }
  }
};

// Usage in your existing plugin:
function createMutationPlugin(targetLine, mutationType) {
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
          }
        },
        
        // Apply mutation only to the target line
        [mutationType](path, state) {
          const lineNumber = path.node.loc?.start.line;
          if (lineNumber === state.targetLine) {
            state.shouldMutate = true;
            mutationOperators[mutationType](path, state);
          }
        }
      }
    };
  };
}

// Example usage:
// const mutationPlugin = createMutationPlugin(7, 'BinaryExpression');
// This would mutate line 7 if it contains a binary expression
