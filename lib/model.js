'use strict';

/**
 * Module exports class Model
 */
module.exports = AbstractClass;

/**
 * Module dependencies
 */
var
  util = require('util'),
  utils = require('./utils'),
  curry = utils.curry,
  validations = require('./validations.js'),
  ValidationError = validations.ValidationError,
  List = require('./list.js');

require('./hooks.js');
require('./relations.js');
require('./include.js');

var BASE_TYPES = ['String', 'Boolean', 'Number', 'Date', 'Text'];

/**
 * Model class - base class for all persist objects
 * provides **common API** to access any database adapter.
 * This class describes only abstract behavior layer, refer to `lib/adapters/*.js`
 * to learn more about specific adapter implementations
 *
 * `AbstractClass` mixes `Validatable` and `Hookable` classes methods
 *
 * @constructor
 * @param {Object} data - initial object data
 */
function AbstractClass(data){
  this._initProperties(data, true);
}

AbstractClass.prototype._initProperties = function (data, applySetters){
  var self = this;
  var ctor = this.constructor;
  var ds = ctor.schema.definitions[ctor.modelName];
  var properties = ds.properties;
  data = data || {};

  utils.hiddenProperty(this, '__cachedRelations', {});
  utils.hiddenProperty(this, '__data', {});
  utils.hiddenProperty(this, '__dataWas', {});

  if (data['__cachedRelations']) {
    this.__cachedRelations = data['__cachedRelations'];
  }

  for (var i in data) {
    if (i in properties) {
      this.__data[i] = this.__dataWas[i] = data[i];
    } else if (i in ctor.relations) {
      this.__data[ctor.relations[i].keyFrom] = this.__dataWas[i] = data[i][ctor.relations[i].keyTo];
      this.__cachedRelations[i] = data[i];
    }
  }

  if (applySetters === true) {
    Object.keys(data).forEach(function (attr){
      self[attr] = data[attr];
    });
  }

  ctor.forEachProperty(function (attr){

    if ('undefined' === typeof self.__data[attr]) {
      self.__data[attr] = self.__dataWas[attr] = getDefault(attr);
    } else {
      self.__dataWas[attr] = self.__data[attr];
    }

  });

  ctor.forEachProperty(function (attr){

    var type = properties[attr].type;

    if (BASE_TYPES.indexOf(type.name) === -1) {
      if (typeof self.__data[attr] !== 'object' && self.__data[attr]) {
        try {
          self.__data[attr] = JSON.parse(self.__data[attr] + '');
        } catch (e) {
          self.__data[attr] = String(self.__data[attr]);
        }
      }
      if (type.name === 'Array' || typeof type === 'object' && type.constructor.name === 'Array') {
        self.__data[attr] = new List(self.__data[attr], type, self);
      }
    }

  });

  function getDefault(attr){
    var def = properties[attr]['default'];
    if (isdef(def)) {
      if (typeof def === 'function') {
        return def();
      } else {
        return def;
      }
    } else {
      return undefined;
    }
  }

  this.trigger('initialize');
};

/**
 * @param {String} prop - property name
 * @param {Object} params - various property configuration
 */
AbstractClass.defineProperty = function (prop, params){
  this.schema.defineProperty(this.modelName, prop, params);
};

AbstractClass.whatTypeName = function (propName){
  var prop = this.schema.definitions[this.modelName].properties[propName];
  if (!prop || !prop.type) {
    return null;
    // throw new Error('Undefined type for ' + this.modelName + ':' + propName);
  }
  return prop.type.name;
};

/**
 * Updates the respective record
 *
 * @param {Object} params - { where:{uid:'10'}, update:{ Name:'New name' } }
 * @returns {Promise.promise}
 */
AbstractClass.update = function update(params){
  var Model = this;

  return stillConnecting(Model.schema).then(function(){
    var d = utils.defer();

    if (params && params.update) {
      params.update = Model._forDB(params.update);
    }

    Model.schema.adapter.update(Model.modelName, params, function (err, obj){
      if (err) {
        d.reject(err);
      } else {
        d.resolve(Model._fromDB(obj));
      }
    });

    return d.promise;
  });
};

