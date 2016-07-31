var spawn = require("child_process").spawn;
var fs = require("fs");
var path = require("path");
var jsonFormat = require("json-format");

var jsonFormatConfig = {
  type: "space",
  size: 2
};


function resolveDirectory(directory) {
  directory = path.resolve(directory);

  return {
    directory: directory,
    file: directory + "/package.json",
    branchName: "npm-dependencies-update",
    commitMessage: "Updating npm dependencies",
    remote: "origin"
  };
}


function readNpmUpdates(context) {
  return execCommand("npm", ["outdated", "-l", "--json"], { cwd: context.directory, env: process.env }, "utf8")
    .then(function(updates) {
        context.updates = JSON.parse(updates);
        return context;
    }, function(code) {
      console.error("Unable to execute `npm outdated` on " + directory + ". Process exited with code:", code);
    });
}


function updateNpmPackage(context) {
  var file = context.file;
  var updates = context.updates;
  var packageFile = fs.readFileSync(file, { encoding: "utf8" });
  packageFile = JSON.parse(packageFile);

  Object
    .keys(updates)
    .filter(function(dependency) {
      var update = updates[dependency];
      return update.current !== update.latest;
    })
    .forEach(function(dependency) {
      var update = updates[dependency];
      var version = packageFile[update.type][dependency];

      if (version) {
        packageFile[update.type][dependency] = version.replace(/([^\d]*).*/, "$1" + update.wanted);
      }
    });

  context.updates = packageFile;
  return context;
}


function writeNpmPackage(context) {
  var configContent = jsonFormat(context.updates, jsonFormatConfig);
  fs.writeFileSync(context.file, configContent);
  return context;
}


function checkGitStatus(context) {
  console.log("Checking repository for pending changes to be staged and commited in", context.directory);

  return execCommand("git", ["status", "--porcelain"], { cwd: context.directory, env: process.env })
    .then(function(status) {
      if (status) {
        throw new Error("There are pending changes in '" + context.directory + "'. Please stash your changes first. " + status);
      }

      return context;
    }, function(err) {
      console.error("Unable to execute git status on " + context.directory);
      throw new Error(err);
    });
}


function createBranch(context) {
  console.log("Creating branch in", context.directory);

  return execCommand("git", ["checkout", "-b", context.branchName], { cwd: context.directory, env: process.env })
    .then(function(status) {
      if (!status) {
        throw new Error("Unable to create branch. " + status);
      }

      console.log(status);
      return context;
    }, function(err) {
      console.error("Unable to execute git checkout -b on " + context.directory);
      throw new Error(err);
    });
}


function addFiles(context) {
  console.log("Staging updated files in", context.directory);

  return execCommand("git", ["add", context.file], { cwd: context.directory, env: process.env })
    .then(function(status) {
      if (status) {
        throw new Error("Unable to stage files for commit. " + status);
      }

      return context;
    }, function(err) {
      console.error("Unable to execute git add on " + context.directory);
      throw new Error(err);
    });
}


function commitChanges(context) {
  console.log("Committing staged files in", context.directory);

  return execCommand("git", ["commit", "-m", context.commitMessage], { cwd: context.directory, env: process.env })
    .then(function(status) {
      if (!status) {
        throw new Error("Unable to commit files. " + status);
      }

      return context;
    }, function(err) {
      console.error("Unable to execute git commit on " +  context.directory);
      throw new Error(err);
    });
}


function pushBranch(context) {
  console.log("Push branch to remote in", context.directory);

  return execCommand("git", ["push", context.remote, context.branchName], { cwd: context.directory, env: process.env })
    .then(function(status) {
      if (status) {
        throw new Error("Unable to push branch. " + status);
      }

      return context;
    }, function(err) {
      console.error("Unable to execute git push " +  context.directory);
      throw new Error(err);
    });
}


function makePR(context) {
  // 1. git create branch
  // 2. git add files
  // 3. git commit
  // 4. git push
  // 5. git pull-request

  return Promise
    .resolve(context)
    .then(createBranch)
    .then(addFiles)
    .then(commitChanges)
    .then(pushBranch);
}


function execCommand(name, args, options) {
  var result = "";
  var checkdeps = spawn(name, args, options);
  checkdeps.stdout.setEncoding("utf8");
  checkdeps.stderr.setEncoding("utf8");

  return new Promise(function(resolve, reject) {
    checkdeps.stdout.on("data", function(data) {
      result += data;
    });

    checkdeps.stderr.on("data", function(err) {
      console.error(err);
    });

    checkdeps.on("close", function(code) {
      if (code !== 0) {
        reject(code);
      }

      if (result) {
        resolve(result);
      }
      else {
        resolve();
      }
    });
  });
}


module.exports = function exec(directories) {
  return [resolveDirectory, checkGitStatus, readNpmUpdates, updateNpmPackage, writeNpmPackage, makePR]
    .reduce(function(deferred, action) {
      return deferred.then(function(results) {
        return Promise.all(results.filter(Boolean).map(action));
      });

    }, Promise.all(directories));
};
