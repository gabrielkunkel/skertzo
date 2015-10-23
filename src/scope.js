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

}

//$watched!
/**
 * @description The $watch method creates an object that gets added
 * to the $$watchers array. It will be this array that the $digest
 * method will loop over in order to scan for changes in scope values.
 *
 * @param {Function} watchFn
 * @param {Function} listenerFn
 */
Scope.prototype.$watch = function (watchFn, listenerFn) {

  /**
   * @property {Object} watcher - Will be added to the scope's $$watchers array
   * @property {Function} watcher.watchFn - Pertains to one value on the scope.
   * @property {Function} watcher.listenerFn - Will be run by $digest as the effect.
   * @type {{watchFn: Function, listenerFn: Function}}
   */
  var watcher = {
    watchFn: watchFn,
    listenerFn: listenerFn || function() {},
    last: initWatchVal
  };
  this.$$watchers.push(watcher);
};

//$digested!
/**
 * @description Runs the listener function of each object on $$watchers array.
 * Put another way, the $digest method cycles through the $$watchers array of
 * objects, and runs each of their listener functions (listenerFn's).
 */
Scope.prototype.$$digestOnce = function () {
  var self = this;
  var newValue, oldValue, dirty;

  _.forEach(this.$$watchers, function (watcher) {
    newValue = watcher.watchFn(self);
    oldValue = watcher.last;
    if (newValue !== oldValue) {
      watcher.last = newValue;
      watcher.listenerFn(newValue,
        oldValue === initWatchVal ? newValue : oldValue,
        self);
      dirty = true;
    }
  });
  return dirty;
}; //end $$digestOnce

Scope.prototype.$digest = function () {
  var dirty;
  do {
    dirty = this.$$digestOnce();
  } while (dirty);
};
