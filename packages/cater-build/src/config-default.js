// Copyright Jon Williams 2017-2018. See LICENSE file.
const clone = require('clone');
const { DefaultConfig } = require('cater-runtime');
const merge = require('deepmerge');

/**
 * # Build Configuration Defaults
 *
 * Additional configuration values that are used at dev and/or build time.
 *
 *     **hotModuleReplacement**
 *     Enable the Hot Module Replacement feature of webpack. Right now will
 *     only enable if the env variable HMR is set to '1'.
 */

const buildDefaults = {
  defaultPlugins: ['cater-assets'],
  entryScriptFilename: '_entry.js',
  extensions: ['.js', '.jsx', ''],
  hotModuleReplacement: process.env.HMR === '1',
  mode: 'dev',
  plugins: 'auto',
  publicPath: '/static/',
  sideNames: ['client', 'server'],
  startOnError: true,
  staticDirectory: 'static',
  universalNames: ['app'],
  universalPrefix: 'app',
  useLogging: true
};

// Combine the build-time defaults with the runtime ones from cater-runtime
const runtimeDefaults = DefaultConfig();
const defaultConfig = merge(runtimeDefaults, buildDefaults);

function generate() {
  return clone(defaultConfig);
}

module.exports = generate;
