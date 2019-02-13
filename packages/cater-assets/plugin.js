// Copyright Jon Williams 2017-2018. See LICENSE file.
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const path = require('path');
const { ServerContext } = require('cater-runtime');
const vm = require('vm');

/**
 * # Cater Assets
 *
 * Converts references like:
 *
 *     import css from '../assets/my-stylesheet.scss';
 *
 * To something like:
 *
 *     var css = '/static/my-stylesheet.4bb92b2f79c434526c6ea5bdf409ff96.css;
 *
 * Works with CSS, SCSS and most image formats. Below a certain size, assets
 * will be converted to data URIs. You can force an asset of any size to be
 * a data URI by adding `.datauri` to the filename.
 *
 * Assets works primarily via the client-side WE rules. This plugin will
 * add module rules for images, stylesheets and a special loader for `.datauri`.
 * Once the webpack compilation has taken place, those outputs are injected
 * into a babel transform on the server-side.
 *
 * Options:
 *
 *     **dataURISizeLimit**
 *     The size in bytes that image assets are turned into data URIs instead
 *     of an image link. Defaults to 4KB.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs
 * @module cater-assets
 */

// Default size that images are turned into data uris
const DEFAULT_DATA_URI_SIZE_LIMIT = 1024 * 4; // 4KB

const DEFAULT_OPTIONS = {
  image: ['gif', 'ico', 'jpeg', 'jpg', 'png', 'svg'],
  stylesheet: ['css', 'scss']
};

// State values for the currently executing asset compilation
class State {
  constructor(app, options) {
    this.assetHost = app.assetHost;
    this.contextEntries = [];
    this.imageExtensions = options.image || [];
    this.files = [];
    this.publicPath = app.publicPath;
    this.manifest = {};
    this.mimimize = app.mode !== 'dev';
    this.stylesheetExtensions = options.stylesheet || [];
    this.extensions = this.imageExtensions.concat(this.stylesheetExtensions);
  }

  location(filename) {
    return path.join(this.assetHost + this.publicPath, filename);
  }
}

/*
 * Generates a Babel transform for the server-side rendering of assets. This
 * allows both the server and client sides to have the same asset definition
 * approach.
 *
 * To keep things consistent, the Babel (server) side is driven off Webpack.
 * Once the client Webpack compilation completes, the assets are fed over
 * via the manifest. This code then interrogates this manifest.
 *
 * Transpiles:
 *     import cuteCatPicture from '../assets/cat.png'
 *
 * To something like:
 *     const cuteCatPicture = 'https://cdn.example.org/cat.4bb92b2f79c434526c6ea5bdf409ff96.png';
 *
 * The substituion could also include data URIs. Whatever is supported on the
 * Webpack side is mirrored here.
 */
function generateBabelAssetTransform(pluginState) {
  // const manifest = pluginState.manifest;

  return function babelTransform({ types: t }) {
    return {
      visitor: {
        ImportDeclaration: function importDeclaration(declaration, state) {
          // Detect assets
          const importName = declaration.node.source.value;
          const ext = importName.split('.').pop();
          if (!pluginState.extensions.includes(ext)) return;

          let fullpath = importName;
          if (!importName.startsWith(path.sep)) {
            const relative = path.dirname(state.file.opts.filename);
            fullpath = path.resolve(path.join(relative, importName));
          }

          // The import could be assigned to a varible, or nothing. If it's
          // nothing, then put in a random variable name. This is necessary
          // so that things like extracttext for css still trigger.
          const specifier = declaration.node.specifiers[0];
          const id = specifier
            ? specifier.local.name
            : `__import${Math.floor(Math.random() * Math.floor(99999))}${Date.now()}`;

          // Convert the import in to setting a variable with the asset path
          let content = pluginState.manifest[fullpath];

          // Shim for tests as webpack hasn't necessarily run
          if (process.env.NODE_ENV === 'test' && !content) content = importName;

          if (specifier && content === '') {
            throw new Error(
              `No asset found for '${importName}' in ${
                state.file.opts.filename
              }. This is possibly because you are importing a global asset (like a css/scss file). This can be done, but should not be assigned to a variable. e.g. use import 'hello.css' instead of import hello from 'hello.css'. The latter will not work as the hello.css file is bundled.`
            );
          }
          if (specifier && !content) {
            throw new Error(`No asset found for '${importName}' in ${state.file.opts.filename}`);
          }

          const variable = t.variableDeclarator(t.identifier(id), t.stringLiteral(content));
          declaration.replaceWith({
            type: 'VariableDeclaration',
            kind: 'const',
            declarations: [variable]
          });
        }
      }
    };
  };
}

/*
 * Loader rules intended for the client Webpack.
 */
function generateWebpackImageRules(state) {
  // Matches examples like cat.png.data.uri
  const dataURIRule = {
    test: /\.datauri$/,
    use: [{ loader: path.join(__dirname, 'data-uri-loader.js') }]
  };

  // Matches cat.png, cat.jpg, etc.
  const imageRule = {
    test: state.imageFilenameRegExp,
    use: [
      {
        loader: 'url-loader',
        options: {
          publicPath: state.assetHost + state.publicPath,
          name: '[name].[hash].[ext]',
          limit: state.dataURISizeLimit
        }
      }
    ]
  };

  return [dataURIRule, imageRule];
}

