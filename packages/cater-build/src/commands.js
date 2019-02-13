// Copyright Jon Williams 2017-2018. See LICENSE file.
const Runtime = require('cater-runtime');

/**
 * Mixin that enables CLI-commands directly in the Cater App. Enabled
 * via the readyCommandLine function from the cater-build package.
 *
 * All methods return a promise.
 *
 * Example Usage - Assumes cater-build is installed.
 *
 *     const cater = require('cater');
 *     cater.readyCommandLine();
 *     const app = cater();
 *     app.runBuild();
 *
 * @module cater/commands
 */

// Returns a promise to a production build of the application.
function runBuild() {
  return this.build();
}

// Used as a hook to signal deployment - particularly to any plugins.
function runDeploy() {
  return Promise.resolve(this.triggerDeploy());
}

// Runs the development server - that's a server with webpack in-memory
// building (and reloading) the client and server code.
function runDev() {
  return this.handler().then((h) => Runtime.HttpServer(h, this.httpPort));
}

module.exports = { runBuild, runDeploy, runDev };
