'use strict';

/* global _ */
/* eslint no-use-before-define: 0 */



/**
 * Precedence:

 1. Primary expressions: Lookups, function calls, method calls.
 2. Unary expressions: +a, -a, !a.
 3. Multiplicative arithmetic expressions: a * b, a / b, and a % b.
 4. Additive arithmetic expressions: a + b and a - b.
 5. Relational expressions: a < b, a > b, a <= b, and a >= b.
 6. Equality testing expressions: a == b, a != b, a === b, and a !== b.
 7. Logical AND expressions: a && b.
 8. Logical OR expressions: a || b.
 9. Ternary expressions: a ? b : c.
 10. Assignments: a = b.
 11. Filters: a | filter

 */


/*****************************************/
// ABSTRACT SYNTAX TREE BUILDER
/*****************************************/

function AST(lexer) {
  this.lexer = lexer;
}

// marker constants
AST.Program = 'Program'; // the main one
AST.Literal = 'Literal';
AST.ArrayExpression = 'ArrayExpression';
AST.ObjectExpression = 'ObjectExpression';
AST.Property = 'Property';
AST.Identifier = 'Identifier';
AST.ThisExpression = 'ThisExpression';
AST.MemberExpression = 'MemberExpression'; //for arrays, objects, etc. that have other stuff in them
AST.CallExpression = 'CallExpression'; //for function calls
AST.AssignmentExpression = 'AssignmentExpression'; // for assignments, which are non-primary expressions.
AST.UnaryExpression = 'UnaryExpression'; // includes +a, -a, and !a
AST.BinaryExpression = 'BinaryExpression'; // includes +, -, %, and /
// NOTE: Technically && and || are binary expressions, but they have some special behavior
AST.LogicalExpression = 'LogicalExpression'; // includes '&&' and '||'
AST.ConditionalExpression = 'ConditionalExpression';

AST.prototype.ast = function (text) {
  //AST building will done here
  this.tokens = this.lexer.lex(text); // this is the only time lexer gets called (so far)
  return this.program();
};

AST.prototype.program = function () {
  var body = [], notReturnedYet = true;
  while (notReturnedYet) {
    if (this.tokens.length) {
      body.push(this.filter());
    }
    if (!this.expect(';')) {
      return { type: AST.Program, body: body };
    }
  }
};

// THE DIFFERENT TYPES: In order of precedence.

/**
 * @name primary
 * @description Examples of primary expressions are constants, arrays.
 * Assignments are not primary expressions.
 * Checks the next token and works on it, depending on what it is.
 * We will return to primary repeatedly, recursively, even, as we consume tokens
 * and spit out the abstract syntax tree of the entire expression.
 *
 * Dependent on AST.prototype.arrayDeclaration, AST.prototype.constant
 *
 * @returns {*}
 */
AST.prototype.primary = function () {
  var primary, next;

  // for altering the order of precedenc
  if (this.expect('(')) {
    primary = this.filter();
    this.consume(')');
  }

  // for arrays
  else if (this.expect('[')) {
    primary = this.arrayDeclaration();
  }

  // for objects
  else if (this.expect('{')) {
    primary = this.object();
  }

  else if (this.constants.hasOwnProperty(this.tokens[0].text)) {
    // consume returns the entire token... this returns the text of that token
    primary = this.constants[this.consume().text];
  }

  // for identifiers
  else if (this.peek().identifier) {
    primary = this.identifier();
  }
  else {
    primary = this.constant();
  }
  while (next = this.expect('.', '[', '(')) {
    if (next.text === '[') {
      primary = {
        type: AST.MemberExpression,
        object: primary,
        property: this.primary(),
        computed: true
      };
      this.consume(']');
    }
    else if (next.text === '.') {
      primary = {
        type: AST.MemberExpression,
        object: primary,
        property: this.identifier(),
        computed: false
      };
    }
    else if (next.text === '(') {
      primary = {
        type: AST.CallExpression,
        callee: primary,
        arguments: this.parseArguments()
      };
      this.consume(')');
    }
  }
  return primary;

};

/**
 * @name unary ast builder
 * @description Builds syntax tree for unary operators, including '+', '-',
 * and '!' from tokens.
 *
 * @returns {*}
 */
AST.prototype.unary = function () {
  var token;
  if (token = this.expect('+', '!', '-')) {
    return {
      type: AST.UnaryExpression,
      operator: token.text,
      // returning to this.primary() allows us to use this in place of primary here
      argument: this.unary()
    };
  }
  else {
    return this.primary();
  }
};

AST.prototype.multiplicative = function () {
  var token, left = this.unary();

  while (token = this.expect('*', '/', '%')) {
    left = {
      type: AST.BinaryExpression,
      left: left,
      operator: token.text,
      right: this.unary()
    };
  }
  return left;
};

AST.prototype.additive = function () {
  var left = this.multiplicative(); // in case it doesn't find an operator, it returns this
  var token;

  while (token = this.expect('+') || (token = this.expect('-'))) {
    left = {
      type: AST.BinaryExpression,
      left: left,
      operator: token.text,
      right: this.multiplicative()
    };
  }
  return left;
};

AST.prototype.relational = function () {
  var left = this.additive();
  var token;
  while (token = this.expect('<', '>', '<=', '>=')) {
    left = {
      type: AST.BinaryExpression,
      left: left,
      operator: token.text,
      right: this.additive()
    };
  }
  return left;
};