/**
 * Prepares data for storage adapter.
 *
 * Ensures data is allowed by the schema, and stringifies JSON field types.
 * If the schema defines a custom field name, it is transformed here.
 *
 * @param {Object} data
 * @return {Object} Returns data for storage.
 */
AbstractClass._forDB = function (data){
  if (!data) {
    return null;
  }
  var
    res = {},
    Model = this,
    definition = this.schema.definitions[Model.modelName].properties;

  Object.keys(data).forEach(function (propName){
    var val;
    var typeName = Model.whatTypeName(propName);
    if (!typeName && !data[propName] instanceof Array) {
      return;
    }
    val = data[propName];
    if (definition[propName] && definition[propName].name) {
      // Use different name for DB field/column
      res[definition[propName].name] = val;
    } else {
      res[propName] = val;
    }
  });

  return res;
};

/**
 * Unpacks data from storage adapter.
 *
 * If the schema defines a custom field name, it is transformed here.
 *
 * @param {Object} data
 * @return {Object}
 */
AbstractClass._fromDB = function (data){
  if (!data) {
    return null;
  }

  var
    definition = this.schema.definitions[this.modelName].properties,
    propNames = Object.keys(data);

  Object.keys(definition).forEach(function (defPropName){
    var customName = definition[defPropName].name;
    if (customName && propNames.indexOf(customName) !== -1) {
      data[defPropName] = data[customName];
      delete data[customName];
    }
  });

  return data;
};

AbstractClass.prototype.whatTypeName = function (propName){
  return this.constructor.whatTypeName(propName);
};

/**
 * Create new instance of Model class, saved in database
 *
 * @param data [optional]
 * @returns {PromiseResolver.promise}
 */
AbstractClass.create = function create(data){
  var
    Model = this;

  return stillConnecting(Model.schema).then(function(){
    var
      d = utils.defer(),
      modelName = Model.modelName;

    data = data || {};

    // Passed via data from save
    var options = data.options || { validate: true };

    if (data.data instanceof Model) {
      data = data.data;
    }

    if (data instanceof Array) {
      var instances = [],
        length = data.length,
        errors,
        gotError = false,
        wait = length;

      if (length === 0) {
        d.resolve([]);
      } else {
        errors = new Array(length);

        var modelCreated = function (){
          if (--wait === 0) {
            if (gotError) {
              d.reject(errors);
            } else {
              d.resolve(instances);
            }
          }
        };

        var createModel = function (d, i){
          Model.create(d).fail(function (err){
            if (err) {
              errors[i] = err;
              gotError = true;
            }
          }).done(function(inst){
            instances.push(inst);
            modelCreated();
          });
        };

        for (var i = 0; i < length; i += 1) {
          createModel(data[i], i);
        }
      }
    } else {
      var
        obj,
        reject = curry(d.reject, d),
        innerCreate = function (){
          obj.trigger('create', function (createDone){
            obj.trigger('save', function (saveDone){

              this._adapter().create(modelName, this.constructor._forDB(obj.toObject(true)), function (err, id, rev){
                if (id) {
                  obj.__data.id = id;
                  obj.__dataWas.id = id;
                  utils.defineReadonlyProp(obj, 'id', id);
                }
                if (rev) {
                  rev = Model._fromDB(rev);
                  obj._rev = rev;
                }
                if (err) {
                  d.reject(err);
                } else {
                  saveDone.call(obj, function (){
                    createDone.call(obj, function (){
                      d.resolve(obj);
                    });
                  });
                }
              }, obj);
            }, obj, reject);
          }, obj, reject);
        };

      // if we come from save
      if (data instanceof Model && !data.id) {
        obj = data;
      } else {
        obj = new Model(data);
      }
      data = obj.toObject(true);

      if (!options.validate) {
        innerCreate();
      } else {
        // validation required
        obj.isValid(data).done(
          innerCreate,
          function(){
            d.reject(new ValidationError(obj));
          }
        );
      }
    }

    return d.promise;
  });
};

