// Copyright Jon Williams 2017-2018. See LICENSE file.
const { spawnSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

/**
 * Represents the currently executing build. This is one of the objects
 * passed to plugins that are listening to build events.
 *
 * @module cater-build/build
 */
class Build {
  constructor(appRootPath, buildPath) {
    this.appRootPath = appRootPath;
    this.buildPath = buildPath;
    this.emitFileCount = 0;
  }

  /**
   * Copies a source file into the current build directory.
   */
  copy(filename) {
    const source = path.join(this.appRootPath, filename);
    const target = path.join(this.buildPath, filename);
    fs.copyFileSync(source, target);
  }

  /**
   * Emits a file into the current build directory.
   *
   * Typical usage:
   *
   *     build.emit('important-key.txt', 'How Now Brown Cow?');
   */
  emit(filename, content) {
    const outputPath = path.join(this.buildPath, filename);
    fs.writeFileSync(outputPath, content, { encoding: 'utf8' });
    return filename;
  }

  /**
   * Emits a data object as a configuration file in the build directory.
   * At runtime, this file will be included in the configuration.
   *
   *  Turns the given data into a filename along the lines of:
   *     cater.config.000002.cater-google-cloud.js
   *
   * The numbers are appended in sequence. This means the configuration
   * files will also be read in order of plugin configuration for the app.
   * Small thing, but may be important where once plugin needs to clobber
   * the values of another.
   */
  emitConfigurationFile(name, dataObjectOrModuleString) {
    let extension = 'js';
    let content = dataObjectOrModuleString;
    if (typeof content === 'object') {
      extension = 'json';
      content = JSON.stringify(dataObjectOrModuleString, null, 2);
    }

    const identifier = this.emitFileCount.toString().padStart(6, '0');
    const filename = `cater.config.${identifier}.${name}.${extension}`;
    this.emitFileCount += 1;
    return this.emit(filename, content);
  }

  // Runs a command
  // eslint-disable-next-line class-methods-use-this
  exec(command, stdio = true) {
    const options = stdio ? { stdio: 'inherit' } : {};

    // Echo the command we're proposing to run
    console.log(command); // eslint-disable-line no-console
    const result = spawnSync('sh', ['-c', command], options);
    if (result.status !== 0) {
      if (!stdio) {
        console.log(result.stdout.toString()); // eslint-disable-line no-console
        console.error(result.stderr.toString()); // eslint-disable-line no-console
      }
      throw new Error('Command execution failed.');
    }
    return result;
  }
}

module.exports = Build;
