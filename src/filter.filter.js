'use strict';

function createPredicateFn(expression, comparator) {
  var shouldMatchPrimitives = _.isObject(expression) && '$' in expression;

  if (comparator === true) { // not equal to truthy. This HAS to be a boolean.
    comparator = _.isEqual;
  }

  else if (!_.isFunction(comparator)) {
    comparator = function comparator(actual, expected) {
      if (actual === undefined) { // lodash isUndefined just does this
        return false;
      }
      if (actual === null || expected === null) { // lodash isNull just does this
        return actual === expected;
      }
      actual = ('' + actual).toLowerCase(); // coerce numbers or booleans into strings
      expected = ('' + expected).toLowerCase(); // coerce numbers or booleans into strings
      return actual.indexOf(expected) !== -1;
    };
  }

  return function predicateFn(item) {
    if (shouldMatchPrimitives && !_.isObject(item)) {
      return deepCompare(item, expression.$, comparator);
    }
    return deepCompare(item, expression, comparator, true);
  };
}

function deepCompare(actual, expected, comparator, matchAnyProperty, inWildCard) {
  if (_.isString(expected) && _.startsWith(expected, '!')) {
    return !deepCompare(actual, expected.substring(1), comparator, matchAnyProperty);
  }
  if (_.isArray(actual)) {
    return _.any(actual, function (actualItem) {
      return deepCompare(actualItem, expected, comparator, matchAnyProperty);
    });
  }
  if (_.isObject(actual)) {
    if (_.isObject(expected) && !inWildCard) {
      return _.every(
        _.toPlainObject(expected),
        function (expectedVal, expectedKey) {
          if (_.isUndefined(expectedVal)) {
            return true;
          }
          var isWildcard = expectedKey === '$';
          var actualVal = isWildcard ? actual : actual[expectedKey];
          return deepCompare(actualVal, expectedVal, comparator, isWildcard, isWildcard);
        }
      );
    }
    else if(matchAnyProperty) {
      // _.any is an alias of _.some
      // really just uses 'arraySome' or 'baseSome'
      return _.any(actual, function (value) {
        return deepCompare(value, expected, comparator, matchAnyProperty);
      });
    }
    else {
      return comparator(actual, expected);
    }
  }
  else {
    return comparator(actual, expected);
  }
}

function filterFilter() {
  return function (array, filterExpr, comparator) {
    var predicateFn;
    if (_.isFunction(filterExpr)) {
      predicateFn = filterExpr;
    }
    else if (_.isString(filterExpr) || _.isNumber(filterExpr) || _.isBoolean(filterExpr) ||
      _.isNull(filterExpr) || _.isObject(filterExpr)) {
      predicateFn = createPredicateFn(filterExpr, comparator);
    }
    else {
      return array;
    }

    return _.filter(array, predicateFn);
  };
}
