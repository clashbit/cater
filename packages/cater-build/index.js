// Copyright Jon Williams 2017-2018. See LICENSE file.
const BuildCater = require('./src');
const Events = require('./src/app-events');

/**
 * Primary entry point for the build-versions of Cater. Returns an
 * instance of the Cater Application in build-mode.
 *
 * Example Usage (assumes cater-build installed):
 *
 *     const cater = require('cater');
 *     const app = cater(...config);
 *
 * See the cater/examples directory for more detail.
 *
 * @module cater-build
 */
function index(providedConfig = {}) {
  const app = new BuildCater(providedConfig);

  const babelConfig = app.sides.server.babel;
  Object.assign(babelConfig, { cache: false, only: app.sides.server.paths });

  require('babel-register')(babelConfig); // eslint-disable-line global-require

  return app;
}

// Enables command-line functions for the Cater App objects - as specified
// in ./src/commands.js
function readyCommandLine() {
  const commands = require('./src/commands'); // eslint-disable-line global-require
  return Object.assign(BuildCater.prototype, commands);
}

// Returns the test harness.
function testHarness() {
  return require('./src/harness.js'); // eslint-disable-line global-require
}

const exporting = { Events, readyCommandLine, testHarness };
module.exports = Object.assign(index, exporting);