/**
 * @description Our lowest precedence operator after assignment.
 */
AST.prototype.equality = function () {
  var token, left = this.relational();
  while (token = this.expect('==', '!=', '===', '!==')) {
    left = {
      type: AST.BinaryExpression,
      left: left,
      operator: token.text,
      right: this.relational()
    };
  }
  return left;
};

AST.prototype.logicalAND = function () {
  var token, left = this.equality();

  while (token = this.expect('&&')) {
    left = {
      type: AST.LogicalExpression,
      left: left,
      operator: token.text,
      right: this.equality()
    };
  }
  return left;
};

AST.prototype.logicalOR = function () {
  var token, left = this.logicalAND();

  while (token = this.expect('||')) {
    left = {
      type: AST.LogicalExpression,
      left: left,
      operator: token.text,
      right: this.equality()
    };
  }
  return left;
};

AST.prototype.ternary = function () {
  var consequent, alternate, test = this.logicalOR();
  if (this.expect('?')) {
    consequent = this.assignment();
    if (this.consume(':')) {
      alternate = this.assignment();
      return {
        type: AST.ConditionalExpression,
        test: test,
        consequent: consequent,
        alternate: alternate
      };
    }
  }
  return test;
};

AST.prototype.assignment = function () {
  var right, left = this.ternary();
  if (this.expect('=')) {
    right = this.ternary();
    return {
      type: AST.AssignmentExpression,
      left: left,
      right: right
    };
  }
  return left;
};

AST.prototype.filter = function () {
  var args, left = this.assignment();
  while (this.expect('|')) {
    args = [left];
    left = {
      type: AST.CallExpression,
      callee: this.identifier(),
      arguments: args,
      filter: true
    };
    while (this.expect(':')) {
      args.push(this.assignment());
    }
  }
  return left;
};

// DIFFERENT TYPES

AST.prototype.parseArguments = function () {
  var args = [];
  if (!this.peek(')')) {
    do {
      args.push(this.assignment());
    } while (this.expect(','));
  }
  return args;
};

AST.prototype.object = function () {
  var properties = [];
  var property;

  if (!this.peek('}')) {
    do {
      property = {this: AST.Property};
      if (this.peek().identifier) {
        property.key = this.identifier();
      }
      else {
        property.key = this.constant();
      }
      this.consume(':');
      property.value = this.assignment();
      properties.push(property);
    } while (this.expect(','));
  }
  this.consume('}');
  return {type: AST.ObjectExpression, properties: properties};
};

AST.prototype.identifier = function () {
  return {
    type: AST.Identifier,
    name: this.consume().text
  };
};

/**
 * @name arrayDeclaration
 * @description Builds up the abstract syntax tree for an array. 'Elements' will hold
 * all of the array elements, while 'type' will communicate that it is an array
 * expression. The AST compiler will process this into a function.
 * Dependent on AST.prototype.primary, AST.prototype.expect, AST.prototype.consume
 *
 * @returns {{type: string, elements: Array}}
 */
AST.prototype.arrayDeclaration = function () {
  var elements = [];
  // if the next character isn't a closing bracket...
  if (!this.peek(']')) {
    do {
      if (this.peek(']')) {
        break;
      }
      elements.push(this.assignment());
    } while (this.expect(',')); // this will BOTH remove the comma and keep the loop going
  }
  this.consume(']');
  return {type: AST.ArrayExpression, elements: elements};
};

AST.prototype.constant = function () {
  return {type: AST.Literal, value: this.consume().value};
};

AST.prototype.constants = {
  'null' : {type: AST.Literal, value: null},
  'true' : {type: AST.Literal, value: true},
  'false' : {type: AST.Literal, value: false},
  'this' : {type: AST.ThisExpression}
};


// THE CONSUMPTION THREE:

/**
 * @description Consume takes "a bit of something/maybe nothing" tests
 * it with expect(e). If it comes back as truthy, it will return it back.
 * Otherwise it throws an error. NOTE: Expect does the actual consumption.
 * Consume is just expect with a check.
 * Dependent on AST.prototype.expect
 *
 * @param e
 * @returns {T}
 */
AST.prototype.consume = function (e) {
  //expect is really doing the consumption (removing it from the list of tokens) with shift.
  var token = this.expect(e);
  if (!token) {
    throw 'Unexpected. Expecting: ' + e;
  }
  return token;
};

/**
 * @description It checks to see if the next token is what we expect it to be.
 * It will then remove that token from this.tokens so that we move forward to
 * the next one. It can also be used with no arguments to process whatever token
 * comes next.
 * Dependent on AST.prototype.peek
 *
 * @returns {T}
 * @param e1
 * @param e2
 * @param e3
 * @param e4
 */
AST.prototype.expect = function (e1, e2, e3, e4) {
  var token = this.peek(e1, e2, e3, e4);
  if (token) {
    return this.tokens.shift();
  }
};

/**
 * @description serves up the token we're going to work on.
 *
 * @param e
 * @returns {*}
 */
AST.prototype.peek = function (e1, e2, e3, e4) {
  var text;
  if (this.tokens.length > 0) {
    text = this.tokens[0].text;

    if (text === e1 || text === e2 || text === e3 || text === e4 ||
      !e1 && !e2 && !e3 && !e4) {
      return this.tokens[0];
    }
  }
};
