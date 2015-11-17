'use strict';

var filters = {};

function register(name, factory) {
  var filter = factory();
  filters[name] = filter;
  return filter;
}

function filter(name) {
  return filters[name];
}