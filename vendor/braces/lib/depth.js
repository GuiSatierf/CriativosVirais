'use strict';

// Keep recursive upstream walkers well below the Node.js call-stack limit.
const MAX_DEPTH = 64;
const fail = () => {
  const error = new SyntaxError(`Pattern nesting exceeds the limit of ${MAX_DEPTH}`);
  error.code = 'ERR_BRACES_DEPTH';
  throw error;
};

exports.assertCanNest = stack => {
  if (stack.length > MAX_DEPTH) fail();
};

// Public APIs also accept ASTs, so guarding only the string parser is insufficient.
// Traverse nodes iteratively; parent/prev links intentionally point back into the AST.
exports.assertAstDepth = ast => {
  const stack = [[ast, 0]];
  const seen = new Set();
  while (stack.length) {
    const [node, depth] = stack.pop();
    if (depth > MAX_DEPTH + 1 || seen.has(node)) fail();
    seen.add(node);
    if (node.nodes) {
      for (const child of node.nodes) stack.push([child, depth + 1]);
    }
  }
};
