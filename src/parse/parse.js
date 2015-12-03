'use strict';

/* global _ */
/* eslint no-use-before-define: 0 */

/*****************************************/
// PARSE FUNCTION (ENTRY POINT)
/*****************************************/

//constants
var ESCAPES = {'n':'\n', 'f':'\f', 'r':'\r', 't':'\t', 'v':'\v', '\'':'\'', '"':'"'};
var OPERATORS = {
  '+': true,
  '!': true,
  '-': true,
  '*': true,
  '/': true,
  '%': true,
  '=': true,
  '==': true,
  '!=': true,
  '===': true,
  '!==': true,
  '<': true,
  '>': true,
  '<=': true,
  '>=': true,
  '&&': true,
  '||': true,
  '|' : true
};


/**
 * @description When parse is run a new Lexer and a new Parser is created with the
 * new Lexer, which we're calling 'lexer'.
 *
 * @param {String} expr
 */
function parse(expr) {
  switch (typeof expr) {
    case 'string':
      var lexer = new Lexer();
      var parser = new Parser(lexer); // We're creating a new parser from the Parser constructor so we can run the parser on that where we will have the lexer having already run and ready to process the expr.
      var oneTime = false;
      if (expr.charAt(0) === ':' && expr.charAt(1) === ':') {
        oneTime = true;
        expr = expr.substring(2);
      }

      var parseFn = parser.parse(expr); // Here we're calling the Parser.prototype.parse with expr as an argument and returning those results.
      if (parseFn.constant) {
        parseFn.$$watchDelegate = constantWatchDelegate;
      }
      else if (oneTime) {
        parseFn.$$watchDelegate = parseFn.literal ? oneTimeLiteralWatchDelegate : oneTimeWatchDelegate;
      }
      else if (parseFn.inputs) {
        parseFn.$$watchDelegate = inputsWatchDelegate;
      }

      return parseFn;

    case 'function':
      return expr;
    default:
      return _.noop;
  }
}

/**
 * @class
 * @param lexer
 * @constructor
 */
function Parser(lexer) {
  this.lexer = lexer;
  this.ast = new AST(this.lexer);
  this.astCompiler = new ASTCompiler(this.ast);
}

//this is where it all gets kicked off, folks!

/**
 * @lends Parser.prototype
 * @param {String} text
 */
Parser.prototype.parse = function (text) {
  return this.astCompiler.compile(text); // Here we're actually running 'this.astCompiler' with the AST that has already been fed the lexer for this case.
};

function isLiteral(ast) {
  return ast.body.length === 0 ||
      ast.body.length === 1 && (
      ast.body[0].type === AST.Literal ||
      ast.body[0].type === AST.ArrayExpression ||
      ast.body[0].type === AST.ObjectExpression);
}

function markConstantAndWatchExpressions(ast) {
  var allConstants;
  var argsToWatch;
  switch (ast.type) {
    case AST.Program:
      allConstants = true;
      _.forEach(ast.body, function (expr) {
        markConstantAndWatchExpressions(expr);
        allConstants = allConstants && expr.constant;
      });
      ast.constant = allConstants;
      break;
    case AST.Literal:
      ast.constant = true;
      ast.toWatch = [];
      break;

    case AST.Identifier:
      ast.constant = false;
      ast.toWatch = [ast];
      break;

    case AST.ArrayExpression:
      allConstants = true;
      argsToWatch = [];
      _.forEach(ast.elements, function (element) {
        markConstantAndWatchExpressions(element);
        allConstants = allConstants && element.constant;
        if (!element.constant) {
          argsToWatch.push.apply(argsToWatch, element.toWatch);
        }
      });
      ast.constant = allConstants;
      ast.toWatch = argsToWatch;
      break;

    case AST.ObjectExpression:
      allConstants = true;
      argsToWatch = [];
      _.forEach(ast.properties, function (property) {
        markConstantAndWatchExpressions(property.value);
        allConstants = allConstants && property.value.constant;
        if (!property.value.constant) {
          argsToWatch.push.apply(argsToWatch, property.value.toWatch);
        }
      });
      ast.constant = allConstants;
      ast.toWatch = argsToWatch;
      break;

    case AST.ThisExpression:
      ast.constant = false;
      ast.toWatch = [];
      break;

    case AST.MemberExpression:
      markConstantAndWatchExpressions(ast.object);
      if (ast.computed) {
        markConstantAndWatchExpressions(ast.property);
      }
      ast.constant = ast.object.constant && (!ast.computed || ast.property.constant);
      ast.toWatch = [ast];
      break;

    case AST.CallExpression:
      var stateless = ast.filter && !filter(ast.callee.name).$stateful;
      allConstants = stateless ? true : false;
      argsToWatch = [];
      if (allConstants) { // TODO: Is this really a good, working optimization?
        _.forEach(ast.arguments, function(arg) {
          markConstantAndWatchExpressions(arg);
          allConstants = allConstants && arg.constant;
          if (!arg.constant) {
            argsToWatch.push.apply(argsToWatch, arg.toWatch);
          }
        });
      }
      ast.constant = allConstants;
      ast.toWatch = ast.stateless ? argsToWatch : [ast];
      break;

    case AST.AssignmentExpression:
      markConstantAndWatchExpressions(ast.left);
      markConstantAndWatchExpressions(ast.right);
      ast.constant = ast.left.constant && ast.right.constant;
      ast.toWatch = [ast];
      break;

    case AST.UnaryExpression:
      markConstantAndWatchExpressions(ast.argument);
      ast.constant = ast.argument.constant;
      ast.toWatch = ast.argument.toWatch;
      break;

    case AST.BinaryExpression:
      markConstantAndWatchExpressions(ast.left);
      markConstantAndWatchExpressions(ast.right);
      ast.constant = ast.left.constant && ast.right.constant;
      ast.toWatch = ast.left.toWatch.concat(ast.right.toWatch);
      break;

    case AST.LogicalExpression:
      markConstantAndWatchExpressions(ast.left);
      markConstantAndWatchExpressions(ast.right);
      ast.constant = ast.left.constant && ast.right.constant;
      ast.toWatch = [ast];
      break;

    case AST.ConditionalExpression:
      markConstantAndWatchExpressions(ast.test);
      markConstantAndWatchExpressions(ast.consequent);
      markConstantAndWatchExpressions(ast.alternate);
      ast.constant = ast.test.constant && ast.consequent.constant && ast.alternate.constant;
      ast.toWatch = [ast];
      break;
  }
}

