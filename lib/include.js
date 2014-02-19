'use strict';

/**
 * Include mixin for ./model.js
 */
var AbstractClass = require('./model.js');

/**
 * Allows you to load relations of several objects and optimize numbers of requests.
 *
 * @param {Array} objects - array of instances
 * @param {String|Object|Array} include - which relations you want to load.
 * @param {Function} cb - Callback called when relations are loaded
 *
 * Examples:
 *
 * - User.include(users, 'posts', function() {}); will load all users posts with only one additional request.
 * - User.include(users, ['posts'], function() {}); // same
 * - User.include(users, ['posts', 'passports'], function() {}); // will load all users posts and passports with two
 *     additional requests.
 * - Passport.include(passports, {owner: 'posts'}, function() {}); // will load all passports owner (users), and all
 *     posts of each owner loaded
 * - Passport.include(passports, {owner: ['posts', 'passports']}); // ...
 * - Passport.include(passports, {owner: [{posts: 'images'}, 'passports']}); // ...
 *
 */
AbstractClass.include = function (objects, include, cb){
  var self = this;

  if (
    (include.constructor.name == 'Array' && include.length === 0) ||
      (include.constructor.name == 'Object' && Object.keys(include).length === 0)
    ) {
    cb(null, objects);
    return;
  }

  include = processIncludeJoin(include);

  var keyVals = {};
  var objsByKeys = {};

  var nbCallbacks = 0;

  function cbed(){
    nbCallbacks--;
    if (nbCallbacks === 0) {
      cb(null, objects);
    }
  }

  for (var i = 0; i < include.length; i++) {
    var callback = processIncludeItem(objects, include[i], keyVals, objsByKeys);
    if (callback !== null) {
      nbCallbacks++;
      callback(cbed);
    } else {
      cb(null, objects);
    }
  }

  function processIncludeJoin(ij){
    if (typeof ij === 'string') {
      ij = [ij];
    }
    if (ij.constructor.name === 'Object') {
      var newIj = [];
      for (var key in ij) {
        var obj = {};
        obj[key] = ij[key];
        newIj.push(obj);
      }
      return newIj;
    }
    return ij;
  }

  function processIncludeItem(objs, include, keyVals, objsByKeys){
    var relations = self.relations, relationName, subInclude;

    if (include.constructor.name === 'Object') {
      relationName = Object.keys(include)[0];
      subInclude = include[relationName];
    } else {
      relationName = include;
      subInclude = [];
    }
    var relation = relations[relationName];

    if (!relation) {
      return function (){
        cb(new Error('Relation "' + relationName + '" is not defined for ' + self.modelName + ' model'));
      };
    }

    var req = {'where': {}};

    if (!keyVals[relation.keyFrom]) {
      objsByKeys[relation.keyFrom] = {};
      objs.filter(Boolean).forEach(function (obj){
        if (!objsByKeys[relation.keyFrom][obj[relation.keyFrom]]) {
          objsByKeys[relation.keyFrom][obj[relation.keyFrom]] = [];
        }
        objsByKeys[relation.keyFrom][obj[relation.keyFrom]].push(obj);
      });
      keyVals[relation.keyFrom] = Object.keys(objsByKeys[relation.keyFrom]);
    }

    if (keyVals[relation.keyFrom].length > 0) {
      // deep clone is necessary since inq seems to change the processed array
      var keysToBeProcessed = {};
      var inValues = [];
      for (var j = 0; j < keyVals[relation.keyFrom].length; j++) {
        keysToBeProcessed[keyVals[relation.keyFrom][j]] = true;
        if (keyVals[relation.keyFrom][j] !== 'null' && keyVals[relation.keyFrom][j] !== 'undefined') {
          inValues.push(keyVals[relation.keyFrom][j]);
        }
      }

      req['where'][relation.keyTo] = {inq: inValues};
      req['include'] = subInclude;

      return function (cb){
        var objectsFrom, j;
        relation.modelTo.all(req, function (err, objsIncluded){
          for (var i = 0; i < objsIncluded.length; i++) {
            delete keysToBeProcessed[objsIncluded[i][relation.keyTo]];
            objectsFrom = objsByKeys[relation.keyFrom][objsIncluded[i][relation.keyTo]];
            for (j = 0; j < objectsFrom.length; j++) {
              if (!objectsFrom[j].__cachedRelations) {
                objectsFrom[j].__cachedRelations = {};
              }
              if (relation.multiple) {
                if (!objectsFrom[j].__cachedRelations[relationName]) {
                  objectsFrom[j].__cachedRelations[relationName] = [];
                }
                objectsFrom[j].__cachedRelations[relationName].push(objsIncluded[i]);
              } else {
                objectsFrom[j].__cachedRelations[relationName] = objsIncluded[i];
              }
            }
          }

          // No relation have been found for these keys
          for (var key in keysToBeProcessed) {
            objectsFrom = objsByKeys[relation.keyFrom][key];
            for (j = 0; j < objectsFrom.length; j++) {
              if (!objectsFrom[j].__cachedRelations) {
                objectsFrom[j].__cachedRelations = {};
              }
              objectsFrom[j].__cachedRelations[relationName] = relation.multiple ? [] : null;
            }
          }
          cb(err, objsIncluded);
        });
      };
    }

    return null;
  }
};