#!/usr/bin/env node

var directories = process.argv.slice(2);

if (!directories.length) {
  directories = [process.cwd()];
}

require("../index")(directories)
  .then(function() {
    console.log("Success!");
  }, function(error) {
    if (error && error.stack) {
      error = error.stack;
    }

    console.error(error);
  });
