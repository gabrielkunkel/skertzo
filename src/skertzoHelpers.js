/* global _ */

'use strict';


// constants
var CALL = Function.prototype.call;
var APPLY = Function.prototype.apply;
var BIND = Function.prototype.bind;


_.mixin({
  // we're just checking if it is an object and if it has a length to determine if it is array-like
  isArrayLike: function (obj) {
    var length;

    if (_.isNull(obj) || _.isUndefined(obj)) {
      return false;
    }
    length = obj.length;
    return length === 0 ||
        // Why does checking length - 1 work? TODO: Figure out why this helps us check out if it is an array-like object vs. just an object.
      _.isNumber(length) && length > 0 && length - 1 in obj;
  }
});

function ensureSafeMemberName(name) {
  if (
    name === 'constructor' || name === '__proto__' ||
    name === '__defineGetter__' || name === '__defineSetter__' ||
    name === '__lookupGetter__' || name === '__lookupSetter__'
  ) {
    throw 'Attempting to access a disallowed field in Skertzo expressions!';
  }
}

function ensureSafeObject(obj) {
  if (obj) {
    if (obj.window === obj) {
      throw 'Referencing window in Skertzo expressions is disallowed! :P';
    }
    else if (obj.children && (obj.nodeName || obj.prop && obj.attr && obj.find)) {
      throw 'Referencing DOM nodes in Skertzo expression is disallowed! :P';
    }
    else if (obj.constructor === obj) {
      throw 'Referencing Function in Skertzo expressions is disallowed! :P';
    }
    // does not allow calling functions on Object
    else if (obj === Object) {
      throw 'Referencing Object in Skertzo expressions is disallowed! Wanker! :P';
    }
  }
  return obj;
}


function ensureSafeFunction(obj) {
  if (obj) {
    if (obj.constructor === obj) {
      throw 'Referencing Function in Skertzo expressions is disallowed! ...jerk!';
    }
    else if ( obj === CALL || obj === APPLY || obj === BIND ) {
      throw 'Referencing call, apply, or bind in Skertzo is forbidden! ...duh!';
    }
  }
  return obj;
}

function ifDefined(value, defaultValue) {
  return typeof value === 'undefined' ? defaultValue : value;
}

