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
  this.$$applyAsyncQueue = [];
  this.$$applyAsyncId = null;
  this.$$postDigestQueue = [];
  this.$$phase = null;


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
    listenerFn: listenerFn || function() { },
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

    if(!self.$$areEqual(newValue, oldValue, watcher.valueEq)) {
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
  var timeToLive = 7; // "The ttl" ...for how long two watchFn's can call each other before it throws
  var dirty, asyncTask;

  this.$$lastDirtyWatch = null;
  this.$beginPhase("$digest"); // UPDATE $$PHASE

  // RUN APPLY ASYNC QUEUED STUFF NOW
  if (this.$$applyAsyncId) {
    clearTimeout(this.$$applyAsyncId);
    this.$$flushApplyAsync();
  }

  //ASYNC QUEUE
  do {
    while (this.$$asyncQueue.length) {
      asyncTask = this.$$asyncQueue.shift();
      asyncTask.scope.$eval(asyncTask.expression);
      //tried this as 'this.$eval(asyncTask.expression);' and it still works
      //currently we pass the intended scope as 'this' from $$asyncQueue as
      //saved by $evalAsync.
    }

    //REGULAR QUEUE
    dirty = this.$$digestOnce();

    //CHECK FOR ENDLESS LOOPS
    //the parenthesis around 'dirty || this.$$asyncQueue.length' is necessary
    if ((dirty || this.$$asyncQueue.length) && !(timeToLive -= 1)) { //this section prevents infinite loops
      //if after you process '!(timeToLive -= 1)' it comes up '!(0)' then it's true and throws the error
      this.$clearPhase();
      throw '7 $digest iterations reached';
    }
  } while (dirty || this.$$asyncQueue.length); //this makes sure the $digest continues to run until all values have been updated
  this.$clearPhase();

  while(this.$$postDigestQueue.length) {
    this.$$postDigestQueue.shift()();
  }

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
    this.$beginPhase("$apply");
    return this.$eval(expr);
  }
  finally {
    this.$clearPhase();
    this.$digest();
  }
};

/**
 * @kind Method
 * @description Schedules a function to run at the end of all other $digest operations.
 * It can schedule a $digest run, if one isn't ongoing. The preferred way to do this in
 * production code is to use $applyAsync.
 *
 * @param expr
 */
Scope.prototype.$evalAsync = function (expr) {
  var self = this;
  if(!self.$$phase && self.$$asyncQueue.length === 0) {
    setTimeout(function () {
      if (self.$$asyncQueue.length > 0) {
        self.$digest();
      }
    }, 0);
  }
  this.$$asyncQueue.push({scope: this, expression: expr});
};

/**
 * @description adds the phase in string form to $$phase.
 *
 * @param {String} phase
 */
Scope.prototype.$beginPhase = function (phase) {
  if (this.$$phase) {
    throw this.$$phase + ' already in progress.';
  }
  this.$$phase = phase;
};

Scope.prototype.$clearPhase = function () {
  this.$$phase = null;
};

/**
 * @description
 * @param expr
 */
Scope.prototype.$applyAsync = function (expr) {
  var self = this;
  var functionToRun;

  self.$$applyAsyncQueue.push(function() {
    self.$eval(expr);
  });

  if (self.$$applyAsyncId === null) {
    self.$$applyAsyncId = setTimeout(function() {
      self.$apply(_.bind(self.$$flushApplyAsync, self));


/*    **This section's functionality has been moved to $$flushApplyAsync**

      self.$apply(function() {
        while (self.$$applyAsyncQueue.length > 0) {
          functionToRun = self.$$applyAsyncQueue.shift();
          //Alternative Solution: Eliminate functionToRun for double-call:
          // 'self.$$applyAsyncQueue.shift()()'
          functionToRun();
        }
        self.$$applyAsyncId = null;
      });
*/

    }, 0);
  }
};

Scope.prototype.$$flushApplyAsync = function () {
  var functionToRun;

  while(this.$$applyAsyncQueue.length) {
    functionToRun = this.$$applyAsyncQueue.shift();
    functionToRun();
  }
  this.$$applyAsyncId = null;
};

Scope.prototype.$$postDigest = function (fn) {
  this.$$postDigestQueue.push(fn);
};