function constantWatchDelegate(scope, listenerFn, valueEq, watchFn) {
  var unwatch = scope.$watch(
    function () {
      return watchFn(scope);
    },
    function (newValue, oldValue, scope) {
      if(_.isFunction(listenerFn)) {
        listenerFn.apply(this, arguments);
      }
      unwatch();
    },
    valueEq
  );
  return unwatch;
}

function oneTimeWatchDelegate(scope, listenerFn, valueEq, watchFn) {
  var lastValue;
  var unwatch = scope.$watch(
    function () {
      return watchFn(scope);
    },
    function (newValue, oldValue, scope) {
      lastValue = newValue;
      if(_.isFunction(listenerFn)) {
        listenerFn.apply(this, arguments);
      }
      if (!_.isUndefined(newValue)) {
        scope.$$postDigest(function () {
          if (!_.isUndefined(lastValue)) {
            unwatch();
          }
        });
      }
    }, valueEq
  );
  return unwatch;
}

/**
 * @name oneTimeLiteralWatchDelegate
 *
 * @description This will be used by parse to check if an entire object has
 * been defined. If it's a literal and it will be a constant when all the values
 * have been filled than the watcher for these values will be removed.
 *
 * @param scope
 * @param listenerFn
 * @param valueEq
 * @param watchFn
 */
function oneTimeLiteralWatchDelegate(scope, listenerFn, valueEq, watchFn) {
  function isAllDefined(val) {
    return !_.any(val, _.isUndefined);
  }
  var unwatch = scope.$watch(
    function () {
      return watchFn(scope);
    },
    function (newValue, oldValue, scope) {
      if (_.isFunction(listenerFn)) {
        listenerFn.apply(this, arguments);
      }
      if (isAllDefined(newValue)) {
        scope.$$postDigest(function () {
          if (isAllDefined(newValue)) {
            unwatch();
          }
        });
      }
    }, valueEq
  );
  return unwatch;
}

/**
 * @description TODO: Is there for handling two-way data binding?
 * This is for data paresed, on the scope that will change.
 *
 * @param scope
 * @param listenerFn
 * @param valueEq
 * @param watchFn
 */
function inputsWatchDelegate(scope, listenerFn, valueEq, watchFn) {
  var inputExpressions = watchFn.inputs;

  var oldValues = _.times(inputExpressions.length, _.constant(function() { }));

  /**
   *   Awesome pattern: TODO: declare a variable, every time you run a function it
   *   updates that variable and then maintains it for next time it runs
    */
  var lastResult;

  return scope.$watch(function () {
    var changed = false;
    _.forEach(inputExpressions, function (inputExpr, i) {
      var newValue = inputExpr(scope);
      if (changed || !expressionInputDirtyCheck(newValue, oldValues[i])) {
        changed = true;
        oldValues[i] = newValue;
      }
    });
    if (changed) {
      lastResult = watchFn(scope);
    }
    return lastResult;

  }, listenerFn, valueEq);
}

/**
 * @description This checks to see if the values are still the same, if so it returns
 * 'true'. inputsWatchDelegate will check if this is 'false' and if it is it will
 * mark the value as being changed.
 *
 * @param newValue
 * @param oldValue
 * @returns {boolean}
 */
function expressionInputDirtyCheck(newValue, oldValue) {
  return newValue === oldValue ||
    (typeof newValue === 'number' && typeof oldValue === 'number' && isNaN(newValue) && isNaN(oldValue));
}

function getInputs(ast) {
  if (ast.length > 1) { //TODO: Trying > instead of !== 1
    return;
  }
  var candidate = ast[0].toWatch; //TODO: Trying > instead of !== 1
  if (candidate.length > 1 || candidate[0] !== ast[0]) {
    return candidate;
  }
}

function isAssignable(ast) {
  return ast.type === AST.Identifier || ast.type == AST.MemberExpression;
}
function assignableAST(ast) {
  if (ast.body.length == 1 && isAssignable(ast.body[0])) {
    return {
      type: AST.AssignmentExpression,
      left: ast.body[0],
      right: { type: AST.NGValueParameter }
    };
  }
}