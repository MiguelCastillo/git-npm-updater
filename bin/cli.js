#!/usr/bin/env node

var subarg = require("subarg");
var argv = subarg(process.argv.slice(2));
var directories = argv._;

if (argv.directories) {
  if (Array.isArray(argv.directories)) {
    directories = directories.concat(argv.directories);
  }
  else {
    directories.push(argv.directories);
  }

}

if (!directories.length) {
  directories = [process.cwd()];
}

delete argv.directories;
delete argv._;


require("../index")(directories, argv)
  .then(function() {
    console.log("Success!");
  }, function(error) {
    if (error && error.stack) {
      error = error.stack;
    }

    console.error(error);
  });
