/**
 * Created by gabrielkunkel on 10/21/15.
 */
"use strict";

// this is just a plain, useless, empty function to be used as a value placeholder
function initWatchVal() {}

//Scoped!
/**
 * @description The Scope constructor will be used to create an object
 * where all values and methods in a particular scope will be stored.
 *
 * @constructor
 */
function Scope() {
  this.$$watchers = [];
  this.$$lastDirtyWatch = null;
  this.$$asyncQueue = [];

}

//$watched!
/**
 * @description The $watch method creates an object that gets added
 * to the $$watchers array. It will be this array that the $digest
 * method will loop over in order to scan for changes in scope values.
 *
 * @param {Function} watchFn - these should be side effect free
 * @param {Function} listenerFn
 * @param {Boolean} valueEq
 */
Scope.prototype.$watch = function (watchFn, listenerFn, valueEq) {

  /**
   * @property {Object} watcher - Will be added to the scope's $$watchers array
   * @property {Function} watcher.watchFn - Pertains to one value on the scope.
   * @property {Function} watcher.listenerFn - Will be run by $digest as the effect.
   * @type {{watchFn: Function, listenerFn: Function, last: initWatchVal}}
   */
  var watcher = {
    watchFn: watchFn,
    listenerFn: listenerFn || function() {},
    valueEq: !!valueEq,
    last: initWatchVal
  };
  this.$$watchers.push(watcher);
  this.$$lastDirtyWatch = null;
};

//$digested!
/**
 * @description Runs the listener function of each object on $$watchers array.
 * Put another way, the $digest method cycles through the $$watchers array of
 * objects, and runs each of their listener functions (listenerFn's).
 *
 * @return {Boolean}
 */
Scope.prototype.$$digestOnce = function () {
  var self = this;
  var newValue, oldValue, dirty;

  _.forEach(this.$$watchers, function (watcher) {
    newValue = watcher.watchFn(self);
    oldValue = watcher.last;

    if (!self.$$areEqual(newValue, oldValue, watcher.valueEq)) {
      self.$$lastDirtyWatch = watcher;
      watcher.last = watcher.valueEq === true ? _.cloneDeep(newValue) : newValue;
      watcher.listenerFn(newValue,
        oldValue === initWatchVal ? newValue : oldValue,
        self);
      dirty = true;
    }
    else if (self.$$lastDirtyWatch === watcher) {
      return false;
    }
  });
  return dirty;

}; //end $$digestOnce

Scope.prototype.$digest = function () { //TODO: combine $$digestOnce and $$digest in one function
  var timeToLive = 7; // "The ttl"
  var dirty, asyncTask;
  this.$$lastDirtyWatch = null;
  do {
    while (this.$$asyncQueue.length) {
      asyncTask = this.$$asyncQueue.shift();
      asyncTask.scope.$eval(asyncTask.expression);
      //tried this as 'this.$eval(asyncTask.expression);' and it still works
      //currently we pass the intended scope as 'this' from $$asyncQueue as
      //saved by $evalAsync.
    }

    dirty = this.$$digestOnce();
    if (dirty || this.$$asyncQueue.length && !(timeToLive -= 1)) { //this section prevents infinite loops
      throw '7 $digest iterations reached';
    }
  } while (dirty || this.$$asyncQueue.length); //this makes sure the $digest continues to run until all values have been updated
};

/**
 * @description With the help of lodash we're going to test if two values
 * are deeply equivalent. This is especially a concern for arrays and objects.
 * We'll also check if they're equivalent if they're simple values or NaN's.
 *
 * @param newValue
 * @param oldValue
 * @param valueEq
 * @returns {Boolean}
 */
Scope.prototype.$$areEqual = function (newValue, oldValue, valueEq) {
  if (!!valueEq === true) {
    return _.isEqual(newValue, oldValue);
  }
  else if (newValue === oldValue) {
    return true;
  }
  else if (typeof newValue === 'number' &&
    typeof oldValue === 'number' &&
    isNaN(newValue) === true &&
    isNaN(oldValue) === true) {

    return true;
  }
}; //end $$areEqual

/**
 * @description $eval runs a function with the scope that's been passed in
 * as an argument.
 *
 * @param {Function} expr
 * @param optionalArg
 * @returns {*}
 */
Scope.prototype.$eval = function (expr, optionalArg) {
   return expr(this, optionalArg);
};

Scope.prototype.$apply = function(expr) {
  try {
    return this.$eval(expr);
  }
  finally {
    this.$digest();
  }
};

Scope.prototype.$evalAsync = function (expr) {
  this.$$asyncQueue.push({scope: this, expression: expr});
};

