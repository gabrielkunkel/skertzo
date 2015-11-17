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
  '||': true
};


/**
 * @description When parse is run a new Lexer and a new Parser is created with the
 * new Lexer, which we're calling 'lexer'.
 *
 * @param {String} expr
 */
function parse(expr) {
  var lexer = new Lexer();
  var parser = new Parser(lexer); // We're creating a new parser from the Parser constructor so we can run the parser on that where we will have the lexer having already run and ready to process the expr.
  return parser.parse(expr); // Here we're calling the Parser.prototype.parse with expr as an argument and returning those results.
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
