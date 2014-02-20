/* jshint undef: true, unused: true */
/* exported it */
/* exported describe */
/* exported getSchema */
/* exported expect */
/* exported sinon */
/* exported before */
/* exported beforeEach */
/* exported after */
/* exported afterEach */

global.expect = require('expect.js');
global.sinon = require('sinon');

var Schema = require('../').Schema;

if (!('getSchema' in global)) {
  global.getSchema = function (){
    return new Schema('memory');
  };
}

//var profiler = require('profiler');
//profiler.resume();
