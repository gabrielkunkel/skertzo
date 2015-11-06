/**
 * Created by gabrielkunkel on 10/21/15.
 */

/* global _ */ //this makes it so that eslint doesn't object to lodash's '_', since it hasn't been defined here, but is a library

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
  this.$root = this; //this is used to "poke a hole" in isolated child scopes
  this.$$children = [];
  this.$$listeners = {};
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

  if (this.$root.$$applyAsyncId) {
    clearTimeout(this.$root.$$applyAsyncId);
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
 *
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

  //if there's NOTHING in $root.$$applyAsyncId, add an $apply, wrapped in a setTimeout
  //this $apply will only run in $digest and the Timeout will be cleared before
  //it has a chance to initialize.
  if (self.$root.$$applyAsyncId === null) {
    self.$root.$$applyAsyncId = setTimeout(function() {
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
  this.$root.$$applyAsyncId = null;
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

/**
 *
 * @param {Boolean} isolated
 * @returns {*}
 */
Scope.prototype.$new = function (isolated, parent) {
  var child, ChildScope;

  parent = parent || this; //we'll use "parent" as a way of submitting a separate scope for $digest to run down. This way we can have a number of "top scopes" or "parent scopes."

  if(isolated) {
    child = new Scope();
    child.$root = parent.$root;
    child.$$asyncQueue = parent.$$asyncQueue;
    child.$$postDigestQueue = parent.$$postDigestQueue;
    child.$$applyAsyncQueue = parent.$$applyAsyncQueue;
  }
  else { // TODO revise $new to use Object.create(this) instead
    ChildScope = function() { };
    ChildScope.prototype = this;
    child = new ChildScope();
  }
  parent.$$children.push(child); // this adds the child to its parent scope, so the parent can run the digest on its children, as well as itself. $$childern can be ultimately found on the rootScope.
  child.$$watchers = []; // this is called "attribute shadowing" it does not overwrite the parent $$watchers
  child.$$children = []; // this is the child's collection of children which it will $digest whenever the $digest is run on itself
  child.$$listeners = {}; // this gives the child its own listeners for receiving $broadcast and $emit
  child.$parent = parent;

  return child;

};

/**
 *
 * @param {Function} fn
 * @returns {boolean}
 */
Scope.prototype.$$everyScope = function (fn) {
  // we run only if the function itself returns something (truthy)
  if (fn(this)) { // do all of the side effects run while in an if expression? // TODO: See if a function runs all side effects while it's in an if expression.
    return this.$$children.every(function (child) { // this.$$children is the array to run 'Array.prototype.every' on
      return child.$$everyScope(fn);
    });
  }
  else {
      return false;
    }
};

Scope.prototype.$destroy = function () {
  var siblings, indexOfThis;

  this.$broadcast('$destroy');

  if(this.$parent) {
    siblings = this.$parent.$$children;
    indexOfThis = siblings.indexOf(this);
    if (indexOfThis >= 0) {
      siblings.splice(indexOfThis, 1);
    }
  }
  this.$$watchers = null;
  this.$$listeners = {};
};

/**
 *
 * @param {Function} watchFn
 * @param {Function} listenerFn
 */
Scope.prototype.$watchCollection = function(watchFn, listenerFn) {
  var self = this;
  var internalWatchFn, internalListenerFn;
  var newValue, oldValue;
  var objectOldLength;
  var veryOldValue;
  var trackVeryOldValue = listenerFn.length > 1;
  var changeCount = 0;
  var firstRun = true;

  internalWatchFn = function (scope) {
    /* eslint no-empty: 0 */
    var objectNewLength;

    newValue = watchFn(scope);

    if (_.isObject(newValue)) { // this prevents strings from passing, since JavaScript strings are not objects
      if (_.isArrayLike(newValue)) { // _.isArray only checks for proper arrays and does NOT check for array-like objects, including arguments and NodeList.
        if(!_.isArray(oldValue)) {
          changeCount += 1;
          oldValue = [];
        }
        if (newValue.length !== oldValue.length) {
          changeCount += 1;
          oldValue.length = newValue.length; // TODO: Why must we "sync the new length tour internal oldValue array?" ...instead of having the one equal the other, like in $digest?
        }
        _.forEach(newValue, function (newItem, i) {
          var bothNaN = _.isNaN(newItem) && _.isNaN(oldValue[i]);
          if (!bothNaN && newItem !== oldValue[i]) {
            changeCount += 1;
            oldValue[i] = newItem;
          }
        });
      }
      else {
        //take note if the oldValue isn't an object or was just an array (resets everything)
        if (!_.isObject(oldValue) || _.isArrayLike(oldValue)) { //must regard that it could have been an array, since arrays are objects in JavaScript
          changeCount += 1;
          oldValue = {};
          objectOldLength = 0;
        }
        objectNewLength = 0; //reset the NewLength


        _.forOwn(newValue, function (newVal, key) { //_.forOwn has key instead of iterator
          var bothNaN;
          objectNewLength += 1;
          if (oldValue.hasOwnProperty(key)) {
            bothNaN = _.isNaN(newVal) && _.isNaN(oldValue[key]);
            if (!bothNaN && oldValue[key] !== newVal) {
              changeCount += 1;
              oldValue[key] = newVal;
            }
          }
          else {
            changeCount += 1;
            objectOldLength +=1;
            oldValue[key] = newVal;
          }
        });
        //TODO: See if we can change below to something that may just detect the amount of properties & methods. Could that be an optmization? Why or why not?
        if (objectOldLength > objectNewLength) {
          changeCount += 1;
          _.forOwn(oldValue, function (oldVal, key) {
            //this checks to see if a property that is on the oldValue object is no longer on the newValue object and, consequently, deletes it if it's missing.
            if (!newValue.hasOwnProperty(key)) {
              objectOldLength -= 1;
              delete oldValue[key];
            }
          });
        }
      }
    }

    else {
      if (!self.$$areEqual(newValue, oldValue, false)) {
        changeCount += 1;
      }
      oldValue = newValue;
    }

    return changeCount;
  };

  internalListenerFn = function () {
    if (!!firstRun === true) {
      listenerFn(newValue, newValue, self);
      firstRun = false;
    }
    else{
      listenerFn(newValue, veryOldValue, self);
    }

    if (trackVeryOldValue) {
      veryOldValue = _.clone(newValue);
    }
  };
  //since this runs the $watch method and the $watch method returns a function that can be called to destroy the relevant watcher, this will also have that capability.
  return this.$watch(internalWatchFn, internalListenerFn);
};

/**
 * @description looks up the eventName key on the $$listeners object,
 * if there are no listeners on the key yet it creates an array to hold all of the listeners,
 * then it adds the listener to the array. This will look something like this:
 *
 * $$listeners = {
 *  "eventName" : [listener1, listener2],
 *  "otherEvent" : [listener3]
 * }
 *
 * @param {String} eventName
 * @param listener
 */
Scope.prototype.$on = function(eventName, listener) {
  var listeners = this.$$listeners[eventName];

  if (!listeners) {
    this.$$listeners[eventName] = listeners = [];
  }
  listeners.push(listener);

  return function () {
    var listenerIndex = listeners.indexOf(listener);
    if (listenerIndex >= 0) {
      //instead of splicing out we'll replace it with null, so that nothing will be skipped
      //listeners.splice(listenerIndex, 1);
      listeners[listenerIndex] = null;
    }
  };
};

Scope.prototype.$broadcast = function (eventName) {
  var event = {
    name: eventName,
    targetScope: this,
    preventDefault: function () {
      event.defaultPrevented = true;
    }
  };
  var listenerArgs = [event].concat(_.rest(arguments));

  this.$$everyScope(function (scope) {
    event.currentScope = scope;
    scope.$$fireEventOnScope(eventName, listenerArgs); // this should run when $$everyScope does the 'if(fn(this))' check?
    return true; // any function we put into $$everyScope must return true unless we want to halt its recursive progress
  });
  event.currentScope = null;
  return event;
};

Scope.prototype.$emit = function (eventName) {
  var propagationStopped = false;
  var event = {
    name: eventName,
    targetScope: this,
    stopPropagation: function () { //this makes it so that in any $on you just have to run event.stopPropagation() to prevent $emit from emitting to further parents
      propagationStopped = true;
    },
    preventDefault: function () {
      event.defaultPrevented = true;
    }
  };
  var listenerArgs = [event].concat(_.rest(arguments));
  var scope = this;

  do {
    event.currentScope = scope;
    scope.$$fireEventOnScope(eventName, listenerArgs);
    scope = scope.$parent;
  } while (scope && !propagationStopped);
  event.currentScope = null;

  return event;
};

Scope.prototype.$$fireEventOnScope = function (eventName, listenerArgs) {
  var listeners = this.$$listeners[eventName] || [];
  var i = 0;

  // this is my own solution to p. 171 in the book, but it doesn't remove the null even though it passes the test of concern
  // if I added another test that insisted it would be removed the test would not pass
/*  _.forEach(listeners, function (listener) {
    if(listener !== null) {
      listener.apply(null, listenerArgs);
    }
  });*/

  // in while loops you can control the iterator (unlike for loops which is the basis of forEach
  while (i < listeners.length) {
    if (listeners[i] === null) {
      listeners.splice(i, 1);
    }
    else {
      // REMINDER: This 'apply' is NOT '$apply'
      try {
      listeners[i].apply(null, listenerArgs);
      }
      catch (e) {
        console.error(e);
      }
      i += 1;
    }
  }
  return event;
};