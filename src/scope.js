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
  this.$root = this;
  this.$$children = [];
  this.$$phase = null;
}

//$watched!
/**
 * @description The $watch method creates an object that gets added
 * to the $$watchers array. It will be this array that the $digest
 * method will loop over in order to scan for changes in scope values.
 * In order to destroy a watch, just run the returned function.
 *
 * @param {Function} watchFn - these should be side effect free
 * @param {Function} listenerFn
 * @param {Boolean} valueEq
 */
Scope.prototype.$watch = function (watchFn, listenerFn, valueEq) {
  var self = this;

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
  this.$$watchers.unshift(watcher);
  this.$root.$$lastDirtyWatch = null;

  //a function returned that will remove the applicable watcher when run.
  return function () {
    var index = self.$$watchers.indexOf(watcher);
    if(index >= 0) {
      self.$$watchers.splice(index, 1);
      self.$root.$$lastDirtyWatch = null;
    }
  };
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
  var dirty;
  var continueLoop = true;
  var self = this;
  this.$$everyScope(function (scope) {
    var newValue, oldValue;
    _.forEachRight(scope.$$watchers, function (watcher) {

      try {
        if (!!watcher === true) {
          newValue = watcher.watchFn(scope);
          oldValue = watcher.last;

          if (!scope.$$areEqual(newValue, oldValue, watcher.valueEq)) {
            self.$root.$$lastDirtyWatch = watcher;
            watcher.last = watcher.valueEq === true ? _.cloneDeep(newValue) : newValue;
            watcher.listenerFn(newValue,
              oldValue === initWatchVal ? newValue : oldValue,
              scope);
            dirty = true;
          }
          else if (self.$root.$$lastDirtyWatch === watcher) {
            continueLoop = false;
            return false;
          }
        } //end of if (watcher)
      } //end of try

      catch (e) {
        console.error(e);
      }
    }); //end foreEachRight
    return continueLoop;
  }); //end $$everyScope

  return dirty;
}; //end $$digestOnce

