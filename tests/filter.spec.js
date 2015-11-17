'use strict';

describe("filter", function() {

  it('can be registered and obtained', function() {
    var myFilter = function() { };
    var myFilterFactory = function() {
      return myFilter;
    };

    register('my', myFilterFactory);
    expect(filter('my')).toBe(myFilter);
  });
});