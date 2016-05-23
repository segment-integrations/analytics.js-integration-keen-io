'use strict';

/**
 * Module dependencies.
 */

var integration = require('analytics.js-integration');
var clone = require('clone');

/**
 * Expose `Keen IO` integration.
 */

var KeenSegment = module.exports = integration('Keen IO')
  .global('Keen')
  .global('KeenSegment')
  .option('ipAddon', false)
  .option('projectId', '')
  .option('readKey', false)
  .option('referrerAddon', false)
  .option('trackAllPages', false)
  .option('trackCategorizedPages', true)
  .option('trackNamedPages', true)
  .option('uaAddon', false)
  .option('urlAddon', false)
  .option('writeKey', '')
  .tag('<script src="//d26b395fwzu5fz.cloudfront.net/3.1.0/{{ lib }}.min.js">');

/**
 * Initialize.
 *
 * https://github.com/keen/keen-tracking.js
 * https://keen.io/docs/
 *
 * @api public
 */

KeenSegment.prototype.initialize = function() {
  var lib = this.options.readKey ? 'keen' : 'keen-tracker';
  var options = this.options;
  var previousKeen = window.Keen || null;
  var self = this;

  this.load({ lib: lib }, function() {
    window.KeenSegment = window.Keen;
    self.client = new window.KeenSegment({
      projectId: options.projectId,
      readKey: options.readKey,
      writeKey: options.writeKey
    });
    self.ready();
    if (previousKeen) {
      window.Keen = previousKeen;
    }
  });
};

/**
 * Loaded?
 *
 * @api private
 * @return {boolean}
 */

KeenSegment.prototype.loaded = function() {
  return !!(window.KeenSegment && window.KeenSegment.prototype.configure);
};

/**
 * Page.
 *
 * @api public
 * @param {Page} page
 */

KeenSegment.prototype.page = function(page) {
  var category = page.category();
  var name = page.fullName();
  var opts = this.options;

  // all pages
  if (opts.trackAllPages) {
    this.track(page.track());
  }

  // named pages
  if (name && opts.trackNamedPages) {
    this.track(page.track(name));
  }

  // categorized pages
  if (category && opts.trackCategorizedPages) {
    this.track(page.track(category));
  }
};

/**
 * Identify.
 *
 * TODO: migrate from old `userId` to simpler `id`
 * https://keen.io/docs/data-collection/data-enrichment/#add-ons
 *
 * Set up the Keen addons object. These must be specifically
 * enabled by the settings in order to include the plugins, or else
 * Keen will reject the request.
 *
 * @api public
 * @param {Identify} identify
 */

KeenSegment.prototype.identify = function(identify) {
  var traits = identify.traits();
  var id = identify.userId();
  var user = {};
  if (id) user.userId = id;
  if (traits) user.traits = traits;
  var props = { user: user };
  this.addons(props, identify);
  this.client.setGlobalProperties(function() {
    return clone(props);
  });
};

/**
 * Track.
 *
 * @api public
 * @param {Track} track
 */

KeenSegment.prototype.track = function(track) {
  var props = track.properties();
  this.addons(props, track);
  this.client.recordEvent(track.event(), props);
};

/**
 * Attach addons to `obj` with `msg`.
 *
 * @api private
 * @param {Object} obj
 * @param {Facade} msg
 */

KeenSegment.prototype.addons = function(obj, msg) {
  var options = this.options;
  var addons = [];

  if (options.ipAddon) {
    addons.push({
      name: 'keen:ip_to_geo',
      input: { ip: 'ip_address' },
      output: 'ip_geo_info'
    });
    obj.ip_address = '${keen.ip}';
  }

  if (options.uaAddon) {
    addons.push({
      name: 'keen:ua_parser',
      input: { ua_string: 'user_agent' },
      output: 'parsed_user_agent'
    });
    obj.user_agent = '${keen.user_agent}';
  }

  if (options.urlAddon) {
    addons.push({
      name: 'keen:url_parser',
      input: { url: 'page_url' },
      output: 'parsed_page_url'
    });
    obj.page_url = document.location.href;
  }

  if (options.referrerAddon) {
    addons.push({
      name: 'keen:referrer_parser',
      input: {
        referrer_url: 'referrer_url',
        page_url: 'page_url'
      },
      output: 'referrer_info'
    });
    obj.referrer_url = document.referrer;
    obj.page_url = document.location.href;
  }

  obj.keen = {
    timestamp: msg.timestamp(),
    addons: addons
  };
};