/*
 * Loader rules for SaaS (SCSS) and CSS files.
 */
function generateWebpackStylesheetRule(state) {
  return {
    test: new RegExp(`\\.(${state.stylesheetExtensions.join('|')})$`),
    use: state.extractCssPlugin.extract({
      use: [
        { loader: 'css-loader', options: { minimize: state.mimimize } }, //
        { loader: 'sass-loader' },
        { loader: 'js-to-styles-var-loader' }
      ]
    })
  };
}

// Called when the client-side webpack is done. The manifest and the generated
// modules are passed over to the server-side babel to keep them aligned.
function onWebpackCompiled(state, side, stats) {
  if (!side.typeClient) return;

  const { compilation } = stats;
  const { serverContext } = state;
  const manifest = {};
  const entries = [];

  // Clear down the server context
  serverContext.clear();

  // Extract manifest chunk JS and CSS from the compilation -- in general
  // this will be references to the JS and CSS files.
  // eslint-disable-next-line no-param-reassign
  state.files = Array.from(compilation.namedChunks.values()) // TODO: Map->Array approach
    .map((v) => v.files)
    .reduce((prev, curr) => prev.concat(curr), []);

  // eslint-disable-next-line no-param-reassign
  state.contextEntries = entries;
  state.files.forEach((filename) => {
    const extension = path.extname(filename);
    const loc = state.location(filename);
    if (extension === '.js') entries.push(state.serverContext.addJavaScript(loc));
    if (extension === '.css') entries.push(state.serverContext.addStylesheet(loc));
  });

  const assetModules = stats.compilation.modules.filter((v) => {
    if (!v.userRequest) return false;
    const extension = path.extname(v.userRequest).replace(/^\./, '');
    return state.extensions.includes(extension);
  });

  assetModules.forEach((mod) => {
    if (mod.assets && Object.keys(mod.assets).length > 0) {
      manifest[mod.userRequest] = state.location(Object.keys(mod.assets)[0]);
    } else {
      // The asset is being delivered as a JavaScript code module - usually
      // this is because it's a datauri asset.
      const source = mod._source.source(); // eslint-disable-line no-underscore-dangle
      const sandbox = { module: { exports: {} } };
      const script = new vm.Script(source);
      script.runInNewContext(sandbox);

      // Content removed by the ExtractTextPlugin will return an empty object.
      // This is converted to a plain string.
      const exp = sandbox.module.exports;
      manifest[mod.userRequest] = typeof exp === 'string' ? exp : '';
    }
  });

  // eslint-disable-next-line no-param-reassign
  state.manifest = manifest;
}

// Called when the app is configured at dev and build time. This injects
// the necessary rules and transforms into the client and server sides
function onConfigured(app, state) {
  // Update state based upon any changes
  state.assetHost = app.assetHost || '';
  state.bundleName = app.bundleName;
  state.serverContext = new ServerContext();
  app.serverContexts.assets = state.serverContext;

  const babelTransform = generateBabelAssetTransform(state);
  const imageRules = generateWebpackImageRules(state);
  const cssRule = generateWebpackStylesheetRule(state);

  // Alter the client and server-side webpack configurations
  const webpack = app.sides.client.webpackConfig;

  webpack.module.rules.push(...imageRules);
  webpack.module.rules.push(cssRule);
  webpack.plugins.push(state.extractCssPlugin);

  // Update webpack with the CDN if necessary
  if (state.assetHost.length > 0) {
    webpack.output.publicPath = state.assetHost + webpack.output.publicPath;
  }

  // Update Server side to handle images
  app.sides.server.babel.plugins.push([babelTransform, {}]);
}

// Called when the Cater App is being built
function built(app, build, state) {
  const { serverContext } = state;
  build.emitConfigurationFile('cater-assets', { serverContext });
}

// Configures Cater with an asset processing pipeline.
function plugin(caterApp, providedOptions) {
  const options = providedOptions || DEFAULT_OPTIONS;

  // Work out the extensions for different asset classes
  const state = new State(caterApp, options);
  if (state.extensions.length === 0) return false; // Boundary condition. Not asset extensions.

  // Plugin rule to pull out the CSS stylesheets
  state.extractCssPlugin = new ExtractTextPlugin({ filename: '[name].[contenthash].css' });

  // Image extensions
  state.imageFilenameRegExp = new RegExp(`\\.(${state.imageExtensions.join('|')})$`);
  state.dataURISizeLimit = options.dataURISizeLimit || DEFAULT_DATA_URI_SIZE_LIMIT;

  // List and match for all asset extensions
  state.extensions.push('datauri');
  state.assetFilenameRegExp = new RegExp(`\\.(${state.extensions.join('|')})$`);

  // Connect to event hooks of interest
  caterApp.once('built', (app, build) => built(app, build, state));
  caterApp.on('compiled', (_, side, stats) => onWebpackCompiled(state, side, stats));
  caterApp.on('configured', (app) => onConfigured(app, state));

  return true;
}

module.exports = plugin;
