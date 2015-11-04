/* global _ */

'use strict';

_.mixin({
  // we're just checking if it is an object and if it has a length to determine if it is array-like
  isArrayLike: function (obj) {
    var length;

    if (_.isNull(obj) || _.isUndefined(obj)) {
      return false;
    }
    length = obj.length;
    return length === 0 ||
        // Why does checking length - 1 work? TODO: Figure out why this helps us check out if it is an array-like object vs. just an object.
      _.isNumber(length) && length > 0 && length - 1 in obj;
  }
});