/**
 *
 * @param schema
 *
 * @returns {PromiseResolver.promise}
 */
function stillConnecting(schema){
  var d = utils.defer();

  if (schema.connected) {
    d.resolve();
  } else {
    schema.once('connected', d.resolve);

    if (!schema.connecting) {
      schema.connect();
    }
  }

  return d.promise;
}

/**
 * Update or insert
 */
AbstractClass.upsert = AbstractClass.updateOrCreate = function upsert(data){
  var Model = this;

  return stillConnecting(Model.schema).then(function(){
    if (!data.id) {
      return Model.create(data);
    }

    var
      d = utils.defer(),
      resolve = curry(d.resolve, d),
      reject = curry(d.reject, d);

    if (typeof Model.schema.adapter.updateOrCreate === 'function') {
      var inst = new Model(data);

      Model.schema.adapter.updateOrCreate(Model.modelName, Model._forDB(inst.toObject(true)), function (err, data){
        var obj;

        if (data) {
          data = inst.constructor._fromDB(data);
          inst._initProperties(data);
          obj = inst;
        } else {
          obj = null;
        }

        if (err) {
          d.reject(err);
        } else {
          d.resolve(obj);
        }
      });
    } else {
      Model.find(data.id).done(function (inst){
        if (inst) {
          inst.updateAttributes(data).done(resolve, reject);
        } else {
          var obj = new Model(data);
          obj.save(data).done(resolve, reject);
        }
      }, reject);
    }

    return d.promise;
  });

};

/**
 * Find one record, same as `all`, limited by 1 and return object, not collection,
 * if not found, create using data provided as second argument
 *
 * @param {Object} query - search conditions: {where: {test: 'me'}}.
 * @param {Object|Function} data - object to create.
 * @returns {PromiseResolver.promise}
 */
AbstractClass.findOrCreate = function findOrCreate(query, data){
  if (typeof query === 'undefined') {
    query = {where: {}};
  }

  if (typeof data === 'function' || typeof data === 'undefined') {
    data = query && query.where;
  }

  var Model = this;

  return Model.findOne(query).then(function (record){
    if (record) {
      return record;
    }
    return Model.create(data);
  });
};

/**
 * Check whether object exitst in database
 *
 * @param {id} id - identifier of object (primary key value)
 */
AbstractClass.exists = function exists(id){
  var Model = this;

  return stillConnecting(Model.schema).then(function(){
    var d = utils.defer();

    if (id) {
      this.schema.adapter.exists(Model.modelName, id, d.callback);
    } else {
      d.reject(new Error('Model::exists requires positive id argument'));
    }

    return d.promise;
  });
};

/**
 * Find object by id
 *
 * @param {id} id - primary key value
 */
AbstractClass.find = function find(id){
  var Model = this;

  return stillConnecting(Model.schema).then(function(){
    var d = utils.defer();

    Model.schema.adapter.find(Model.modelName, id, function (err, data){
      var obj = null;

      if (data) {
        data = Model._fromDB(data);
        if (!data.id) {
          data.id = id;
        }
        obj = new Model();
        obj._initProperties(data, false);
      }

      if (err) {
        d.reject(err);
      } else {
        d.resolve(obj);
      }
    });

    return d.promise;
  });
};

/**
 * Find all instances of Model, matched by query
 * make sure you have marked as `index: true` fields for filter or sort
 *
 * @param {Object} params (optional)
 *
 * - where: Object `{ key: val, key2: {gt: 'val2'}}`
 * - include: String, Object or Array. See AbstractClass.include documentation.
 * - order: String
 * - limit: Number
 * - skip: Number
 *
 * @returns {Promise}
 */
