// Copyright Jon Williams 2017-2018. See LICENSE file.
const fs = require('fs');
const loaderUtils = require('loader-utils');
const path = require('path');
const { RawSource } = require('webpack-sources');
const { ServerContext } = require('cater-runtime');

/**
 * Standard cater-build plugin that add Favicon handling into the build process.
 * This uses the standard output of https://realfavicongenerator.net/ - which
 * is expected to be in the <appRoot>/assets/favicon directory.
 *
 * When generating on https://realfavicongenerator.net/ don't select to
 * have the favicons in a directory. This plugin manages the actual mapping
 * process.
 */

const ASSET_LIST = [
  'android-chrome-192x192.png',
  'android-chrome-384x384.png',
  'apple-touch-icon.png',
  'browserconfig.xml',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'favicon.ico',
  'mstile-150x150.png',
  'safari-pinned-tab.svg',
  'site.webmanifest'
];
const FAVICON_ASSETS_DIRECTORY = ['assets', 'favicon'];

function addHashToFilename(content, filename) {
  const hash = loaderUtils.getHashDigest(content, 'md5');
  const parts = filename.split('.');
  parts.splice(-1, 0, hash);
  return parts.join('.');
}

class Favicon {
  constructor(app) {
    this.appRootPath = app.appRootPath;
    this.assetPath = path.join(app.appRootPath, ...FAVICON_ASSETS_DIRECTORY);
    this.mapping = {};
    this.metadata = {};

    this.serverContext = new ServerContext();
    app.serverContexts.favicon = this.serverContext;

    // Test Mode Shim
    if (process.env.NODE_ENV === 'test' && this.configure()) {
      const { mapping } = this;
      Object.keys(this.assetMap).forEach((k) => {
        mapping[k] = `/static/${k}`;
      });
      this.assignServerContext();
    }
  }

  // Assigns the current mapping values to the server context
  assignServerContext() {
    this.serverContext.clear();

    // Microsoft Tile Meta-Data
    const browserConfig = this.mapping['browserconfig.xml'];
    if (browserConfig && this.metadata['browserconfig.xml']) {
      this.serverContext.addMeta({ name: 'msapplication-config', content: browserConfig });

      const match = this.metadata['browserconfig.xml'].match(/<TileColor>([^<]*)<\/TileColor>/);
      if (match) this.serverContext.addMeta({ name: 'msapplication-TileColor', content: match[1] });
    }

    // Generate Theme Meta-Data
    let color = null;
    const siteManifest = this.metadata['site.webmanifest'];
    if (siteManifest) {
      color = JSON.parse(siteManifest).theme_color;
      if (color) this.serverContext.addMeta({ name: 'theme', content: color });
    }

    // Note that Firefox (at v58) won't interrogate the icon sizes. It takes
    // the last icon that is specified. Hence, the order of having the 16x16
    // first is important here.
    Object.entries({
      'favicon-16x16.png': { rel: 'icon', sizes: '16x16' },
      'favicon-32x32.png': { rel: 'icon', sizes: '32x32' },
      'apple-touch-icon.png': { rel: 'apple-touch-icon', sizes: '180x180' },
      'safari-pinned-tab.svg': { rel: 'mask-icon', color },
      'site.webmanifest': { rel: 'manifest' }
    }).forEach(([k, v]) => {
      v.href = this.mapping[k];
      if (!v.href) return;
      this.serverContext.addLink(v);
    });
  }

  // Called when the Cater App is being built
  built(app, build) {
    if (!this.configured) return false;
    const { serverContext } = this;
    build.emitConfigurationFile('cater-favicon', { serverContext });
    return true;
  }

  compiling(app, side, compiler) {
    if (!side.typeClient) return; // Only takes effect on the client build
    if (!this.configure()) return; // Check that the favicon is set up
    this.mapping = {};

    compiler.hooks.emit.tapAsync('cater-build/favicon', (compilation, callback) => {
      const assets = Object.keys(this.assetMap);
      const images = assets.filter((v) => v.match(/\.(ico|png|svg)$/));

      this.mapping = images.reduce((prev, curr) => {
        const buffer = this.loadFile(curr);
        const filename = addHashToFilename(buffer, curr);
        compilation.assets[filename] = new RawSource(buffer);

        const location = path.join((app.assetHost || '') + app.publicPath, filename);
        prev[curr] = location;
        return prev;
      }, {});

      const metadata = assets.filter((v) => v.match(/\.(webmanifest|xml)$/));
      metadata.forEach((name) => {
        const content = Object.entries(this.mapping).reduce((prev, [k, v]) => {
          const next = prev.replace(`/${k}`, v);
          return next;
        }, this.loadFile(name, 'utf8'));

        const filename = addHashToFilename(content, name);
        const location = path.join((app.assetHost || '') + app.publicPath, filename);
        this.mapping[name] = location;
        this.metadata[name] = content;
        compilation.assets[filename] = new RawSource(content);
      });

      // Special handing for favicon.ico - have an un-fingerprinted version
      // that can be used for directly serving to browsers.
      if (this.assetMap['favicon.ico']) {
        compilation.assets['favicon.ico'] = new RawSource(this.loadFile('favicon.ico'));
      }

      this.assignServerContext();
      callback();
    });
  }

  // Configures the favicon object based upon the current working directory.
  // Returns true if the configuration is valid - false if not.
  configure() {
    // Does the favicon directory exist and does it have an files of interest
    // in it?
    if (!this.directoryExists()) return false;
    if (Object.keys(this.mapAssetFiles()).length === 0) return false;

    this.configured = true;
    return true;
  }

  directoryExists() {
    if (!fs.existsSync(this.assetPath)) return false;
    return fs.statSync(this.assetPath).isDirectory();
  }

  loadFile(name, encoding = null) {
    const filename = this.assetMap[name];
    if (!fs.existsSync(filename)) {
      throw new Error(`Expected to find ${filename}, but the file has moved or been deleted`);
    }
    return fs.readFileSync(filename, encoding);
  }

  mapAssetFiles() {
    this.assetMap = ASSET_LIST.reduce((prev, curr) => {
      const candidate = path.join(this.assetPath, curr);
      if (!fs.existsSync(candidate)) return prev;
      if (fs.statSync(candidate).isFile()) prev[curr] = candidate;
      return prev;
    }, {});
    return this.assetMap;
  }
}

module.exports = (app) => new Favicon(app);
