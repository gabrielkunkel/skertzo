'use strict';

/* global _ */
/* eslint no-use-before-define: 0 */

/*****************************************/
// ABSTRACT SYNTAX TREE COMPILER
/*****************************************/

/**
 * @description The AST Compiler is going to turn the AST into JavaScript functions.
 *
 * @param astBuilder
 * @constructor
 */

function ASTCompiler(astBuilder) {
  this.astBuilder = astBuilder;
}

ASTCompiler.prototype.compile = function (text) {
  var fnString;
  var ast = this.astBuilder.ast(text);
  // this is where the function gets built up in an array through recurse
  // nextId will keep track of the current number on the variables as they are declared
  this.state = {body: [], nextId: 0, vars: []};
  this.recurse(ast);
  fnString = 'var fn=function(s,l){' +
    (this.state.vars.length ?
      'var ' + this.state.vars.join(',') + ';' : '') +
      this.state.body.join('') + '}; return fn;';

  /* eslint no-new-func: 1 */
  return new Function(
    'ensureSafeMemberName',
    'ensureSafeObject',
    'ensureSafeFunction',
    'ifDefined',
    fnString)(
    ensureSafeMemberName,
    ensureSafeObject,
    ensureSafeFunction,
    ifDefined
  );
};


/**
 * @description Prepares a string to shove into a new Function.
 *
 *
 *
 * @param ast
 * @returns {string}
 */
ASTCompiler.prototype.recurse = function (ast, context, create) {
  var elements, properties, key, value, intoId, left, right, callee, args,
    callContext, leftContext, leftExpr, testId;

  switch (ast.type) {

    case AST.Program:
      _.forEach(_.initial(ast.body), function(stmt) {
        this.state.body.push(this.recurse(stmt), ';');
      }, this);
      this.state.body.push('return ', this.recurse(_.last(ast.body)), ';');
      break;

    case AST.Literal:
      return this.escape(ast.value);

    case AST.ArrayExpression:
      elements = _.map(ast.elements, function (element) {
        return this.recurse(element);
      }, this);
      return '[' + elements.join(',') + ']';

    case AST.ObjectExpression:
      properties = _.map(ast.properties, function (property) {
        key = property.key.type === AST.Identifier ? property.key.name : this.escape(property.key.value);
        value = this.recurse(property.value);
        return key + ':' + value;
      }, this);
      return '{' + properties.join(',') + '}';

    case AST.Identifier:
      ensureSafeMemberName(ast.name);
      intoId = this.nextId();
      this.if_(this.getHasOwnProperty('l', ast.name), this.assign(intoId, this.nonComputedMember('l', ast.name)));
      if (create) {
        this.if_(this.not(this.getHasOwnProperty('l', ast.name)) + ' && s && ' + this.not(this.getHasOwnProperty('s', ast.name)),
          this.assign(this.nonComputedMember('s', ast.name), '{}'));
      }
      this.if_(this.not(this.getHasOwnProperty('l', ast.name)) + ' && s', this.assign(intoId, this.nonComputedMember('s', ast.name)));
      if (context) {
        context.context = this.getHasOwnProperty('l', ast.name) + '? l : s';
        context.name = ast.name;
        context.computed = false;
      }
      this.addEnsureSafeObject(intoId);
      return intoId;

    case AST.ThisExpression:
      return 's';

    case AST.MemberExpression:
      intoId = this.nextId();
      /* eslint no-undefined: 1 */
      left = this.recurse(ast.object, undefined, create);
      if (context) {
        context.context = left;
      }
      if (ast.computed) {
        right = this.recurse(ast.property);
        this.addEnsureSafeMemberName(right);
        // this covers cases where there are missing objects in the object path
        if(create) {
          this.if_(this.not(this.computedMember(left, right)), this.assign(this.computedMember(left, right), '{}'));
        }
        this.if_(left, this.assign(intoId,
          'ensureSafeObject(' + this.computedMember(left, right) + ')'));
        if (context) {
          context.name = right;
          context.computed = true;
        }
      }
      else {
        ensureSafeMemberName(ast.property.name);
        // this covers cases where there are missing objects in the object path
        if (create) {
          this.if_(this.not(this.nonComputedMember(left, ast.property.name)), this.assign(this.nonComputedMember(left, ast.property.name), '{}'));
        }
        this.if_(left, this.assign(intoId,
          'ensureSafeObject(' +
            this.nonComputedMember(left,ast.property.name) + ')'));
        if (context) {
          context.name = ast.property.name;
          context.computed = false;
        }
      }
      return intoId;

    case AST.CallExpression:
      callContext = {};
      callee = this.recurse(ast.callee, callContext);
      args = _.map(ast.arguments, function (arg) {
        return 'ensureSafeObject(' + this.recurse(arg) + ')';
      }, this);
      if (callContext.name) {
        this.addEnsureSafeObject(callContext.context);
        if (callContext.computed) {
          callee = this.computedMember(callContext.context, callContext.name);
        }
        else {
          callee = this.nonComputedMember(callContext.context, callContext.name);
        }
      }
      this.addEnsureSafeFunction(callee);
      return callee + '&&ensureSafeObject(' + callee + '(' + args.join(',') + '))';

    case AST.AssignmentExpression:
      leftContext = {};
      this.recurse(ast.left, leftContext, true);
      if(leftContext.computed) {
        leftExpr = this.computedMember(leftContext.context, leftContext.name);
      }
      else {
        leftExpr = this.nonComputedMember(leftContext.context, leftContext.name);
      }
      return this.assign(leftExpr, 'ensureSafeObject(' + this.recurse(ast.right) + ')');

    case AST.UnaryExpression:
      return ast.operator + '(' +
        this.ifDefined(this.recurse(ast.argument), 0) + ')';

    case AST.BinaryExpression:
      if (ast.operator === '+' || ast.operator === '-') {
        return '(' + this.ifDefined(this.recurse(ast.left), 0) + ')' + ast.operator +
            '(' + this.ifDefined(this.recurse(ast.right), 0) + ')';
      }
      else {
        return '(' + this.recurse(ast.left) + ')' + ast.operator + '(' + this.recurse(ast.right) + ')';
      }
      break;

    case AST.LogicalExpression:
      intoId = this.nextId();
      this.state.body.push(this.assign(intoId, this.recurse(ast.left)));
      this.if_(ast.operator === '&&' ? intoId : this.not(intoId),
        this.assign(intoId, this.recurse(ast.right)));
      return intoId;

    case AST.ConditionalExpression:
      intoId = this.nextId();
      testId = this.nextId();
      this.state.body.push(this.assign(testId, this.recurse(ast.test)));
      this.if_(testId, this.assign(intoId, this.recurse(ast.consequent)));
      this.if_(this.not(testId),this.assign(intoId, this.recurse(ast.alternate)));
      return intoId;

    default:
      break;

  }
};

