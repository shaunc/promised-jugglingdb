'use strict';

var Q = require('bluebird');

exports.safeRequire = safeRequire;
exports.curry = curry;
exports.curryArgs = curryArgs;
exports.Q = Q;
exports.defer = function(){
  return Q.defer();
};

function curry(fn, that) {
  var slice = Array.prototype.slice;

  return function () {
    return fn.apply(that, slice.call(arguments));
  };
}

function curryArgs(fn, that) {
  var slice = Array.prototype.slice,
      args = slice.call(arguments, 2);

  return function () {
    return fn.apply(that, args.concat(slice.call(arguments)));
  };
}

function safeRequire(module){
  try {
    return require(module);
  } catch (e) {
    console.log('Run "npm install jugglingdb ' + module + '" command to use jugglingdb using ' + module + ' database engine');
    process.exit(1);
    return false;
  }
}