AbstractClass.all = function all(params){
  var Model = this;

  return stillConnecting(Model.schema).then(function(){
    var d = utils.defer();

    if (params) {
      if ('skip' in params) {
        params.offset = params.skip;
      } else if ('offset' in params) {
        params.skip = params.offset;
      }
    }

    if (params && params.where) {
      params.where = Model._forDB(params.where);
    }

    Model.schema.adapter.all(Model.modelName, params, function (err, data){
      if (data && data.forEach) {

        if (!params || !params.onlyKeys) {

          data.forEach(function (d, i){
            var obj = new Model();
            d = Model._fromDB(d);
            obj._initProperties(d, false);
            if (params && params.include && params.collect) {
              data[i] = obj.__cachedRelations[params.collect];
            } else {
              data[i] = obj;
            }
          });
        }
        if (err) {
          d.reject(err);
        } else {
          d.resolve(data);
        }
      } else {
        if (err) {
          d.reject(err);
        } else {
          d.resolve([]);
        }
      }
    });

    return d.promise;
  });
};

/**
 * Iterate through dataset and perform async method iterator. This method
 * designed to work with large datasets loading data by batches.
 *
 * @param {Object|Function} filter - query conditions. Same as for `all` may contain
 * optional member `batchSize` to specify size of batch loaded from db. Optional.
 * @param {Function} iterator - method(obj, next) called on each obj.
 */
AbstractClass.iterate = function map(filter, iterator){
  var
    Model = this,
    d = utils.defer();

  if ('function' === typeof filter) {
    iterator = filter;
    filter = {};
  }

  function done(err){
    if (err) {
      d.reject(err);
    } else {
      d.resolve();
    }
  }

  var concurrent = filter.concurrent;
  delete filter.concurrent;
  var limit = filter.limit;
  var batchSize = filter.limit = filter.batchSize || 1000;
  var batchNumber = -1;

  nextBatch();

  function nextBatch(){
    batchNumber += 1;
    filter.skip = filter.offset = batchNumber * batchSize;

    if (limit < batchSize) {
      filter.limit = Math.abs(limit);
    }

    if (filter.limit <= 0) {
      done();
      return;
    }

    Model.all(filter).done(function (collection){
      if (collection.length === 0 || limit <= 0) {
        done();
        return;
      }

      var nextItem = function (err){
        if (err) {
          done(err);
          return;
        }

        if (++i >= collection.length) {
          nextBatch();
          return;
        }

        iterator(collection[i], nextItem, filter.offset + i);
      };

      limit -= collection.length;
      var i = -1;
      if (concurrent) {
        var wait = collection.length, _next;

        _next = function (){
          if (--wait === 0) {
            nextBatch();
          }
        };

        collection.forEach(function (obj, i){
          iterator(obj, _next, filter.offset + i);
        });
      } else {
        nextItem();
      }
    }, d.reject);
  }

  return d.promise;
};

/**
 * Find one record, same as `all`, limited by 1 and return object, not collection
 *
 * @param {Object} params - search conditions: {where: {test: 'me'}}
 * @param {Function} cb - callback called with (err, instance)
 */
AbstractClass.findOne = function findOne(params, cb){
  if (stillConnecting(this.schema, this, arguments, findOne)) {
    return;
  }

  if (typeof params === 'function') {
    cb = params;
    params = {};
  }
  params.limit = 1;
  this.all(params, function (err, collection){
    if (err || !collection || collection.length === 0) {
      return cb(err, null);
    }
    cb(err, collection[0]);
  });
};

/**
 * Destroy all records
 * @param {Function} cb - callback called with (err)
 */
AbstractClass.destroyAll = function destroyAll(cb){
  if (stillConnecting(this.schema, this, arguments, destroyAll)) {
    return;
  }

  this.schema.adapter.destroyAll(this.modelName, curry(function (err){
    if ('function' === typeof cb) {
      cb(err);
    }
  }, this));
};

/**
 * Return count of matched records
 *
 * @param {Object} where - search conditions (optional)
 * @param {Function} cb - callback, called with (err, count)
 */
