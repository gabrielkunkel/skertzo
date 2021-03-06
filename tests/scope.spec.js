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

/* eslint no-shadow: 0, no-undef: 0, no-unused-vars: 0 */

"use strict";

xdescribe("The $scope object class", function() {
  
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
          scope.thisValueExists = 5;
          return scope.thisValueExists;
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

  describe("exception handling", function() {
    var scope = {};

    beforeEach(function () {
      scope = new Scope();
    });

    it("catches exceptions in watchFn's and continues", function() {
      scope.aValue = 'Why are we here? What\'s life all about?';
      scope.counter = 0;

      scope.$watch(
        function(scope) { throw "WatchFn Error"; }, // TODO: Explore... Can you... Would you ever put a throw in a return statement?
        function(newValue, oldValue, scope) { }
      );

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) { scope.counter += 1; }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    }); //end it

    it("catches exceptions in listenerFn's and continues", function() {
      scope.aValue = 'Is God really here? ...or is there some doubt?';
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.aValue; }, // TODO: Explore... Can you... Would you ever put a throw in a return statement?
        function(newValue, oldValue, scope) {
          throw "ListenerFn Error";
        }
      );

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) { scope.counter += 1; }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    }); //end it
    
    it("is active in $evalAsync to allow the $digest loop to keep running", function(done) {
      scope.counter = 0;
      scope.aValue = 'Be careful everyone. Look out for the killer cars!';

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) { scope.counter += 1; }
      );

      scope.aFunction = function (scope) {
        throw 'Error';
      };

      scope.$evalAsync(scope.aFunction);

      scope.$digest();

      setTimeout(function () {
        expect(scope.counter).toBe(1);
        done();
      }, 50);
    }); //end it

    it("catches exceptions in $applyAsync", function(done) {

      scope.$applyAsync(function (scope) {
        throw "Error";
      });

      scope.$applyAsync(function (scope) {
        throw "Error";
      });

      scope.$applyAsync(function (scope) {
        scope.applied = true;
      });

      setTimeout(function () {
        expect(scope.applied).toBe(true);
        done();
      }, 50);
    }); //end it

    it("catches exceptions in $$postDigest", function() {
      var didRun = 'The Ministry of Silly Walks';

      scope.$$postDigest(function () {
        throw 'Error';
      });

      scope.$$postDigest(function (scope) {
        didRun = 'He\'s not the messiah. He\'s a very naughty boy!';
      });

      scope.$digest();

      expect(didRun).toBe('He\'s not the messiah. He\'s a very naughty boy!');
    }); //end it
  }); //end describe

  describe("How to destroy watches", function() {
    var scope = {};

    beforeEach(function () {
      scope = new Scope();
    });

    it("allows destroying a $watch with a removal function", function() {
      var destroyAValueWatch;

      scope.aValue = 'abc';
      scope.counter = 0;

      destroyAValueWatch = scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) { scope.counter += 1; }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.aValue = 'def';
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.aValue = 'ghi';
      destroyAValueWatch();
      scope.$digest();
      expect(scope.counter).toBe(2);
    }); //end it

    it("allows destroying a $watch during digest", function() {
      var watchCalls = [];
      var destroyWatch;

      scope.aValue = 'Arthur! Arthur, King of the Britains!';

      scope.$watch(
        function(scope) {
          watchCalls.push('first');
          return scope.aValue;
        }
      );

      destroyWatch = scope.$watch(
        function(scope) {
          watchCalls.push('second');
          destroyWatch();
        }
      );

      scope.$watch(
        function(scope) {
          watchCalls.push('third');
          return scope.aValue;
        }
      );

      scope.$digest();
      expect(watchCalls).toEqual(['first', 'second', 'third', 'first', 'third']);


    }); //end it

    it("allows a $watch to destroy another during digest", function() {
      var destroyWatch;

      scope.aValue = 'Crunchy Frog';
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) { destroyWatch(); }
      );

      destroyWatch = scope.$watch(
        function(scope) { },
        function(newValue, oldValue, scope) { }
      );

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) { scope.counter += 1; }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    }); //end it

    it("allows destroying several $watches during digest", function() {
      var destroyWatch1, destroyWatch2;

      scope.aValue = 'What is your favorite color?';
      scope.counter = 0;

      destroyWatch1 = scope.$watch(
        function(scope) {
          destroyWatch1();
          destroyWatch2();
        }
      );

      destroyWatch2 = scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) { scope.counter += 1; }
      );

      scope.$digest();
      expect(scope.counter).toBe(0);
    }); //end it

  }); //end describe

  describe("Watching several changes with one listener using $watchGroup", function() {
    var scope = {};

    beforeEach(function() {
      scope = new Scope();
    });

    it("takes watches as an array and calls listener with arrays", function() {
      var gotNewValues, gotOldValues;

      scope.aValue = 1;

      scope.anotherValue = 2;

      scope.$watchGroup([
        function(scope) { return scope.aValue; },
        function(scope) { return scope.anotherValue; }
      ], function (newValues, oldValues, scope) {
          gotNewValues = newValues;
          gotOldValues = oldValues;
        }
      ); //end $watchGroup
      scope.$digest();

      expect(gotNewValues).toEqual([1, 2]);
      expect(gotOldValues).toEqual([1, 2]);
    }); //end it

    it("only calls listener once per digest", function() {
      var counter = 0;

      scope.aValue = 1;
      scope.anotherValue = 2;

      scope.$watchGroup([
        function(scope) { return scope.aValue; },
        function(scope) { return scope.anotherValue; }
      ],
        function(newValues, oldValues, scope) {
          counter += 1;
        }
      );
      scope.$digest();

      expect(counter).toEqual(1);
    }); //end it

    it("uses the same array of old and new values on first run", function() {
      var gotNewValues, gotOldValues;

      scope.aValue = 1;
      scope.anotherValue = 2;

      scope.$watchGroup([
        function(scope) { return scope.aValue },
        function(scope) { return scope.anotherValue }
      ],
        function(newValues, oldValues, scope) {
          gotNewValues = newValues;
          gotOldValues = oldValues;
        }
      );

      scope.$digest();

      expect(gotNewValues).toBe(gotOldValues);

    }); //end it

    it("uses different arrays for old and new values on subsequent runs", function() {
      var gotNewValues, gotOldValues;

      scope.aValue = 1;
      scope.anotherValue = 2;

      scope.$watchGroup([
          function(scope) { return scope.aValue },
          function(scope) { return scope.anotherValue }
        ],
        function(newValues, oldValues, scope) {
          gotNewValues = newValues;
          gotOldValues = oldValues;
        }
      );

      scope.$digest();
      scope.anotherValue = 3;

      scope.$digest();

      expect(gotNewValues).not.toBe(gotOldValues);
      expect(gotNewValues).toEqual([1, 3]);
      expect(gotOldValues).toEqual([1, 2]);


    }); //end it

    it("calls the listenerFn at least once, even if the arrays are empty", function() {
      scope.counter = 0;

      scope.aValue = 1;
      scope.anotherValue = 2;

      scope.$watchGroup([], //empty array
        function(newValues, oldValues, scope) {
          scope.counter += 1;
        }
      );

      scope.$digest();

      expect(scope.counter).toBe(1);

    }); //end it

    it("can be de-registered", function() {
      var counter = 0, destroyGroup;

      scope.aValue = 1;
      scope.anotherValue = 2;

      destroyGroup = scope.$watchGroup([
          function(scope) { return scope.aValue; },
          function(scope) { return scope.anotherValue; }
        ],
        function(newValues, oldValues, scope) {
          counter += 1;
        }
      );
      scope.$digest();

      scope.anotherValue = 3;
      destroyGroup();
      scope.$digest();

      expect(counter).toEqual(1);
    }); //end it

    it("does not call the zero-watch listener when de-registered first", function() {
      var counter = 0;
      var destroyGroup = [];

      destroyGroup = scope.$watchGroup([], function (newValues, oldValues, scope) {
        counter += 1;
      });
      destroyGroup();
      scope.$digest();

      expect(counter).toEqual(0);

    }); //end it

  }); //end describe "$watchGroup"

  describe("Regarding inheritance...", function() {
    
    it("the child does inherit the parent's properties", function() {
      var parent = new Scope();
      var child = parent.$new();

      parent.aValue = [1, 2, 3];


      expect(child.aValue).toEqual([1, 2, 3]);
    }); //end it

    it("the parent does NOT inherit the child's properties", function() {
      var parent = new Scope();
      var child = parent.$new();

      child.aValue = ['flying', 'circus'];


      expect(parent.aValue).not.toEqual(['flying', 'circus']);
      expect(parent.aValue).toBeUndefined();

    }); //end it

    it("the child can manipulate a parent scope's property", function() {
      var parent = new Scope();
      var child = parent.$new();

      parent.aValue = [1, 2, 3];

      child.aValue.push(4);

      expect(child.aValue).toEqual([1, 2, 3, 4]);
      expect(parent.aValue).toEqual([1, 2, 3, 4]);
    }); //end it

    it("the child can watch a property in the parent", function() {
      var parent = new Scope();
      var child = parent.$new();

      parent.aValue = [1, 2, 3];
      child.counter = 0;
      
      child.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) { scope.counter += 1; },
        true
      );

      child.$digest();
      expect(child.counter).toBe(1);

      parent.aValue.push(4);
      child.$digest();
      
      //expect(child.aValue).toBe([1, 2, 3, 4]); //this doesn't pass because the newly created array object does not occupy the same memory space as child.aValue.
      expect(child.aValue).toEqual([1, 2, 3, 4]); // this passes though
      expect(child.counter).toBe(2);
      expect(child.aValue).toBe(parent.aValue); // They are the same

    }); //end it
    
    it("children can be nested at any depth", function() {
      var a = new Scope();
      var aa = a.$new();
      var aaa = aa.$new(); //use object multiple times to create different objects
      var aab = aa.$new();

      var ab = a.$new(); // double-check parent to child but NO child to parent
      var abb = ab.$new();

      a.value = 1;

      expect(aa.value).toBe(1);
      expect(aaa.value).toBe(1);
      expect(aab.value).toBe(1);
      expect(ab.value).toBe(1);
      expect(abb.value).toBe(1);

      ab.anotherValue = 2; // change child to see how it impacts the parent

      expect(abb.anotherValue).toBe(2);
      expect(aa.anotherValue).toBeUndefined();
      expect(aaa.anotherValue).toBeUndefined();
    }); //end it

    it("a child or children do not digest their parent(s)", function() {
      var parent = new Scope();
      var child = parent.$new();

      parent.aValue = 'The Larch';

      parent.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) {
          scope.aValueWas = newValue;
        }
      );

      child.$digest();
      expect(child.aValueWas).toBeUndefined();
    }); //end it
    
    it("a scope keeps record of its children", function() {
      var parent = new Scope();
      var child1 = parent.$new();
      var child2 = parent.$new();
      var childOfChild2 = child2.$new();

      expect(parent.$$children.length).toBe(2);
      expect(parent.$$children[0]).toBe(child1);
      expect(parent.$$children[1]).toBe(child2);

      expect(child1.$$children.length).toBe(0);
      expect(child2.$$children.length).toBe(1);
      expect(child2.$$children[0]).toBe(childOfChild2);
    }); //end it
    
    it("each parent digests their children", function() {
      var parent = new Scope();
      var child = parent.$new();

      parent.aValue = 'Owl Stretching Time';

      child.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) { scope.aValueWas = newValue; }
      );
      
      parent.$digest();
      expect(child.aValueWas).toBe('Owl Stretching Time');

    }); //end it

    it("digests from root on $apply", function() {
      var parent = new Scope();
      var child = parent.$new();
      var child2 = child.$new();

      parent.aValue = 'Next... I eat the banana!';
      parent.counter = 0;

      parent.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) { scope.counter += 1; }
      );

      child2.$apply(function(scope) { });

      expect(parent.counter).toBe(1);
    }); //end it

    it("schedules a digest from root on $evalAysnc", function(done) {
      var parent = new Scope();
      var child = parent.$new();
      var child2 = child.$new();

      parent.aValue = 'Next... I eat the banana!';
      parent.counter = 0;

      parent.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) { scope.counter += 1; }
      );

      child2.$evalAsync(function (scope) { });

      setTimeout(function () {
        expect(parent.counter).toBe(1);
        done();
      }, 50);
    }); //end it

    it("does not have access to parent attributes when isolated", function() {
      var parent = new Scope();
      var child = parent.$new(true);

      parent.aValue = 'Hi, I\'m Aruther Lemming of the British Dental Association.';

      expect(child.aValue).toBeUndefined();
    }); //end it

    it("cannot watch parent attributes when isolated", function() {
      var parent = new Scope();
      var child = parent.$new(true);

      parent.aValue = 'Lemming... Lemming... Lemming of the BDA!';

      child.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) { scope.aValueWas = newValue; }
      );

      child.$digest();
      expect(child.aValueWas).toBeUndefined();
    }); //end it

    it("digests from root on $apply when isolated", function() {
      var parent = new Scope();
      var child = parent.$new(true);
      var childUnderChild = child.$new();

      parent.aValue = 'And now, for something completely different.';
      parent.counter = 0;
      parent.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) { scope.counter += 1; }
      );

      childUnderChild.$apply(function(scope) { });

      expect(parent.counter).toBe(1);
    }); //end it

    it("schedules a digest from root on $evalAsync when isolated", function(done) {
      var parent = new Scope();
      var child = parent.$new(true);
      var childUnderChild = child.$new();

      parent.aValue = 'And now, a man with a tape recorder up his nose.';
      parent.counter = 0;
      parent.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) { scope.counter += 1; }
      );

      childUnderChild.$evalAsync(function(scope) { });

      setTimeout(function () {
        expect(parent.counter).toBe(1);
        done();
      }, 50);
    }); //end it

    it("executes $evalAsync functions on isolated scopes", function(done) {
      var parent = new Scope();
      var child = parent.$new(true);

      child.$evalAsync(function (scope) {
        scope.didEvalAsync = true;
      });

      setTimeout(function () {
        expect(child.didEvalAsync).toBe(true);
        done();
      }, 50);
    }); //end it

    it("executes $$postDigest functions on isolated scopes", function() {
      var parent = new Scope();
      var child = parent.$new(true);

      child.$$postDigest(function () {
        child.didPostDigest = true;
      });
      parent.$digest();

      expect(child.didPostDigest).toBe(true);

    }); //end it

    it("can take some other scope as the parent", function() {
      var prototypeParent = new Scope();
      var hierarchyParent = new Scope();
      var child = prototypeParent.$new(false, hierarchyParent);

      prototypeParent.a = 42;
      expect(child.a).toBe(42);

      child.counter = 0;
      child.$watch(function (scope) {
        scope.counter += 1;
      });

      prototypeParent.$digest();
      expect(child.counter).toBe(0);

      hierarchyParent.$digest();
      expect(child.counter).toBe(2);
      
    }); //end it
    
    it("is no longer digested when $destroy has been called", function() {
      var parent = new Scope();
      var child = parent.$new();

      child.aValue = [1, 2, 3];
      child.counter = 0;
      child.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) { scope.counter += 1; },
        true
      );

      parent.$digest();
      expect(child.counter).toBe(1);

      child.aValue.push(4);
      parent.$digest();
      expect(child.counter).toBe(2);

      child.$destroy();
      child.aValue.push(5);
      parent.$digest();
      expect(child.counter).toBe(2);
    }); //end it

  }); //end describe "inheritance"

  describe("$watchCollection", function() {
    var scope;

    beforeEach(function () {
      scope = new Scope();
    });

    it("works like normal for non-collections", function() {
      var valueProvided;

      scope.aValue = 42;
      scope.counter = 0;

      scope.$watchCollection(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) {
          valueProvided = newValue;
          scope.counter += 1;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
      expect(valueProvided).toBe(scope.aValue);

      scope.aValue = 43;
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);

    }); //end it


    it("works like normal for NaNs", function() {
      scope.aValue = 0/0;
      scope.counter = 0;

      scope.$watchCollection(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) {
          scope.counter += 1;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$digest();
      expect(scope.counter).toBe(1);
    }); //end it

    it("notices when the value becomes an array", function() {
      scope.counter = 0;

      scope.$watchCollection(
        function(scope) { return scope.array; },
        function(newValue, oldValue, scope) { scope.counter += 1; }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.array = [1, 2, 3];
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);

    }); //end it
    
    it("notices an item added to an array", function() {
      scope.array = [1, 2, 3];
      scope.counter = 0;

      scope.$watchCollection(
        function(scope) { return scope.array; },
        function(newValue, oldValue, scope) { scope.counter += 1; }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.array.push(4);
      scope.$digest();
      expect(scope.counter).toBe(2);

    }); //end it

    it("notices an item removed from an array", function() {
      scope.array = [1, 2, 3];
      scope.counter = 0;

      scope.$watchCollection(
        function(scope) { return scope.array; },
        function(newValue, oldValue, scope) { scope.counter += 1; }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.array.pop();
      scope.$digest();
      expect(scope.counter).toBe(2);
    }); //end it

    it("notices an item replaced in an array", function() {
      scope.array = [1, 2, 3];
      scope.counter = 0;

      scope.$watchCollection(
        function(scope) { return scope.array; },
        function(newValue, oldValue, scope) { scope.counter += 1; }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.array[1] = 'Oh, fishy, fishy, fishy fish!';
      scope.$digest();
      expect(scope.counter).toBe(2);

    }); //end it

    it("notices items reordered in an array", function() {
      scope.array = [3, 2, 1];
      scope.counter = 0;

      scope.$watchCollection(
        function(scope) { return scope.array; },
        function(newValue, oldValue, scope) { scope.counter += 1; }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.array.sort();
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);

    }); //end it

    it("does not fail on NaNs in arrays", function() {
      scope.array = [2, NaN, 3];
      scope.counter = 0;

      scope.$watchCollection(
        function(scope) { return scope.array; },
        function(newValue, oldValue, scope) { scope.counter += 1; }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    }); //end it

    it("notices an item replaced in an arguments object", function() {
      (function () {
        scope.arrayLike = arguments;
      })(1, 2, 3);

      scope.counter = 0;

      scope.$watchCollection(
        function(scope) { return scope.arrayLike; },
        function(newValue, oldValue, scope) { scope.counter += 1; }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.arrayLike[1] = 42;
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);
    }); //end it

    it("notices an item replaced in a NodeList object", function() {
      document.documentElement.appendChild(document.createElement('div'));
      scope.arrayLike = document.getElementsByTagName('div');

      scope.counter = 0;

      scope.$watchCollection(
        function(scope) { return scope.arrayLike; },
        function(newValue, oldValue, scope) { scope.counter += 1; }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      document.documentElement.appendChild(document.createElement('div'));
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);
    }); //end it

    it("notices when the value becomes an object", function() {
      scope.counter = 0;

      scope.$watchCollection(
        function(scope) { return scope.obj; },
        function(newValue, oldValue, scope) { scope.counter += 1; }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.obj = {a: 1};
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);

    }); //end it

    it("notices when an attribute is added to an object", function() {
      scope.counter = 0;
      scope.obj = {a: 1};

      scope.$watchCollection(
        function(scope) { return scope.obj; },
        function(newValue, oldValue, scope) { scope.counter += 1; }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.obj.b = 2;
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);

    }); //end it

    it("notices when an attribute is changed in an object", function() {
      scope.counter = 0;
      scope.obj = {a: 1, b:2};

      scope.$watchCollection(
        function(scope) { return scope.obj; },
        function(newValue, oldValue, scope) { scope.counter += 1; }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.obj.b = 777;
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);
    }); //end it

    it("does not fail on NaN attributes in objects", function() {
      scope.counter = 0;
      scope.obj = {a: NaN};

      scope.$watchCollection(
        function(scope) { return scope.obj; },
        function(newValue, oldValue, scope) { scope.counter += 1; }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    }); //end it

    it("notices when an attribute is removed from an object", function() {
      scope.counter = 0;
      scope.obj = {a: 1};

      scope.$watchCollection(
        function(scope) { return scope.obj; },
        function(newValue, oldValue, scope) { scope.counter += 1; }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      delete scope.obj.a;
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);
    }); //end it

    it("does not consider any object with a length property an array", function() {
      scope.obj = {length: 42, otherKey: 'abc' };
      scope.counter = 0;

      scope.$watchCollection(
        function(scope) { return scope.obj; },
        function(newValue, oldValue, scope) { scope.counter += 1; }
      );

      scope.$digest();

      scope.obj.newKey = 'def';
      scope.$digest();

      expect(scope.counter).toBe(2);
    }); //end it

    it("gives the old non-collection value to listeners", function() {
      var oldValueGiven;
      scope.aValue = 14;

      scope.$watchCollection(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) { oldValueGiven = oldValue; }
      );

      scope.$digest();

      scope.aValue = 15;
      scope.$digest();

      expect(oldValueGiven).toBe(14);

    }); //end it

    it("gives the old array value to listeners", function() {
      var oldValueGiven;
      scope.aValue = [1, 2, 3];

      scope.$watchCollection(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) { oldValueGiven = oldValue; }
      );

      scope.$digest();

      scope.aValue.push(4);
      scope.$digest();

      expect(oldValueGiven).toEqual([1, 2, 3]);
    }); //end it

    it("gives the old object value to listeners", function() {
      var oldValueGiven;
      scope.aValue = {a: 1, b: 2};

      scope.$watchCollection(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) { oldValueGiven = oldValue; }
      );

      scope.$digest();

      scope.aValue.c = 3;
      scope.$digest();

      expect(oldValueGiven).toEqual({a: 1, b: 2});
    }); //end it

    it("uses the new value as the old value on first digest", function() {
      var oldValueGiven;
      scope.aValue = {a: 1, b: 2};

      scope.$watchCollection(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) { oldValueGiven = oldValue; }
      );

      scope.$digest();

      expect(oldValueGiven).toEqual({a: 1, b: 2});
    }); //end it
  }); //end describe $watchCollection

  describe("Events", function() {
    var parent;
    var scope;
    var child;
    var isolatedChild;

    beforeEach(function () {
      parent = new Scope();
      scope = parent.$new();
      child = scope.$new();
      isolatedChild = scope.$new(true);
    });

    it("allows registering listeners", function() {
      var listener1 = function() { };
      var listener2 = function() { };
      var listener3 = function() { };

      scope.$on('someEvent', listener1);
      scope.$on('someEvent', listener2);
      scope.$on('someOtherEvent', listener3);

      expect(scope.$$listeners).toEqual({
        someEvent: [listener1, listener2],
        someOtherEvent: [listener3]
      });
    }); //end it

    it("registers different listeners for every scope", function() {
      var listener1 = function() { };
      var listener2 = function() { };
      var listener3 = function() { };

      scope.$on('someEvent', listener1);
      child.$on('someEvent', listener2);
      isolatedChild.$on('someEvent', listener3);

      expect(scope.$$listeners).toEqual({someEvent: [listener1]});
      expect(child.$$listeners).toEqual({someEvent: [listener2]});
      expect(isolatedChild.$$listeners).toEqual({someEvent: [listener3]});
    }); //end it

    _.forEach(['$emit', '$broadcast'], function (method) {

      it("calls the listeners of the matching event on " + method, function() {
        var listener1 = jasmine.createSpy();
        var listener2 = jasmine.createSpy();

        scope.$on('someEvent', listener1);
        scope.$on('someOtherEvent', listener2);

        scope[method]('someEvent');

        expect(listener1).toHaveBeenCalled();
        expect(listener2).not.toHaveBeenCalled();
      }); //end it

      it("passes an event object with a name to listeners on " + method, function() {
        var listener = jasmine.createSpy();
        scope.$on('someEvent', listener);

        scope[method]('someEvent');

        expect(listener).toHaveBeenCalled();
        expect(listener.calls.mostRecent().args[0].name).toEqual('someEvent');
      }); //end it

      it("passes the same event object to each listener on " + method, function() {
        var event1, event2;

        var listener1 = jasmine.createSpy();
        var listener2 = jasmine.createSpy();
        scope.$on('someEvent', listener1);
        scope.$on('someEvent', listener2);

        scope[method]('someEvent');

        event1 = listener1.calls.mostRecent().args[0];
        event2 = listener2.calls.mostRecent().args[0];

        expect(event1).toBe(event2);
      }); //end it

      it("passes additional arguments to listeners on " + method, function() {

        var listener = jasmine.createSpy();
        scope.$on('someEvent', listener);

        scope[method]('someEvent', 'and', ['additional', 'arguments'], '...');

        expect(listener.calls.mostRecent().args[1]).toEqual('and');
        expect(listener.calls.mostRecent().args[2]).toEqual(['additional', 'arguments']);
        expect(listener.calls.mostRecent().args[3]).toEqual('...');
      }); //end it

      it("returns the event object on " + method, function() {
        var returnedEvent = scope[method]('someEvent');

        expect(returnedEvent).toBeDefined();
        expect(returnedEvent.name).toEqual('someEvent');
      }); //end it

      it("can be de-registered " + method, function() {
        var listener = jasmine.createSpy();
        var deregister = scope.$on('someEvent', listener);

        deregister();

        scope[method]('someEvent');

        expect(listener).not.toHaveBeenCalled();
      }); //end it

      it("does not skip the next listener when removed on " + method, function() {
        var deregister;
        var listener = function () { deregister(); };
        var nextListener = jasmine.createSpy();

        deregister = scope.$on('someEvent', listener);
        scope.$on('someEvent', nextListener);

        scope[method]('someEvent');

        expect(nextListener).toHaveBeenCalled();
      }); //end it

      it("sets defaultPrevented when preventDefault called on " + method, function() {
        var event;
        var listener = function (event) {
          event.preventDefault();
        };
        scope.$on('someEvent', listener);

        event = scope[method]('someEvent');

        expect(event.defaultPrevented).toBe(true);
      }); //end it

      it("does not stop on exceptions" + method, function() {
        var listener1 = function (event) {
          throw 'listener1 throwing an exception';
        };
        var listener2 = jasmine.createSpy();
        
        scope.$on('someEvent', listener1);
        scope.$on('someEvent', listener2);
        
        scope[method]('someEvent');
        
        expect(listener2).toHaveBeenCalled();

      }); //end it

    }); // end of forEach for each method of $emit and $broadcast

    it("propagates up the scope hierarchy on $emit", function() {
      var parentListener = jasmine.createSpy();
      var scopeListener = jasmine.createSpy();

      parent.$on('someEvent', parentListener);
      scope.$on('someEvent', scopeListener);

      scope.$emit('someEvent');

      expect(scopeListener).toHaveBeenCalled();
      expect(parentListener).toHaveBeenCalled();
    }); //end it


    it("propagates the same event up on $emit", function() {
      var scopeEvent, parentEvent;
      var parentListener = jasmine.createSpy();
      var scopeListener = jasmine.createSpy();

      parent.$on('someEvent', parentListener);
      scope.$on('someEvent', scopeListener);

      scope.$emit('someEvent');

      scopeEvent = scopeListener.calls.mostRecent().args[0];
      parentEvent = parentListener.calls.mostRecent().args[0];
      expect(scopeEvent).toBe(parentEvent);
    }); //end it

    it("propagates down the scope hierarchy on $broadcast", function() {
      var scopeListener = jasmine.createSpy();
      var childListener = jasmine.createSpy();
      var isolatedChildListener = jasmine.createSpy();

      scope.$on('someEvent', scopeListener);
      child.$on('someEvent', childListener);
      isolatedChild.$on('someEvent', isolatedChildListener);

      scope.$broadcast('someEvent');

      expect(scopeListener).toHaveBeenCalled();
      expect(childListener).toHaveBeenCalled();
      expect(isolatedChildListener).toHaveBeenCalled();
    }); //end it

    it("propagates the same event down on $broadcast", function() {
      var scopeEvent, childEvent;
      var scopeListener = jasmine.createSpy();
      var childListener = jasmine.createSpy();

      scope.$on('someEvent', scopeListener);
      child.$on('someEvent', childListener);

      scope.$broadcast('someEvent');

      scopeEvent = scopeListener.calls.mostRecent().args[0];
      childEvent = childListener.calls.mostRecent().args[0];
      expect(scopeEvent).toBe(childEvent);

    }); //end it

    it("attaches targetScope on $emit", function() {
      var scopeListener = jasmine.createSpy();
      var parentListener = jasmine.createSpy();

      scope.$on('someEvent', scopeListener);
      parent.$on('someEvent', parentListener);

      scope.$emit('someEvent');

      expect(scopeListener.calls.mostRecent().args[0].targetScope).toBe(scope);
      expect(parentListener.calls.mostRecent().args[0].targetScope).toBe(scope);
    }); //end it

    it("attaches targetScope on $broadcast", function() {
      var scopeListener = jasmine.createSpy();
      var parentListener = jasmine.createSpy();

      scope.$on('someEvent', scopeListener);
      child.$on('someEvent', parentListener);

      scope.$broadcast('someEvent');

      expect(scopeListener.calls.mostRecent().args[0].targetScope).toBe(scope);
      expect(parentListener.calls.mostRecent().args[0].targetScope).toBe(scope);
    }); //end it

    it("attaches currentScope on $emit", function() {
      var currentScopeOnScope, currentScopeOnParent;
      var scopeListener = function (event) {
        currentScopeOnScope = event.currentScope;
      };
      var parentListener = function (event) {
        currentScopeOnParent = event.currentScope;
      };

      scope.$on('someEvent', scopeListener);
      parent.$on('someEvent', parentListener);

      scope.$emit('someEvent');

      expect(currentScopeOnScope).toBe(scope);
      expect(currentScopeOnParent).toBe(parent);
    }); //end it

    it("attaches currentScope on $broadcast", function() {
      var currentScopeOnScope, currentScopeOnChild;
      var scopeListener = function (event) {
        currentScopeOnScope = event.currentScope;
      };
      var childListener = function (event) {
        currentScopeOnChild = event.currentScope;
      };

      scope.$on('someEvent', scopeListener);
      child.$on('someEvent', childListener);

      scope.$broadcast('someEvent');

      expect(currentScopeOnScope).toBe(scope);
      expect(currentScopeOnChild).toBe(child);
    }); //end it

    it("sets currentScope to null after propagation on $emit", function() {
      var event;
      var scopeListener = function(evt) {
        event = evt;
      };
      scope.$on('someEvent', scopeListener);

      scope.$emit('someEvent');

      expect(event.currentScope).toBe(null);
    }); //end it

    it("sets currentScope to null after propagation on $broadcast", function() {
      var event;
      var scopeListener = function(evt) {
        event = evt;
      };
      scope.$on('someEvent', scopeListener);

      scope.$broadcast('someEvent');

      expect(event.currentScope).toBe(null);
    }); //end it

    it("does not propagate to parents when stopped", function() {
      var scopeListener = function (event) {
        event.stopPropagation();
      };
      var parentListener = jasmine.createSpy();

      scope.$on('someEvent', scopeListener);
      parent.$on('someEvent', parentListener);

      scope.$emit('someEvent');

      expect(parentListener).not.toHaveBeenCalled();
    }); //end it
    
    it("is received by listeners on current scope after being stopped", function() {
      var scopeListener1 = function (event) {
        event.stopPropagation();
      };
      var scopeListener2 = jasmine.createSpy();
      
      scope.$on('someEvent', scopeListener1);
      scope.$on('someEvent', scopeListener2);
      
      scope.$emit('someEvent');
      
      expect(scopeListener2).toHaveBeenCalled();
    }); //end it
    
    it("fires $destroy when destroyed", function() {
      var listener = jasmine.createSpy();
      scope.$on('$destroy', listener);
      
      scope.$destroy();
      
      expect(listener).toHaveBeenCalled();
    }); //end it
    
    it("fires $destroy on children destroyed", function() {
      var listener = jasmine.createSpy();
      child.$on('$destroy', listener);

      scope.$destroy();

      expect(listener).toHaveBeenCalled();

    }); //end it
    
    it("no longer calls listeners afte destroyed", function() {
      var listener = jasmine.createSpy();
      scope.$on('myEvent', listener);
      
      scope.$destroy();
      
      scope.$emit('myEvent');
      expect(listener).not.toHaveBeenCalled();

    }); //end it

  }); //end describe

}); //end describe "Scope"