Scope.prototype.$digest = function () { //TODO: combine $$digestOnce and $$digest in one function
  var timeToLive = 7; // "The ttl" ...for how long two watchFn's can call each other before it throws
  var dirty, asyncTask;

  this.$root.$$lastDirtyWatch = null;
  this.$beginPhase("$digest"); // UPDATE $$PHASE

  // RUN $APPLYASYNC QUEUED STUFF NOW

  if (this.$$applyAsyncId) {
    clearTimeout(this.$$applyAsyncId);
    this.$$flushApplyAsync();
  }

  // RUN $EVALASYNC QUEUE STUFF NOW
  do {
    while (this.$$asyncQueue.length) {
      try {
        asyncTask = this.$$asyncQueue.shift();
        asyncTask.scope.$eval(asyncTask.expression);
      }
      catch (e) {
        console.log(e);
      }
    }

    //$evalAsync and $applyAsync run at the beginning of $digest. This is how it ends up being postponed until other $digest tasks have been completed. The $digest will finish completely, first. Then the $digest is run again by $evalAsync and $applyAsync (through $apply). This makes sure that any changes caused by $evalAsync or $applyAsync are $digested.

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

  //RUN $$POSTDIGEST STUFF
  while(this.$$postDigestQueue.length) {
    try {
    this.$$postDigestQueue.shift()();
    } catch (e) {
      console.error(e);
    }
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
    this.$root.$digest();
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

  //schedules a $digest run if there isn't one going
  if(!self.$$phase && self.$$asyncQueue.length === 0) {
    setTimeout(function () {
      if (self.$$asyncQueue.length > 0) {
        self.$root.$digest();
      }
    }, 0);
  }

  //sets up expressions to run
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
  //var functionToRun;


  //add it to the Queue
  self.$$applyAsyncQueue.push(function() {
    self.$eval(expr);
  });

  //if there's NOTHING in $$applyAsyncId, add an $apply, wrapped in a setTimeout
  //this $apply will only run in $digest and the Timeout will be cleared before
  //it has a chance to initialize.
  if (self.$$applyAsyncId === null) {
    self.$$applyAsyncId = setTimeout(function() {
      self.$apply(_.bind(self.$$flushApplyAsync, self));
    }, 0);
  }
};

Scope.prototype.$$flushApplyAsync = function () {
  var functionToRun;

  while(this.$$applyAsyncQueue.length) {
    try {
      functionToRun = this.$$applyAsyncQueue.shift();
      functionToRun();
    } catch (e) {
      console.error(e);
    }
  }
  this.$$applyAsyncId = null;
};

Scope.prototype.$$postDigest = function (fn) {
  try {
    this.$$postDigestQueue.push(fn);
  } catch (e) {
    console.error(e);
  }
};

/**
 *
 * @param {Array} watchFns
 * @param {Function} listenerFn
 */
Scope.prototype.$watchGroup = function(watchFns, listenerFn) {
  var self = this;
  var newValues = []; //alternative from book: 'new Array(watchFns.length);'
  var oldValues = []; //alternative from book: 'new Array(watchFns.length);'
  //TODO: Does either way of declaring these values matter? Is there any optimization to 'new Array(array.length)'?
  var isRunScheduled = false;
  var firstRun = true;
  var destroyFunctions = [];
  var shouldCall = false;

  function watchGroupListener() {
    if (firstRun === true) {
      firstRun = false;
      listenerFn(newValues, newValues, self);
      isRunScheduled = false;
    }
    else if (firstRun === false) {
      listenerFn(newValues, oldValues, self);
    }
    isRunScheduled = false;
  }

    // using map to collect all of the $watch functions' destroy closures in an array.
  destroyFunctions = _.map(watchFns, function(element, iterator) {
    return self.$watch(element, function(newValue, oldValue) {
      newValues[iterator] = newValue;
      oldValues[iterator] = oldValue;
      if (isRunScheduled === false) {
        isRunScheduled = true;
        self.$evalAsync(watchGroupListener);
      }
    });
  });

/* My First Attempt at making sure the listenerFn runs at least once if there are no watchFn's
  if(watchFns.length === 0) {
    if (isRunScheduled === false) {
      isRunScheduled = true;
      self.$evalAsync(watchGroupListener);
    }
  }*/

  /**
   * This is a more optimized version, because we don't have to go through
   * watchGroupListener's checks. If the length is 0. There's no reason to
   * load up old and new values into arrays.
   */
  if(watchFns.length === 0) {
    shouldCall = true;
    self.$evalAsync(function () {
      if (shouldCall === true) {
        listenerFn(newValues, newValues, self);
      }
    });
    return function () {
      shouldCall = false; //if there are no watchFn's and we run the de-register, it won't run once
    };
  }

  // when we run the function that gets returned by $watchGroup it will destroy each
  // watcher one-by-one using forEach.
  return function () {
    _.forEach(destroyFunctions, function (destroyFunction) {
      destroyFunction();
    });
  };

};

Scope.prototype.$new = function () {
  var child;
  var ChildScope = function() { };

  ChildScope.prototype = this;
  child = new ChildScope();
  this.$$children.push(child); // this adds the child to its parent scope, so the parent can run the digest on its children, as well as itself. $$childern can be ultimately found on the rootScope.

  child.$$watchers = []; // this is called "attribute shadowing" it does not overwrite the parent $$watchers
  child.$$children = []; // this is the child's collection of children which it will $digest whenever the $digest is run on itself

  return child;

};
// TODO revise $new to use Object.create(this) instead

/**
 *
 * @param {Function} fn
 * @returns {boolean}
 */
Scope.prototype.$$everyScope = function (fn) {
  // we run only if the function itself returns something (truthy)
  if (fn(this)) { // this is to test if the function has a scope with it as the first argument. This is basically the pattern we have for watchFn's.
    return this.$$children.every(function (child) { // this.$$children is the array to run 'Array.prototype.every' on
      return child.$$everyScope(fn);
    });
  }
  else {
      return false;
    }
};