'use strict';

/* global _, OPERATORS */
/* eslint no-use-before-define: 0 */

/*****************************************/
// LEXER
/*****************************************/


function Lexer() {

}

// lex is the main function that we use on lexer; lex does the work

/**
 * @description lex takes the actual text that we're parsing and tokenizes it
 * this all happens inside the AST builder, as lex is passed into AST as part
 * of the lexer object, and then inside the compiler as AST is passed into the
 * AST compiler.
 *
 * @lends Lexar.prototype
 * @param text
 * @returns {Array} this.tokens
 */
Lexer.prototype.lex = function (text) {
  var op, op2, op3, ch, ch2, ch3, token;

  this.text = text;
  this.index = 0;
  this.ch = '';
  this.tokens = [];

  while (this.index < this.text.length) {
    this.ch = this.text.charAt(this.index);

    //is it a number?
    if (this.isNumber(this.ch) || this.is('.') && this.isNumber(this.peek())) {
      this.readNumber();
    }

    //is it a string? (is in quotations)
    else if (this.is('\'"')) {
      this.readString(this.ch);
    }

    //is it an array or object or assignment?
    else if (this.is('[],{}:.()?;') ) { // then...
      this.tokens.push({
        text: this.ch
      });
      this.index += 1;
    }

    //is it an identifier? (a string that's not in quotations, i.e. a variable)
    else if (this.isIdent(this.ch)) {
      this.readIdent();
    }

    //is it whitespace? (If it is, we'll just move along.)
    else if (this.isWhitespace(this.ch)) {
      this.index += 1;
    }

    //if not, then it's probably an operator. Yay!!
    else {
      ch = this.ch;
      ch2 = this.ch + this.peek();
      ch3 = this.ch + this.peek(1) + this.peek(2);
      op = OPERATORS[ch];
      op2 = OPERATORS[ch2];
      op3 = OPERATORS[ch3];
      if (op || op2 || op3) {
        token = op3 ? ch3 :
          op2 ? ch2 : ch;
        this.tokens.push({ text: token });
        this.index += token.length;
      }
      else {
        throw 'Unexpected next character: ' + this.ch;
      }
    }
  }
  return this.tokens;
};

Lexer.prototype.is = function (chs) {
  return chs.indexOf(this.ch) >= 0;
};

Lexer.prototype.isNumber = function (ch) {
  return '0' <= ch && ch <= '9';
};

Lexer.prototype.readNumber = function () {
  var number = '', ch, nextCh, prevCh;
  while (this.index < this.text.length) {
    ch = this.text.charAt(this.index).toLowerCase();
    if (ch === '.' || this.isNumber(ch) ) {
      // TODO: What about testing a situation where a string is submitted thus: '6.89.2'?
      number += ch;
    }
    else {
      nextCh = this.peek();
      prevCh = number.charAt(number.length - 1);
      if (ch === 'e' && this.isExpOperator(nextCh)) {
        number += ch;
      }
      else if (this.isExpOperator(ch) && prevCh === 'e' && nextCh && this.isNumber(nextCh)) {
        number += ch;
      }
      else if (this.isExpOperator(ch) && prevCh === 'e' && (!nextCh || !this.isNumber(nextCh))) {
        throw "Invalid exponent or missing exponent.";
      }
      else {
        break;
      }
    }
    this.index += 1;
  }
  this.tokens.push({
    text: number,
    value: Number(number) // Number(value) will convert value to a number.
  });
};

/**
 *
 * @description This will keep the original string stored in rawString.
 *
 * @param {String} quote
 */
Lexer.prototype.readString = function (quote) {
  var string, ch, replacement, escape, hex, rawString;
  this.index += 1; //this moves us past what should be the first quote of the string we're parsing
  string = '';
  escape = false;
  rawString = quote;

  while (this.index < this.text.length) {
    ch = this.text.charAt(this.index);
    rawString += ch;
    if (escape === true) {
      if (ch === 'u') {
        hex = this.text.substring(this.index + 1, this.index + 5);
        if (!hex.match(/[\da-f]{4}/i)) {
          throw 'Nyuk, nyuk! Invalid unicode escape';
        }
        //substring will extract the unicode code from the first argument to the next (similar to splice for arrays)
        this.index += 4; // this line moves the index to what should be the end of the unicode code
        string += String.fromCharCode(parseInt(hex, 16));
        //parseInt returns the variable 'hex' in its hexadecimal unicode form
        //fromCharCode will take the unicode character and turn it into a normal string
      } // at this point the unicode should be converted into a string
      else {
        replacement = ESCAPES[ch];
        if (replacement) {
          string += replacement;
        }
        else {
          string += ch;
        }
      }
      escape = false;
    }
    else if (ch === quote) {
      this.index += 1;
      this.tokens.push({
        text: rawString,
        value: string
      });
      return;
    }
    else if (ch === '\\') {
      escape = true;
    }
    else {
      string += ch;
    }
    this.index += 1;
  }
  throw 'Unmatched quote';
};

/**
 * @description peek will examine a character after the current character in the
 * expr string. If there is none, it returns 'false'. If there is a next character
 * it will return that character. This will be used
 *
 * @returns {*}
 */
Lexer.prototype.peek = function (n) {
  n = n || 1;
  return this.index + n < this.text.length ?
    this.text.charAt(this.index + n) :
    false;
};

/**
 * @lends Lexer.prototype
 * @param {String} ch
 * @returns {boolean}
 */
Lexer.prototype.isExpOperator = function (ch) {
  return ch === '-' || ch === '+' || this.isNumber(ch);
};

/**
 * @description Checks the character to ensure that it's one of the permitted
 * characters in JavaScript for identifiers; variables, function names, etc.
 * For example, numbers aren't included because variables can't begin with numbers.
 * It will know that this is not a string by the absence of single or double
 * quotations.
 *
 * @param {string} ch
 * @returns {boolean}
 */
Lexer.prototype.isIdent = function (ch) {
  //if this works then we can use '<=' and '>=' with letters and it will be able to figure it out alphabetically
  // cannot start with a number
  return ch >= 'a' && ch <= 'z' || ch >= 'A' && ch <= 'Z' || ch === '_' || ch === '$';
};

/**
 * @name readIdent
 * @description
 */
Lexer.prototype.readIdent = function () {
  var text = '', ch, token;
  while (this.index < this.text.length) {
    ch = this.text.charAt(this.index);
    if (this.isIdent(ch) || this.isNumber(ch)) {
      text += ch;
    }
    else {
      break;
    }
    this.index += 1;
  }

  token = {
    text: text,
    identifier: true
  };

  this.tokens.push(token);
};

/**
 *
 * @param {string} ch
 * @returns {boolean}
 */
Lexer.prototype.isWhitespace = function (ch) {
  // empty space, return, tab, new line, vertical tab, unicode empty space
  return ch === ' ' || ch === '\r' || ch === '\t' || ch === '\n' || ch === '\v' || ch === '\u00A0';
};
