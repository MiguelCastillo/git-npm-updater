# git-npm-updater
Automatically update npm dependencies in your package.json and create Pull Requests to your git repo.


# options

```
--username:
  git username for authenticating when making a Pull Request.

--password:
  git password for authenticating when making a Pull Request.

--directories:
  List of local directories for which to make Pull Requests. Useful for specifying multiple local directories you want to make simultaneous Pull Requests for.
  - Defaults to the current working directory

--remote:
  name of the git remote to use.
  - Defaults to `origin`

--branch:
  name of the git branch to commit changes to and make the Pull Request from.
  - Defaults to `npm-dependency-updates`

--message:
  commit message used in the git commit and Pull Request.
  - Defaults to `Updating npm dependencies`

--to:
  remote branch to merge the Pull Request into.
  - Defaults to `master`

--latest:
  by default, dependencies are updated following semver. Use this flag to update to the latest available versions.
  - Defaults to `false`

--dryrun:
  flag to printout the updated package.json and the git information that would be used for the Pull Request.
  - Defaults to `false`
```


# usage

Sample for updating the git repo in your current working directory using the configured username and password

```
$ git-npm-update --username rollingstones --password whateveryouuse
```

Sample for updating bit-loader-text and bit-loader-css using the configured username and password.  You can optionally use `--directories`.

```
$ git-npm-update bit-loader-text bit-loader-css --username rollingstones --password whateveryouuse
```


# install

```
$ npm install git-npm-updater -g
```


# License
Licensed under MIT
