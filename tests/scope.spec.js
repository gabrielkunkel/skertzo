/**
 * Created by gabrielkunkel on 10/21/15.
 */

/* eslint */

/**
 * @description For the scope object class we want...
 * - to create an array of objects (watchers)
 * - that returns the current value of a variable on scope
 * - if it's different than what it was the watchers listener function will be run
 * - a special function will be regularly run to ensure that for every change in value
 * in a variable on the scope, an accompanying listener function will be run. ($digest)
 * - we'll watch for values within objects and arrays, as well as primitive types.
 */

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
          if (!!newValue === true) {
            scope.initial = newValue.substring(0, 1) + '.';
          }
        }
      ); //end of scope.$watch

      scope.$watch(
        function(scope) { return scope.name; },
        function (newValue, oldValue, scope) {
          if (!!newValue === true) {
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

    // This is intended to prevent infinite loops between $watchers
    // ...so $digest will only run a certain number of times for
    // watchers that update each other over and over and over again.
    // "Excel-like" logic still applies in AngularJs!
    it("gives up on the watches after 7 iterations", function() {
      scope.counterA = 0;
      scope.counterB = 0;

      scope.$watch(
        function(scope) { return scope.counterA; },
        function(newValue, oldValue, scope) { scope.counterB += 1; }
      );

      scope.$watch(
         function(scope) { return scope.counterB; },
         function(newValue, oldValue, scope) { scope.counterA += 1; }
      );

      expect(function() { scope.$digest(); }).toThrow();

    });

    it("ends the digest when the last watch is clean", function() {

      var watchExecutions = 0;
      scope.array = _.range(100);


      _.times(100, function (i) {
        scope.$watch(
           function(scope) {
             watchExecutions += 1;
             return scope.array[i];
           },
           function(newValue, oldValue, scope) { }
        );
      }); //end _.times

      scope.$digest();
      expect(watchExecutions).toBe(200);

      scope.array[0] = 777; // This number doesn't matter. It just has to be a different value.
      scope.$digest();
      expect(watchExecutions).toBe(301);

    }); //end it

    it("does not end digest so that new watches are not run", function() {

      scope.aValue = 'abc';
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) { scope.$watch(
          function(scope) { return scope.aValue; },
          function(newValue, oldValue, scope) { scope.counter += 1; }
         );
         }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
      

    }); //end it

    it("compares based on value, instead of just reference, if enabled", function() {
      scope.aValue = [1, 2, 3];
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) { scope.counter++; },
        true
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.aValue.push(4);
      scope.$digest();
      expect(scope.counter).toBe(2);


    }); //end it

    /**
     * Lodash's isEqual method already handles cases where a value will be
     * NaN, but what if we're dealing with a rare equality like this:
     * 0/0 === 0/0, which is the same as NaN === NaN, and these NaN
     * values are on the scope, instead of in an array or object?
     */
    it("correctly handles NaNs on the scope object's values", function() {
      scope.number = 0/0; // NaN
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.number; },
        function(newValue, oldValue, scope) { scope.counter++; }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$digest();
      expect(scope.counter).toBe(1);

    }); //end it

  });

  describe("scope's $eval", function() {
    var scope = {};

    beforeEach(function () {
      scope = new Scope();
    });

    it("executes $eval'ed function and returns result", function() {
      var result;

      scope.aValue = 42;

      result = scope.$eval(function (scope) {
        return scope.aValue;
      });

      expect(result).toBe(42);
    }); //end it
    
    it("passes the second $eval argument straight through to be evaluated", function() {
      var result;

      scope.aValue = 42;

      result = scope.$eval(
        function (scope) {
          var temp;
          temp = scope.aValue + 2;
          return temp;
        },
        2 // added second argument
      );

      expect(result).toBe(44);

    }); //end it
  }); //end describe

  describe("scope's $apply", function() {
    var scope = {};

    beforeEach(function () {
      scope = new Scope();
    });

    it("executes $apply'ed function and starts the $digest", function() {
      scope.aValue = 'weAreTheKnightsWhoSay';
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) { scope.counter += 1; }
      );

      //expect 1
      scope.$digest();
      expect(scope.counter).toBe(1);

      //expect 2
      scope.$apply(function (scope) {
        scope.aValue = 'yourMotherWasAHamsterAndYourFatherSmelledOfElderberries';
      });
      expect(scope.counter).toBe(2);
    }); //end it
  }); //end describe

  describe("scope's $evalAsync", function() {
    var scope = {};

    beforeEach(function () {
      scope = new Scope();
    });

    it("executes the function later in the same cycle", function() {
      scope.aValue = [1, 2, 3];
      scope.asyncEvaluated = false;
      scope.asyncEvaluatedImmediately = false;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) {
          scope.$evalAsync(function(scope) {
            scope.asyncEvaluated = true; //we want this to be delayed
          });
          scope.asyncEvaluatedImmediately = scope.asyncEvaluated; //this should be false
        }
      );

      scope.$digest();
      expect(scope.asyncEvaluated).toBe(true);
      expect(scope.asyncEvaluatedImmediately).toBe(false);
    }); //end it
    
    it("executes $evalAsync'ed functions added by watch functions", function() {
      scope.aValue = [1, 2, 3];
      scope.asyncEvaluated = false;

      scope.$watch(
        function(scope) {
          if(!scope.asyncEvaluated === true) {
            scope.$evalAsync(function (scope) {
              scope.asyncEvaluated = true;
            });
          }
          return scope.aValue;
        },
        function(newValue, oldValue, scope) { }
      );

      scope.$digest();

      expect(scope.asyncEvaluated).toBe(true);
    }); //end it

    it("executes $evalAsync'ed function even when not dirty", function() {
      scope.aValue = [1, 2, 3];
      scope.asyncEvaluatedTimes = 0;

      scope.$watch(
        function(scope) {
          if(scope.asyncEvaluatedTimes < 2) {
            scope.$evalAsync(function (scope) {
              scope.asyncEvaluatedTimes += 1;
          });
          }
          return scope.aValue;
        },
        function(newValue, oldValue, scope) { }
      );

      scope.$digest();

      expect(scope.asyncEvaluatedTimes).toBe(2);


    }); //end it

    it("eventually halts $evalAsyncs added by watches, preventing infinite loops", function() {
      scope.aValue = [1, 2, 3];
      
      scope.$watch(
        function(scope) {
          scope.$evalAsync(function(scope) { });
          return scope.aValue;
        },
        function(newValue, oldValue, scope) { }
      );

      expect(function() { scope.$digest(); }).toThrow();
    }); //end it
  }); //end describe

  describe("$$phase field", function() {
    var scope = {};

    beforeEach(function () {
      scope = new Scope();
    });

    it("has a value that is the current digest phase", function() {
      scope.aValue = [1, 2, 3];
      scope.phaseInWatchFunction = 'nee';
      scope.phaseInListenerFunction = 'nee';
      scope.phaseInApplyFunction = 'nee';

      scope.$watch(
        function(scope) {
          scope.phaseInWatchFunction = scope.$$phase;
          return scope.aValue;
        },
        function(newValue, oldValue, scope) {
          scope.phaseInListenerFunction = scope.$$phase;
        }
      );

      scope.$apply(function (scope) {
        scope.phaseInApplyFunction = scope.$$phase;
      });

      expect(scope.phaseInWatchFunction).toBe('$digest');
      expect(scope.phaseInListenerFunction).toBe('$digest');
      expect(scope.phaseInApplyFunction).toBe('$apply');

    }); //end it
    
    it("will be used by $evalAsync to run a function at the appropriate time", function(done) {
      scope.aValue = "anAfricanOrEuropeanSwallow";
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) { scope.counter += 1; }
      );

      scope.$evalAsync(function (scope) { });

      expect(scope.counter).toBe(0);
      setTimeout(function () {
        expect(scope.counter).toBe(1);
        done();
      }, 50);

    }); //end it
  }); //end describe
  
  describe("async $apply with $applyAync", function() {
    var scope = {};

    beforeEach(function () {
      scope = new Scope();
    });

    it("allows async $apply with $applyAsync", function(done) {
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) { scope.counter += 1; }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$applyAsync(function (scope) {
        scope.aValue = 'abc';
      });
      expect(scope.counter).toBe(1);

      setTimeout(function () {
        expect(scope.counter).toBe(2);
        done();
      }, 50);
    }); //end it

    it("never executes $applyAsync'ed function in the same cycle", function(done) {
      scope.aValue = [1, 2, 3];
      scope.asyncApplied = false;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) {
          scope.$applyAsync(function (scope) {
            scope.asyncApplied = true;
          });
        }
      );

      scope.$digest();
      expect(scope.asyncApplied).toBe(false);

      setTimeout(function () {
        expect(scope.asyncApplied).toBe(true);
        done();
      }, 50);
    }); //end it

    it("allows async $apply with $applyAsync", function(done) {
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) { scope.counter += 1; }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$applyAsync(function() {
        scope.aValue = 'Monty';
      });
      expect(scope.counter).toBe(1);

      setTimeout(function() {
        expect(scope.counter).toBe(2);
        done();
      }, 50);
    }); //end it

    it("coalesces many calls to $applyAsync", function(done) {
      scope.counter = 0;

      scope.$watch(
        function(scope) {
          scope.counter += 1;
          return scope.aValue;
        },
        function(newValue, oldValue, scope) { }
      );

      scope.$applyAsync(function (scope) {
        scope.aValue = 'ICameHereForAnArgument';
      });

      scope.$applyAsync(function (scope) {
        scope.aValue = 'NoYouCameHereForAnArgument';
      });

      setTimeout(function () {
        expect(scope.counter).toBe(2);
        done();
      }, 50);
    }); //end it

    it("cancels and flushes $applyasync if digested first", function(done) {
      scope.counter = 0;

      scope.$watch(
        function(scope) {
          scope.counter += 1;
          return scope.aValue;
        },
        function(newValue, oldValue, scope) { }
      );

      scope.$applyAsync(function (scope) {
        scope.aValue = 'theBishop!';
      });

      scope.$applyAsync(function (scope) {
        scope.aValue = 'no!TheBishop!';
      });

      scope.$digest();
      expect(scope.counter).toBe(2);
      expect(scope.aValue).toEqual('no!TheBishop!');

      setTimeout(function () {
        expect(scope.counter).toBe(2);
        done();
      }, 50);
      
    }); //end it

  }); //end describe

  describe("$$postDigest function", function() {
    var scope = {};

    beforeEach(function () {
      scope = new Scope();
    });

    
    it("runs after each digest", function() {
      scope.counter = 0;

      scope.$$postDigest(function () {
        scope.counter += 1;
      });

      expect(scope.counter).toBe(0);

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$digest();
      expect(scope.counter).toBe(1);


    }); //end it

    it("is not included in the $digest run", function() {
      scope.aValue = 'original value';

      scope.$$postDigest(function () {
        scope.aValue = 'changed value';
      });

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) { scope.watchedValue = newValue; }
      );

      scope.$digest();
      expect(scope.watchedValue).toBe('original value');

      scope.$digest();
      expect(scope.watchedValue).toBe('changed value');

    }); //end it


    
  }); //end describe
});