'use strict';

var filters = {};

function register(name, factory) {
  var filter;

  if (_.isObject(name)) {

    /**
     * _.map like _.forEach is distinct from JavaScript in that it will iterate
     * over a collection which could not only be arrays, but also objects or strings.
     * Properties/Methods are not considered objects and so will fall into else.
     */
    //
    return _.map(name, function (factory, name) {
      return register(name, factory);
    });
  }

  /**
   * this is what really does the work, adding each of the filters to the filter object.
   */
  else {
    filter = factory();
    filters[name] = filter;
    return filter;
  }
}

function filter(name) {
  return filters[name];
}

register('filter', filterFilter);