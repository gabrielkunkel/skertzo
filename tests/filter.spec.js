'use strict';

describe("filter", function() {

  it('can be registered and obtained', function() {
    var myFilter = function() { };
    var myFilterFactory = function() {
      return myFilter;
    };

    register('my', myFilterFactory);
    expect(filter('my')).toBe(myFilter);
  }); // end it

  it('allows registering multiple filters with an object', function() {
    var myFilter = function() { };
    var myOtherFilter = function() { };
    register({
      my: function() {
        return myFilter;
      },
      myOther: function() {
        return myOtherFilter;
      }
    });
    expect(filter('my')).toBe(myFilter);
    expect(filter('myOther')).toBe(myOtherFilter);
  }); // end it

}); // end describe