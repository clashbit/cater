# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

* Deploy Google Cloud Storage now lets you explictly set the bucket name. Useful as extra "web site" features of Google Storage require a specific naming format.
* Added the ability to "require" JavaScript files in SCSS. Useful to allow the sharing of variables (like fonts, colors) between JavaScript and SCSS.

### Fixed

* Icon order influences which favicon Firefox selects. Made sure the higher resolution ones are later. This prevents the fuzzies on retina favicons.
* Favicon plugin now also generates the Microsoft Tile and Theme color meta tags.

### [0.10.0] - 2018-03-03

### Added

* Included a plugin to enable babel-transformed use of the polished CSS-in-JS utility library. Use cater-polished to add support.
* Added in spread operators via the babel transformation.
* Simple plugins can now be created by dropping a _.js file in the /plugins directory of your app, or in any of the included cater-_ packages.
* Added support for favicons via the cater-build/favicon plugin.
* Added support for deploying static client assets to Google Cloud Storage via the cater-deploy-google-cloud-storage contrib plugin.
* Basic Docker image build support via cater-docker.

### Fixed

* Server Context was adding multiple bundle.css and bundle.js entries on reload in dev mode.

### Changed

* Upgraded from Webpack 3 to Webpack 4.

* Major revision of cater-assets. Instead of the special 'assets/' import, just use relative paths instead. Required dropping the approach of scanning the manifest. However, it means asset imports can be relative -- this makes things neater. It also means libraries can reference the same asset names without collisons.

## [0.8.0] - 2018-02-21

### Added

* Included a <Link> component to add link tags into the header element server-side.

### Changed

* Reworked the "Cater Context" to be "Server Context" and simplified the API. Also configures the context from some defaults. This means cater-assets can output bundle styles/scripts to be included rather than having magic scripts and stylesheets that need to be included.

## [0.7.1] - 2018-02-19

### Changed

* Emotion library upgraded from v8 to 9.0.1

### Fixed

* Includes a fix for running Hot Module Replacement (HMR=1).

## [0.6.0] - 2018-01-10

### Added

* Build-time Cater now handles reloading of server-side modules correctly. Added a file watcher that will reload when server-modules change (de-bounced to 1s intervals).
* Enabled Hot Module Replacement (HMR) feature of webpack. For the moment, this needs to be explictly enabled with the HMR environment variable set to '1'. e.g. HMR=1 yarn run dev.
* Errors are now caught server, webpack-client and browser-client sides. These are reported on the terminal and in the browser. Still some work to do on the browser-side, but the right guts are there.

### Fixed

* Build-time Cater Handler no longer uses a hardcoded regex to unload module names.

## [0.5.3] - 2018-01-04

### Added

* Included the packages/cater-memoization plugin as an example of a Universal Component. This performs memoization (caching) of child content on the server-side. Also included examples/memoization to demonstrate the component.
* Added a deployment example for the Zeit Now service.

### Changed

* Revamped the options approach to use configuration objects. This is the start of allowing the build process to replace configuration boilerplate.
* Removed the App Engine example and replaced it with the "Extended" example instead.

### Fixed

* CDN support in the Google App Engine example wasn't working. Need to be careful which plugins active at different stages of the build-deploy cycles.
* The Static Server shouldn't run in production if a CDN is configured.

## [0.5.0] - 2018-01-03

### Added

* Added in support for React Router.
* Improved support for Google Cloud Platform.

## [0.4.1] - 2018-01-01

### Added

* Redux is now supported via the cater-redux package.
* Using ESLint across all packages.

### Fixed

* The caret "^ cascade import was traversing component1/app, component2/app, componen1/side, component2/side, ... -- whereas it's now c1/app, c1/side, c2/app, c2/side. This was necessary to get the provider cascade working.

## [0.3.7] - 2017-12-30

### Added

* app/title Title component will set the server and client side title tag in the head of the document.
* The dev server is wrapped in a handler that will ETag development assets invalidating whenever a new compile is triggered. This improves dev-time performance between page loads.
* Production server will now shut down gracefully if two consecutive space keystrokes are received.

## Changed

* Tidied up the emotion test approach in the examples/with-emotion - plus added in hydration for the emotion ids.
* Major refactor of the cater "src" directories to avoid using Babel in runtime. Ongoing, but major improvement.

## [0.3.6] - 2017-12-29

### Added

* A config.cater.js file in the application root directory now is used as options. This can include an "env" section that has options specific for a NODE_ENV.
* Added in a Google Cloud App Engine example. This also necessitated adding in a rudimentary config system to change the HTTP port.
* Static asset server now will set cache headers and check ETags for digested static assets.

## [0.3.2] - 2017-12-28

### Fixed

* Fixing up cross versioning between cater packages and ensuring they're all on the same version.

## [0.3.0] - 2017-12-28

### Added

* The caret import. This will import from a component that overrides another component. For example if you had project/server/layout import '^' it would return the cater/server/layout component. Useful for wrappering.
* Asset processing from the project/asset directory. Supports images, scss and css files. Uses Babel transforms on the server-side and Webpack on the client side.
* Moved to a plugin model that'll allow the base Cater code to be simpler.

### Changed

* Updated dependent packages, including Jest from v21 to v22.
* Moved production components to a cater-runtime package.

## [0.2.0] - 2017-12-23

### Added

* Added in the SkipServerSideRender component that conditionally renders children only if it's client-side. Added in examples/built-in-components to demonstrate it in action. It also is a good example of differential client-server-side components.
* Added in the Jest test framework and some basic tests.
* Added ability to create production builds.

### Changed

* Simplified the Webpack client and server side compilation by using MultiCompiler feature of Webpack.
* Refactored the context piece. Now just a "Cater" object with the options and sides a child objects.

### Fixed

* Wasn't able to supply a custom Layout component from the hosted App. Fixed this and added example/custom-layout to demonstrate.

## [0.1.2] - 2017-12-13

### Added

* Added in the examples/express-server and refactored cater/src to suit plugging in as an http.Handler. A number of files added, but was largely atomizing the old src/server.js into specific middleware components.
