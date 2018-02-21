// Copyright Jon Williams 2017-2018. See LICENSE file.
const merge = require('deepmerge');

/**
 * Encapsulates context that is specific to the server-side rendering
 * of the Cater Application. Key examples would stylesheets, scripts and
 * other values that are intended as part of the layout -- and generally
 * fall outside the actual App being rendered.
 */
class ServerContext {
  constructor(defaults) {
    this.stylesheets = [];
    this.javascripts = [];
    this.json = {};

    this.links = [];
    this.title = '';
    Object.assign(this, merge(this, defaults));
  }

  /**
   * Adds a <head> link element
   */
  addLink(props) {
    this.links.push(props);
  }

  addJavaScript(src, options = {}) {
    const script = { src, ...options };
    this.javascripts.push(script);
    return script;
  }

  addJson(name, data) {
    this.json[name] = data;
  }

  addStyle(css, options = {}) {
    const stylesheet = { css, ...options };
    this.stylesheets.push(stylesheet);
    return stylesheet;
  }

  addStylesheet(href, options = {}) {
    const stylesheet = { href, ...options };
    this.stylesheets.push(stylesheet);
    return stylesheet;
  }

  /**
   * Sets the title for this page. Only the last title will apply if this
   * is called multiple times in a single render.
   */
  setTitle(title) {
    this.title = title;
  }
}

module.exports = ServerContext;