AbstractClass.count = function count(where, cb){
  if (stillConnecting(this.schema, this, arguments, count)) {
    return;
  }

  if (typeof where === 'function') {
    cb = where;
    where = null;
  }
  this.schema.adapter.count(this.modelName, cb, this._forDB(where));
};

/**
 * Return string representation of class
 *
 * @override default toString method
 */
AbstractClass.toString = function (){
  return '[Model ' + this.modelName + ']';
};

/**
 * Save instance. When instance haven't id, create method called instead.
 * Triggers: validate, save, update | create
 * @param {Object} [options] {validate: true, throws: false}
 * @param {Function} callback
 */
AbstractClass.prototype.save = function save(options, callback){
  if (stillConnecting(this.constructor.schema, this, arguments, save)) {
    return;
  }

  if (typeof options == 'function') {
    callback = options;
    options = {};
  }

  callback = callback || function (){};
  options = options || {};

  if (!('validate' in options)) {
    options.validate = true;
  }
  if (!('throws' in options)) {
    options.throws = false;
  }

  var inst = this;
  var data = inst.toObject(true);
  var Model = this.constructor;
  var modelName = Model.modelName;

  if (!this.id) {
    // Pass options and this to create
    data = {
      data   : this,
      options: options
    };
    return Model.create(data, callback);
  }

  // validate first
  if (!options.validate) {
    return innerSave();
  }

  inst.isValid(function (valid){
    if (valid) {
      innerSave();
    } else {
      var err = new ValidationError(inst);
      // throws option is dangerous for async usage
      if (options.throws) {
        throw err;
      }
      callback(err, inst);
    }
  }, data);

  // then save
  function innerSave(){
    inst.trigger('save', function (saveDone){
      inst.trigger('update', function (updateDone){
        inst._adapter().save(modelName, inst.constructor._forDB(data), function (err){
          if (err) {
            return callback(err, inst);
          }
          inst._initProperties(data, false);
          updateDone.call(inst, function (){
            saveDone.call(inst, function (){
              callback(err, inst);
            });
          });
        });
      }, data, callback);
    }, data, callback);
  }
};

AbstractClass.prototype.isNewRecord = function (){
  return !this.id;
};

/**
 * Return adapter of current record
 * @private
 */
AbstractClass.prototype._adapter = function (){
  return this.schema.adapter;
};

/**
 * Convert instance to Object
 *
 * @param {Boolean} onlySchema - restrict properties to schema only, default false
 * when onlySchema == true, only properties defined in schema returned,
 * otherwise all enumerable properties returned
 * @param {Boolean} cachedRelations
 * @returns {Object} - canonical object representation (no getters and setters)
 */
AbstractClass.prototype.toObject = function (onlySchema, cachedRelations){
  var data = {};
  var ds = this.constructor.schema.definitions[this.constructor.modelName];
  var properties = ds.properties;
  var self = this;

  this.constructor.forEachProperty(function (attr){
    if (self[attr] instanceof List) {
      data[attr] = self[attr].toObject();
    } else if (self.__data.hasOwnProperty(attr)) {
      data[attr] = self[attr];
    } else {
      data[attr] = null;
    }
  });

  if (!onlySchema) {
    Object.keys(self).forEach(function (attr){
      if (!data.hasOwnProperty(attr)) {
        data[attr] = self[attr];
      }
    });

    if (cachedRelations === true && this.__cachedRelations) {
      var relations = this.__cachedRelations;
      Object.keys(relations).forEach(function (attr){
        if (!data.hasOwnProperty(attr)) {
          data[attr] = relations[attr];
        }
      });
    }
  }

  return data;
};

// AbstractClass.prototype.hasOwnProperty = function (prop) {
//     return this.__data && this.__data.hasOwnProperty(prop) ||
//         Object.getOwnPropertyNames(this).indexOf(prop) !== -1;
// };

AbstractClass.prototype.toJSON = function (cachedRelations){
  return this.toObject(false, cachedRelations);
};

/**
 * Delete object from persistence
 *
 * @triggers `destroy` hook (async) before and after destroying object
 */
