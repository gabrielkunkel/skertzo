/**
 * Created by gabrielkunkel on 10/21/15.
 */

/* eslint */
"use strict";

describe("The $scope object class", function() {
  
  it("can be constructed and used as an object", function() {
    var scope = new Scope();
    scope.aProperty = 1;

    expect(scope.aProperty).toBe(1);
  });

  describe("$scope's digest", function() {
    var scope = {};

    beforeEach(function () {
      scope = new Scope();
    });

    it("calls the listener function of a watch on first $digest", function() {

      var watchFn = function() { return 'watching...'; };
      var listenerFn = jasmine.createSpy();

      scope.$watch(watchFn, listenerFn);

      scope.$digest();

      expect(listenerFn).toHaveBeenCalled();
    });

    it("calls the watch function with the scope as the argument", function() {
      var watchFn = jasmine.createSpy();
      var listenerFn = function() { };

      scope.$watch(watchFn, listenerFn);
      scope.$digest();

      expect(watchFn).toHaveBeenCalledWith(scope);
    });

    it("calls the listener function when the watched value changes", function() {
      scope.someValue = 'a';
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.someValue; },
        function(newValue, oldValue, scope) { scope.counter++; }
      );

      expect(scope.counter).toBe(0);

      scope.$digest();
      expect(scope.counter).toBe(1);

      //if $digest runs and doesn't find a change in value, so it does not run the listenerFn
      scope.$digest();
      expect(scope.counter).toBe(1);

      //after the value changes there should be no difference
      scope.someValue = 'b';
      expect(scope.counter).toBe(1);

      //...but, if we run digest, the listenerFn should run
      scope.$digest();
      expect(scope.counter).toBe(2);

    });

    it("calls the listenerFn when the watch value is first undefined", function() {
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.someValue; },
        function(newValue, oldValue, scope) { scope.counter++; }
      );

      scope.$digest();

      expect(scope.counter).toBe(1);
    });
    
    it("may have watchers that omit the listener function", function() {
      var watchFn = jasmine.createSpy().and.returnValue('(value from watchFn)');
      scope.$watch(watchFn);

      scope.$digest();

      expect(watchFn).toHaveBeenCalled();
    });

    // my own test to clarify something about JavaScript
    it("adds new value onto the scope by adding one through a watchFn", function() {

      scope.$watch(
        function(scope) {
          /* eslint no-return-assign: 1 */
          return scope.thisValueExists = 5;
        }
      );

      scope.$digest();

      expect(scope.thisValueExists).toBe(5);

    });

    it("triggers chained watchers in the same digest", function () {
      scope.name = 'Jane';

      scope.$watch(
        function(scope) { return scope.nameUpper; },
        function (newValue, oldValue, scope) {
          if (newValue) {
            scope.initial = newValue.substring(0, 1) + '.';
          }
        }
      ); //end of scope.$watch

      scope.$watch(
        function(scope) { return scope.name; },
        function (newValue, oldValue, scope) {
          /* eslint eqeqeq: 1 */
          if (newValue) {
            scope.nameUpper = newValue.toUpperCase();
          }
        }
      ); //end of scope.$watch

      scope.$digest();
      expect(scope.initial).toBe('J.');
      scope.name = 'Richard';
      scope.$digest();
      expect(scope.initial).toBe('R.');

    }); //end it

  });

});