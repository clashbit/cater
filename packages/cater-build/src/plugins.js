// Copyright Jon Williams 2017-2018. See LICENSE file.
const Events = require('./app-events');
const fs = require('fs');
const path = require('path');

/*
 * Loads plugin modules defined in the cater options.
 */

function autoDefinePlugins(appRootPath, pkg, defaultPlugins) {
  const plugins = {};

  // Define from packages
  const deps = Object.keys(pkg.dependencies || {});
  const dev = Object.keys(pkg.devDependencies || {});

  const configuredDefaults = defaultPlugins
    .filter((entry) => Array.isArray(entry))
    .map(([name]) => name);
  const caterDeps = deps.concat(dev).filter((k) => k.startsWith('cater-'));

  // Packages with plugin as the root element
  caterDeps
    .filter((k) => require.resolve(k).endsWith('plugin.js'))
    .filter((k) => !configuredDefaults.includes(k))
    .forEach((k) => {
      plugins[k] = null;
    });

  // Packages with a plugins directory - this will take any cater-* packages
  // and look for a "plugins" directory in the package root. All *.js files
  // in that directory (but not subdirectories) are turned into a package.
  // The current app root is included too.
  caterDeps
    .reduce(
      // Turns a list of packages into a list of root directories for each
      // package
      // ['cater-build', 'cater-jest'] => ['/Code/node_modules/cater-build', ...]
      (prev, curr) => {
        let dir = path.dirname(require.resolve(curr));
        while (!fs.existsSync(path.join(dir, 'package.json'))) {
          const next = path.join(dir, '..');
          if (dir === next) return prev; // Hit the root directory
          dir = next;
        }
        prev.push(dir);
        return prev;
      },
      [appRootPath]
    )
    // Reduces + transforms the package directories to those that have a
    // plugins directory
    .reduce((prev, curr) => {
      const dir = path.join(curr, 'plugins');
      if (fs.existsSync(dir)) {
        const stat = fs.statSync(dir);
        if (stat.isDirectory()) prev.push(dir);
      }
      return prev;
    }, [])
    .reduce((prev, curr) => {
      const files = fs.readdirSync(curr).filter((v) => v.match(/\.js$/));
      const paths = files
        .map((name) => path.join(curr, name))
        .filter((filename) => fs.statSync(filename).isFile());
      return prev.concat(paths);
    }, [])
    .forEach((dir) => {
      plugins[dir] = null;
    });

  return plugins;
}

// Configures any automatic hooks for the plugin
function configurePluginHooks(cater, target) {
  Object.entries(Events).forEach(([key, value]) => {
    if (target[key] && typeof target[key] === 'function') cater.on(value, target[key].bind(target));
  });
}

function configurePlugin(cater, name, options) {
  const resolve = require.resolve(name);
  if (!resolve) {
    throw new Error(
      `Cater plugin ${name} was specificed, but that module wasn't found. Check it's installed.`
    );
  }
  const plugin = require(name); // eslint-disable-line global-require, import/no-dynamic-require

  if (typeof plugin !== 'function') {
    throw new Error(
      `Cater plugin ${name} was specified, but that module did not export a function. Plugins should export a 'function(cater, options)' as the default.`
    );
  }

  // Plugin should export a function to configure itself
  configurePluginHooks(cater, plugin);
  plugin.result = plugin(cater, options);
  if (typeof plugin.result === 'object') configurePluginHooks(cater, plugin.result);

  plugin.componentRootPath = path.dirname(resolve);
  return plugin;
}

function configurePlugins(app, plugins, options) {
  const configuredPlugins = {};

  const list = options.defaultPlugins.concat(Object.entries(plugins));
  list.forEach((entry) => {
    const [name, pluginOptions] = Array.isArray(entry) ? entry : [entry, null];
    configuredPlugins[name] = configurePlugin(app, name, pluginOptions);
  });

  return configuredPlugins;
}

function configure(app, options) {
  let plugins = [];
  if (options.plugins === 'auto') {
    const pkg = app.package();
    plugins = autoDefinePlugins(app.appRootPath, pkg, options.defaultPlugins);
  }

  return configurePlugins(app, plugins, options);
}

module.exports = configure;
