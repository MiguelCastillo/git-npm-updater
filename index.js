var defaults = require("./defaults");
var spawn = require("child_process").spawn;
var fs = require("fs");
var path = require("path");
var jsonFormat = require("json-format");
var GitApi = require("github-api");


var jsonFormatConfig = {
  type: "space",
  size: 2
};


function configure(options) {
  options.directory = path.resolve(options.directory);

  return Object.assign({
    file: options.directory + "/package.json"
  }, defaults, options);
}


function readNpmUpdates(context) {
  return execCommand("npm", ["outdated", "-l", "--json"], { cwd: context.directory, env: process.env }, "utf8")
    .then(function(updates) {
      if (!updates) {
        return Promise.reject(">> Dependencies are up to date");
      }

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
    .map(function(dependency) {
      var update = updates[dependency];

      return {
        name: dependency,
        version: context.latest ? update.latest : update.wanted
      };
    })
    .filter(function(dependency) {
      return updates[dependency.name].current !== dependency.version;
    })
    .forEach(function(dependency) {
      var update = updates[dependency.name];
      var version = packageFile[update.type][dependency.name];

      if (version) {
        packageFile[update.type][dependency.name] = version.replace(/([^\d]*).*/, "$1" + dependency.version);
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


function configureOrigin(context) {
  console.log("Configuring origin for", context.directory);

  return execCommand("git", ["remote", "--verbose"], { cwd: context.directory, env: process.env })
    .then(function(result) {
      var remoteInfo = result
        .replace(/\t/gm, " ")
        .split("\n")
        .filter(Boolean)
        .map(function(remote) {
          return remote.split(" ");
        })
        .filter(function(remote) {
          return remote[0] === context.remote && remote[2] === "(push)";
        })
        .map(function(remote) {
          var info = /[/:]([^/:]+)[/]([^/]+)([.][\w]+)$/.exec(remote[1]);

          return {
            url: remote[1],
            user: info[1],
            repository: info[2]
          };
        });

      Object.assign(context, remoteInfo[0]);

      if (!context.username) {
        context.username = context.user;
      }

      return context;
    }, function(err) {
      console.error("Unable to execute git remote on " + context.directory);
      throw new Error(err);
    });
}


function checkGitStatus(context) {
  console.log("Checking repository for pending changes to be staged and commited in", context.directory);

  return execCommand("git", ["status", "--porcelain"], { cwd: context.directory, env: process.env })
    .then(function(status) {
      if (status) {
        return Promise.reject(">> There are pending changes in '" + context.directory + "'. Please stash your changes first. " + status);
      }

      return context;
    }, function(err) {
      console.error("Unable to execute git status on " + context.directory);
      throw new Error(err);
    });
}


function checkBranch(context) {
  console.log("Checking if branch exists", context.directory);

  return execCommand("git", ["branch"], { cwd: context.directory, env: process.env })
    .then(function(result) {
      var branches = result
        .split(" ")
        .map(function(branchName) {
          return branchName.replace(/[\s|\*]/g, "");
        })
        .filter(function(branchName) {
          return branchName === context.branch;
        });

      if (branches.length) {
        return Promise.reject(">> Branch '" + context.branch + "' already exists on " + context.directory);
      }

      return context;
    }, function(err) {
      console.error("Unable to execute git branch on " + context.directory);
      throw new Error(err);
    });
}


function createBranch(context) {
  console.log("Creating branch in", context.directory);

  return execCommand("git", ["checkout", "-b", context.branch], { cwd: context.directory, env: process.env })
    .then(function(status) {
      if (!status) {
        return Promise.reject(">> Unable to create branch. " + status);
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
        return Promise.reject(">> Unable to stage files for commit. " + status);
      }

      return context;
    }, function(err) {
      console.error("Unable to execute git add on " + context.directory);
      throw new Error(err);
    });
}


function commitChanges(context) {
  console.log("Committing staged files in", context.directory);

  return execCommand("git", ["commit", "-m", context.message], { cwd: context.directory, env: process.env })
    .then(function(status) {
      if (!status) {
        return Promise.reject(">> Unable to commit files. " + status);
      }

      return context;
    }, function(err) {
      console.error("Unable to execute git commit on " +  context.directory);
      throw new Error(err);
    });
}


function pushBranch(context) {
  console.log("Push branch to remote in", context.directory);

  return execCommand("git", ["push", context.remote, context.branch], { cwd: context.directory, env: process.env })
    .then(function(status) {
      if (status) {
        return Promise.reject(">> Unable to push branch. " + status);
      }

      return context;
    }, function(err) {
      console.error("Unable to execute git push " +  context.directory);
      throw new Error(err);
    });
}


function createPullRequest(context) {
  console.log("Creating Pull Request... in", context.directory);

  var api = new GitApi({
    username: context.username,
    password: context.password
  });

  return api
    .getRepo(context.user, context.repository)
    .createPullRequest({
      title: context.message,
      base: context.to,
      head: context.branch
    })
    .then(function(result) {
      console.log("Pull Request created in", context.directory);
      context.result = result;
      return context;
    });
}


function updateNPM(context) {
  return Promise
    .resolve(context)
    .then(readNpmUpdates)
    .then(updateNpmPackage);
}


function makePR(context) {
  if (context.dryrun) {
    console.log(context);
    return context;
  }

  return Promise
    .resolve(context)
    .then(writeNpmPackage)
    .then(configureOrigin)
    .then(createBranch)
    .then(addFiles)
    .then(commitChanges)
    .then(pushBranch)
    .then(createPullRequest);
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


module.exports = function exec(directories, options) {
  var configs = directories.map(function(directory) {
    return Object.assign({
      directory: directory
    }, options || {});
  });

  return [ configure, checkGitStatus, checkBranch, updateNPM, makePR ]
    .reduce(function(deferred, action) {
      return deferred.then(function(results) {
        return Promise.all(results.filter(Boolean).map(action));
      });

    }, Promise.all(configs));
};

