// Copyright Jon Williams 2017-2018. See LICENSE file.
const clone = require('clone');
const BabelConfig = require('./config-babel');

const babel = BabelConfig();

const defaultHttpPort = parseInt(process.env.PORT, 10) || 3000;

const defaultOptions = {
  babel,
  babelRegisterDisable: false,
  assetHost: null,
  buildDirectory: 'build',
  bundleName: 'bundle',
  httpPort: defaultHttpPort,
  mode: 'runtime',
  publicPath: '/static/',
  serverContext: {},
  serveStaticAssets: null // Will default to true unless assetHost is seet
};

function generate() {
  return clone(defaultOptions);
}

module.exports = generate;
