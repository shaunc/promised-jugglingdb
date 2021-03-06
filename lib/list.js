'use strict';

var
  util = require('util'),
  utils = require('./utils');

module.exports = List;

/**
 * List class provides functionality of nested collection
 *
 * @param {Array} data - array of items.
 * @param {*} type - array with some type information? TODO: rework this API.
 * @param {AbstractClass} parent - owner of list.
 * @constructor
 */
function List(data, type, parent){
  var list = this;
  if (!(list instanceof List)) {
    return new List(data, type, parent);
  }

  if (data && data instanceof List) {
    data = data.items;
  }

  Object.defineProperty(list, 'parent', {
    writable    : false,
    enumerable  : false,
    configurable: false,
    value       : parent
  });

  Object.defineProperty(list, 'nextid', {
    writable  : true,
    enumerable: false,
    value     : 1
  });

  var Item = ListItem;
  if (typeof type === 'object' && type.constructor.name === 'Array') {
    Item = type[0] || ListItem;
  }

  data = list.items = data || [];
  Object.defineProperty(list, 'ItemType', {
    writable    : true,
    enumerable  : false,
    configurable: true,
    value       : Item
  });

  if ('string' === typeof data) {
    try {
      list.items = data = JSON.parse(data);
    } catch (e) {
      list.items = data = [];
    }
  }

  data.forEach(function (item, i){
    data[i] = new Item(item, list);
    Object.defineProperty(list, data[i].id, {
      writable    : true,
      enumerable  : false,
      configurable: true,
      value       : data[i]
    });
    if (list.nextid <= data[i].id) {
      list.nextid = data[i].id + 1;
    }
  });

  Object.defineProperty(list, 'length', {
    enumerable  : false,
    configurable: true,
    get         : function (){
      return list.items.length;
    }
  });

  return list;

}

List.prototype.inspect = function (){
  return util.inspect(this.items);
};

var _;
try {
  var lodash = 'lodash';
  _ = require(lodash);
} catch (e) {
  _ = false;
}

if (!_) {
  /*istanbul ignore next*/
  try {
    var underscore = 'underscore';
    _ = require(underscore);
  } catch (e) {
    _ = false;
  }
}

  /*istanbul ignore next: can't test properly*/
if (_) {
  var _import = [
    // collection methods
    'each',
    'map',
    'reduce',
    'reduceRight',
    'find',
    'filter',
    'reject',
    'all',
    'any',
    'include',
    'invoke',
    'pluck',
    'max',
    'min',
    'sortBy',
    'groupBy',
    'sortedIndex',
    'shuffle',
    'toArray',
    'size',
    // array methods
    'first',
    'initial',
    'last',
    'rest',
    'compact',
    'flatten',
    'without',
    'union',
    'intersection',
    'difference',
    'uniq',
    'zip',
    'indexOf',
    'lastIndexOf',
    'range'
  ];

  _import.forEach(function (name){
    List.prototype[name] = function (){
      var args = utils.slice.call(arguments);
      args.unshift(this.items);
      return _[name].apply(_, args);
    };
  });
}

// copy all array methods
[   'concat',
  'join',
  'pop',
  'push',
  'reverse',
  'shift',
  'slice',
  'sort',
  'splice',
  'toSource',
  'toString',
  'unshift',
  'every',
  'filter',
  'forEach',
  'indexOf',
  'lastIndexOf',
  'map',
  'some'
].forEach(function (method){
    List.prototype[method] = function (){
      return Array.prototype[method].apply(this.items, utils.slice.call(arguments));
    };
  });

List.prototype.find = function (pattern, field){
  if (!field) {
    field = 'id';
  }
  var res;
  this.items.forEach(function (o){
    if (o[field] == pattern) {
      res = o;
    }
  });
  return res;
};

List.prototype.removeAt = function (index){
  this.splice(index, 1);
};

List.prototype.toObject = function (){
  return this.items;
};

List.prototype.toJSON = function (){
  return this.items;
};

List.prototype.toString = function (){
  return JSON.stringify(this.items);
};

List.prototype.autoincrement = function (){
  return this.nextid++;
};

List.prototype.push = function (obj){
  var item = new ListItem(obj, this);
  this.items.push(item);
  return item;
};

List.prototype.remove = function (obj){
  var id = obj.id ? obj.id : obj;
  var found = false;
  this.items.forEach(function (o, i){
    if (id && o.id == id) {
      found = i;
      /*istanbul ignore next: not testable*/
      if (o.id !== id) {
        console.log('WARNING! Type of id not matched');
      }
    }
  });
  if (found !== false) {
    delete this[id];
    this.items.splice(found, 1);
  }
};

List.prototype.map = function (cb){
  if (typeof cb === 'function') {
    return this.items.map(cb);
  }
  if (typeof cb === 'string') {
    return this.items.map(function (el){
      if (typeof el[cb] === 'function') {
        return el[cb]();
      }
      if (el.hasOwnProperty(cb)) {
        return el[cb];
      }
    });
  }
};

function ListItem(data, parent){
  if (typeof data === 'object') {
    for (var i in data) {
      this[i] = data[i];
    }
  } else {
    this.id = data;
  }
  Object.defineProperty(this, 'parent', {
    writable    : false,
    enumerable  : false,
    configurable: true,
    value       : parent
  });
  if (!this.id) {
    this.id = parent.autoincrement();
  }
  if (parent.ItemType) {
    this.__proto__ = parent.ItemType.prototype;
    /*istanbul ignore next: edge case */
    if (parent.ItemType !== ListItem) {
      parent.ItemType.apply(this);
    }
  }

}
/*istanbul ignore next: edge case */
ListItem.prototype.save = function save(){
  this.parent.parent.save();
};

