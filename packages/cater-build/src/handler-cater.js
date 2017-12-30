// Copyright Jon Williams 2017. See LICENSE file.
const HandlerCater = require("cater-runtime").HandlerCater;

const CATER_MODULE_NAME_REGEX = /(\/client\/|\/server\/|\/app\/)/;

/**
 * Unloads cater-based modules from the regular node require cache.
 */
const unloadCaterBasedModules = function() {
  const moduleNames = Object.keys(require.cache);
  const unloadList = moduleNames.filter(v => v.match(CATER_MODULE_NAME_REGEX));
  unloadList.forEach(v => delete require.cache[v]);
  return true;
};

/**
 * Creates a handler with the given entry point (file that loads server
 * components). Plus the bundlePath.
 */
const generate = function(entryPath, bundlePath, publicPath) {
  const handler = HandlerCater(entryPath, bundlePath, publicPath);

  // Callback that gets this handler to unload cater-based modules and
  // reload from teh server entry point.
  handler.reload = function(firstRun = false) {
    unloadCaterBasedModules();
    try {
      handler.load();
      return true;
    } catch (e) {
      // If this is the first run through, don't start cater - throw an
      // error. Otherwise display the error and let the dev fix it up.
      if (firstRun) throw e;
      console.error(e);
      return false;
    }
  };
  handler.reload(true);

  return handler;
};

module.exports = generate;
