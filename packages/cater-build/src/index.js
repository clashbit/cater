// Copyright Jon Williams 2017-2018. See LICENSE file.
const Build = require('./app-build');
const { Config, RuntimeCater, ServerContext } = require('cater-runtime');
const DefaultConfig = require('./config-default.js');
const errors = require('./app-errors');
const Events = require('./app-events');
const fs = require('fs-extra');
const path = require('path');
const Plugins = require('./plugins.js');
const SideConfiguration = require('./app-side.js');
const webpackBuild = require('./webpack-build');

class BuildCater extends RuntimeCater {
  constructor(providedConfig) {
    const config = Config(providedConfig, DefaultConfig());
    super(config);

    this.configureBuildDefaults();
    // Build has several server context that are combined in the handler.
    // This allows plugins to maintain their own server-context state.
    this.serverContexts = {
      internal: this.serverContext // TODO
    };
    this.serverContext = new ServerContext(); // TODO

    this.configuredPlugins = Plugins(this, config);

    this.babel = config.babel;
    this.bundleName = config.bundleName;
    this.entryScriptFilename = config.entryScriptFilename;
    this.hotModuleReplacement = config.hotModuleReplacement;
    this.startOnError = config.startOnError;
    this.universalNames = config.universalNames;
    this.useLogging = config.useLogging;

    // EVENT: I know we're already configuring, but this is for the benefit
    // of the plugins - which have only just been set up.
    this.emit(Events.configuring, this, config);

    // Set up the key paths and get the client and server sides ready
    this.configurePaths(config);
    this.configureSides(config);

    // EVENT: Allow plugins to make changes at the end of the configuration
    // cycle
    this.emit(Events.configured, this, config);
    this.mergeServerContexts();
    this.cleanConfig();
  }

  // Returns a build as a Promise object
  build() {
    const currentBuild = new Build(this.appRootPath, this.buildPath);

    return fs
      .remove(this.buildPath) // rm -rf ./build
      .then(() => fs.mkdirp(this.buildPath)) // mkdir ./build
      .then(() => {
        this.emit(Events.building, this, currentBuild);
        if (this.devStaticPathExists) {
          const prodStaticPath = path.join(this.buildPath, this.publicPath);
          return fs.copy(this.devStaticPath, prodStaticPath); // cp -r ./static ./build/static
        }
        return Promise.resolve(true);
      })
      .then(() => webpackBuild(this)) // webpack -out ./build
      .then(() => {
        this.emit(Events.built, this, currentBuild);
        return Promise.resolve(currentBuild);
      });
  }

  configurePaths(config) {
    this.pluginPaths = Object.values(this.configuredPlugins)
      .map((v) => v.componentRootPath)
      .filter((v) => v);

    this.rootPaths = [
      this.appRootPath,
      ...this.pluginPaths,
      this.caterRootPath,
      this.caterRuntimePath
    ].filter((v) => fs.existsSync(v));

    this.staticPath = path.join(this.buildPath, this.publicPath);
    this.universalPaths = this.generatePaths(config.universalNames);

    // This is used to set up serving directly from /static in dev mode
    this.devStaticPath = path.join(this.appRootPath, config.staticDirectory);
    if (fs.existsSync(this.devStaticPath)) this.devStaticPathExists = true;
  }

  configureBuildDefaults() {
    this.caterRootPath = path.join(__dirname, '..');
  }

  configureSides(config) {
    this.sides = {};
    for (let i = 0; i < config.sideNames.length; i += 1) {
      const name = config.sideNames[i];
      this.sides[name] = new SideConfiguration(this, config, name);
    }
  }

  // Returns all paths that relate to cater-specific modules. Note that these
  // are in no priority order.
  getAllPaths() {
    const combined = Object.values(this.sides)
      .map((s) => s.sidePaths)
      .reduce((a, b) => a.concat(b), this.universalPaths);
    return [...new Set(combined)];
  }

  generatePaths(directories) {
    const result = [];
    for (let i = 0; i < this.rootPaths.length; i += 1) {
      const root = this.rootPaths[i];
      for (let j = 0; j < directories.length; j += 1) {
        const dir = directories[j];
        const candidate = path.join(root, dir);
        if (fs.existsSync(candidate)) result.push(candidate);
      }
    }
    return result;
  }

  // Returns a http.Handler for this application as a Promise.
  handler() {
    // TODO
    const Middleware = require('./middleware'); // eslint-disable-line global-require
    return Middleware(this);
  }

  mergeServerContexts() {
    // TODO: Re-Writes the server context in place. But likely there is
    // a much better way of handling this. We have separate server context
    // so plugins like assets and favicon don't need to track individual
    // context changes.

    const contexts = Object.values(this.serverContexts);
    if (contexts.length === 0) {
      throw new Error(
        'Strange. BuildCater.serverContexts does not have any entries. It should at least have the internal value'
      );
    }

    Object.keys(this.serverContext).forEach((key) => {
      const values = contexts.map((v) => v[key]);
      if (Array.isArray(this.serverContext[key])) {
        const value = values.reduce((prev, curr) => prev.concat(curr), []);
        this.serverContext[key] = value;
      } else {
        [this.serverContext[key]] = values;
      }
    });
  }

  package(bail = false) {
    const packageFile = path.join(this.appRootPath, 'package.json');
    if (!fs.existsSync(packageFile)) {
      if (!bail) return {};
      throw new Error(`Could not load package.json at ${packageFile}`);
    }
    return JSON.parse(fs.readFileSync(packageFile).toString());
  }

  // Kicks of the dev-time server
  start() {
    // TODO
    const { Middleware } = require('cater-runtime'); // eslint-disable-line global-require
    return this.handler().then((handler) => {
      Middleware.httpServer(handler, this.httpPort);
    });
  }

  triggerDeploy() {
    this.emit(Events.deploying, this);
    this.emit(Events.deployed, this);
  }

  triggerWebpackCompiled(side, stats) {
    this.emit(Events.compiled, this, side, stats);
    this.mergeServerContexts();
  }

  triggerWebpackCompiling(side, compiler) {
    this.emit(Events.compiling, this, side, compiler);
  }
}

// Composition
Object.assign(BuildCater.prototype, errors);

BuildCater.prototype.prepareCommandLine = function prepareCommandLine() {
  const commands = require('./commands.js'); // eslint-disable-line global-require
  Object.assign(BuildCater.prototype, commands);
  return true;
};

BuildCater.Events = Events;
module.exports = BuildCater;