AbstractClass.prototype.destroy = function destroy(cb){
  if (stillConnecting(this.constructor.schema, this, arguments, destroy)) {
    return;
  }

  this.trigger('destroy', function (destroyed){
    this._adapter().destroy(this.constructor.modelName, this.id, curry(function (err){
      if (err) {
        return cb(err);
      }

      destroyed(function (){
        if (cb) {
          cb();
        }
      });
    }, this));
  }, this.toObject(), cb);
};

/**
 * Update single attribute
 *
 * equals to `updateAttributes({name: value}, cb)
 *
 * @param {String} name - name of property
 * @param {*} value - value of property
 * @param {Function} callback - callback called with (err, instance)
 */
AbstractClass.prototype.updateAttribute = function updateAttribute(name, value, callback){
  var data = {};
  data[name] = value;
  this.updateAttributes(data, callback);
};

/**
 * Update set of attributes
 *
 * this method performs validation before updating
 *
 * @trigger `validation`, `save` and `update` hooks
 * @param {Object} data - data to update
 * @param {Function} cb - callback called with (err, instance)
 */
AbstractClass.prototype.updateAttributes = function updateAttributes(data, cb){
  if (stillConnecting(this.constructor.schema, this, arguments, updateAttributes)) {
    return;
  }

  var inst = this;
  var modelName = this.constructor.modelName;

  if (typeof data === 'function') {
    cb = data;
    data = null;
  }

  if (!data) {
    data = {};
  }

  // update instance's properties
  Object.keys(data).forEach(function (key){
    inst[key] = data[key];
  });

  inst.isValid(function (valid){
    if (!valid) {
      if (cb) {
        cb(new ValidationError(inst), inst);
      }
    } else {
      inst.trigger('save', function (saveDone){
        inst.trigger('update', function (done){

          Object.keys(data).forEach(function (key){
            inst[key] = data[key];
          });

          inst._adapter().updateAttributes(modelName, inst.id, inst.constructor._forDB(inst.toObject(true)), function (err){
            if (!err) {
              // update _was attrs
              Object.keys(data).forEach(function (key){
                inst.__dataWas[key] = inst.__data[key];
              });
            }
            done.call(inst, function (){
              saveDone.call(inst, function (){
                if (cb) {
                  cb(err, inst);
                }
              });
            });
          });
        }, data, cb);
      }, data, cb);
    }
  }, data);
};

AbstractClass.prototype.fromObject = function (obj){
  Object.keys(obj).forEach(curry(function (key){
    this[key] = obj[key];
  }, this));
};

/**
 * Checks is property changed based on current property and initial value
 *
 * @param {String} attr - property name
 * @return Boolean
 */
AbstractClass.prototype.propertyChanged = function propertyChanged(attr){
  return this.__data[attr] !== this.__dataWas[attr];
};

/**
 * Reload object from persistence
 *
 * @requires `id` member of `object` to be able to call `find`
 * @param {Function} callback - called with (err, instance) arguments
 */
AbstractClass.prototype.reload = function reload(callback){
  if (stillConnecting(this.constructor.schema, this, arguments, reload)) {
    return;
  }

  this.constructor.find(this.id, callback);
};

/**
 * Reset dirty attributes
 *
 * this method does not perform any database operation it just reset object to it's
 * initial state
 */
AbstractClass.prototype.reset = function (){
  var obj = this;
  Object.keys(obj).forEach(function (k){
    if (k !== 'id' && !obj.constructor.schema.definitions[obj.constructor.modelName].properties[k]) {
      delete obj[k];
    }
    if (obj.propertyChanged(k)) {
      obj[k] = obj[k + '_was'];
    }
  });
};

AbstractClass.prototype.inspect = function (){
  return util.inspect(this.__data, false, 4, true);
};

/**
 * Check whether `s` is not undefined
 * @param {*} s
 * @return {Boolean} s is undefined
 */
function isdef(s){
  var undef;
  return s !== undef;
}
