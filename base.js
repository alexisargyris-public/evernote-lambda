var vm = require('vm');
var fs = require('fs');
var path = require('path');

var evernote = {
  console: console,
  require: require,
  Buffer: Buffer,
  ArrayBuffer: ArrayBuffer,
  DataView: DataView,
  Uint8Array: Uint8Array,
  Int8Array: Int8Array,
};

var filenames = [
  './thrift.js',
  './thrift-binary.js',
  './Types_types.js',
  './Limits_types.js',
  './Errors_types.js',
  './NoteStore_types.js',
  './UserStore_types.js',
  './UserStore.js',
  './NoteStore.js'
];

for (var i = 0; i < filenames.length; i++) {
  var filename = path.resolve(path.dirname(module.filename), filenames[i]);
  var filedata = fs.readFileSync(filename);
  vm.runInNewContext(filedata, evernote);
}

evernote.Thrift.NodeBinaryHttpTransport = require(
  './thrift-node-binary.js'
).NodeBinaryHttpTransport;

exports.Evernote = evernote;
