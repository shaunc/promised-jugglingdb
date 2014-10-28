'use strict';

var Q = require('bluebird');

var slice = exports.slice = Array.prototype.slice;

/**
 * Require a jugglingdb adapter
 * @param {String} module
 * @returns {*}
 */
exports.safeRequire = function (module){
  try {
    return require(module);
  } catch (e) {
    console.log('Run "npm install jugglingdb ' + module + '" command to use jugglingdb using ' + module + ' database engine');
    process.exit(1);
    return false;
  }
};

/**
 * Bind the context of a function
 *
 * @param {Function} fn
 * @param {Object} that
 * @returns {Function}
 */
exports.curry = function (fn, that) {
  return function () {
    return fn.apply(that, slice.call(arguments));
  };
};
/**
 * Bind the context of a function with predefined args
 *
 * @param {Function} fn
 * @param {Object} that
 * @returns {Function}
 */
exports.curryArgs = function (fn, that) {
  var args = slice.call(arguments, 2);

  return function () {
    return fn.apply(that, args.concat(slice.call(arguments)));
  };
};

/**
 * @type {Promise}
 */
exports.Q = Q;
/**
 * @returns {Promise.defer}
 */
exports.defer = function(){
  return Q.defer();
};

/**
 * Define readonly property on object
 *
 * @param {Object} obj
 * @param {String} key
 * @param {*} value
 */
exports.defineReadonlyProp = function (obj, key, value){
  Object.defineProperty(obj, key, {
    writable    : false,
    enumerable  : true,
    configurable: false,
    value       : value
  });
};

/**
 * Define hidden property, but overwritable
 *
 * @param {Object} where
 * @param {String} property
 * @param {*} value
 */
exports.hiddenProperty = function (where, property, value){
  Object.defineProperty(where, property, {
    writable    : true,
    enumerable  : false,
    configurable: true,
    value       : value
  });
};