ASTCompiler.prototype.ifDefined = function (value, defaultValue) {
  return 'ifDefined(' + value + ',' + this.escape(defaultValue) + ')';
};

ASTCompiler.prototype.addEnsureSafeObject = function (expr) {
  this.state.body.push('ensureSafeObject(' + expr + ');');
};

ASTCompiler.prototype.addEnsureSafeMemberName = function(expr) {
  this.state.body.push('ensureSafeMemberName(' + expr + ');');
};

ASTCompiler.prototype.addEnsureSafeFunction = function (expr) {
  this.state.body.push('ensureSafeFunction(' + expr + ');');
};

/**
 * @name ASTCompiler getHasOwnProperty
 * @description This appears to inject a check of some kind (returns a boolean)
 * into the function that we're creating.
 *
 * TODO: What does this do, exactly?
 *
 * @param object
 * @param property
 * @returns {string}
 */
ASTCompiler.prototype.getHasOwnProperty = function (object, property) {
  return object + '&& (' + this.escape(property) + ' in ' + object + ')';
};

ASTCompiler.prototype.not = function (e) {
  return '!(' + e + ')';
};

ASTCompiler.prototype.nextId = function () {
  var id = 'v' + (this.state.nextId += 1);
  this.state.vars.push(id);
  return id;
};

/**
 * @description If the member property is computed then it should be printed
 * out this way in the resulting function.
 *
 * @param left
 * @param right
 * @returns {string}
 */
ASTCompiler.prototype.computedMember = function (left, right) {
  return '(' + left + ')[' + right + ']';
};

ASTCompiler.prototype.nonComputedMember = function (left, right) {
  return '(' + left + ').' + right;
};

/**
 * @name ASTCompiler assign
 * @description This creates an assignment statement in the new Function.
 *
 * @param id - this is the identifier
 * @param value - this is the value that is being given to the identifier (could be a function, array, etc.
 * @returns {string}
 */
ASTCompiler.prototype.assign = function (id, value) {
  return id + '=' + value + ';'
};

ASTCompiler.prototype.escape = function(value) {
  if (_.isString(value)) {
    return '\'' + value.replace(this.stringEscapeRegex, this.stringEscapeFn) + '\'';
  }
  else if (_.isNull(value)) {
    return 'null';
  }
  else {
    return value;
  }
};

/**
 * @description This is an if statement created within the new Function.
 * We're passing the test, for example 'if (m === 0)' and what happens as
 * a result of that coming back true in the 'consequent'.
 *
 * @param test
 * @param consequent
 * @private
 */
ASTCompiler.prototype.if_ = function (test, consequent) {
  this.state.body.push('if(', test, '){', consequent, '}');
};

ASTCompiler.prototype.stringEscapeRegex = /[^ a-zA-Z0-9]/g; //empty space after the ^ symbol means space is included


ASTCompiler.prototype.stringEscapeFn = function (c) {
  // TODO: take some time to understand this function. Study up on the use of unicode characters in JavaScript.
  // TODO: how to convert bits to bytes and hexidecimal.
  return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
};