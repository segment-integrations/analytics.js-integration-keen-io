'use strict';

/**
 * Module dependencies.
 */

var integration = require('@segment/analytics.js-integration');
var clone = require('@ndhoule/clone');
var extend = require('@ndhoule/extend');

/**
 * Expose `Keen IO` integration.
 */

var Keen = module.exports = integration('Keen IO')
  .global('KeenSegment')

  // project config
  .option('projectId', '')
  .option('writeKey', '')
  .option('readKey', '')

  // add-ons
  .option('ipAddon', false)
  .option('referrerAddon', false)
  .option('uaAddon', false)
  .option('urlAddon', false)
  .option('datetimeAddon', false)

  // track
  .option('trackAllPages', false)
  .option('trackCategorizedPages', true)
  .option('trackNamedPages', true)

  // library
  .tag('<script src="https://d26b395fwzu5fz.cloudfront.net/{{ lib }}.min.js">');

/**
 * Initialize.
 *
 * https://github.com/keen/keen-js#installation
 * https://keen.io/docs/
 *
 * @api public
 */

Keen.prototype.initialize = function() {
  var lib = this.options.readKey ? '5.0.1/keen.bundle' : 'keen-tracking-2.0.1';
  var options = this.options;
  var previousKeen = window.Keen || null;
  var self = this;
  this.load({ lib: lib }, function() {
    // Redefine safe namespace with full library
    window.KeenSegment = window.Keen;
    // Restore original `Keen`
    if (previousKeen) {
      window.Keen = previousKeen;
      previousKeen = undefined;
    }
    self.client = extend(self.client ? self.client : {},
      new window.KeenSegment({
        projectId: options.projectId,
        readKey: options.readKey,
        writeKey: options.writeKey
      }));
    self.ready();
  });
};

/**
 * Loaded?
 *
 * @api private
 * @return {boolean}
 */

Keen.prototype.loaded = function() {
  return !!(window.KeenSegment && window.KeenSegment.prototype.configure);
};

/**
 * Page.
 *
 * @api public
 * @param {Page} page
 */

Keen.prototype.page = function(page) {
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

Keen.prototype.identify = function(identify) {
  var traits = identify.traits();
  var id = identify.userId();
  var user = {};
  if (id) user.userId = id;
  if (traits) user.traits = traits;
  var props = { user: user };
  this.addons(props, identify);
  this.client = extend(this.client ? this.client : {}, {
    extendEvents: function() {
      // Clone the props so the Keen Client can't manipulate the ref
      return clone(props);
    }
  });
};

/**
 * Track.
 *
 * @api public
 * @param {Track} track
 */

Keen.prototype.track = function(track) {
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

Keen.prototype.addons = function(obj) {
  var options = this.options;
  var addons = [];

  if (options.ipAddon) {
    addons.push({
      name: 'keen:ip_to_geo',
      input: {
        ip: 'geo.ip_address'
      },
      output : 'geo.info'
    });
    obj.geo = {
      info: {},
      ip_address: '${keen.ip}'
    };
  }

  if (options.uaAddon) {
    obj.tech = {
      info: { /* Enriched */ },
      user_agent: '${keen.user_agent}'
    };
    addons.push({
      name: 'keen:ua_parser',
      input: {
        ua_string: 'tech.user_agent'
      },
      output: 'tech.info'
    });
  }

  if (options.urlAddon) {
    obj.page = {
      info: { /* Enriched */ },
      title: document.title,
      url: document.location.href
    };
    addons.push({
      name: 'keen:url_parser',
      input: {
        url: 'page.url'
      },
      output: 'page.info'
    });
  }

  if (options.referrerAddon) {
    obj.referrer = {
      info: { /* Enriched */ },
      url: document.referrer
    };
    addons.push({
      name: 'keen:referrer_parser',
      input: {
        referrer_url: 'referrer.url',
        page_url: 'page.url'
      },
      output: 'referrer.info'
    });
  }

  if (options.datetimeAddon) {
    obj.referrer = {
      info: { /* Enriched */ },
      url: document.referrer
    };
    addons.push({
      name: 'keen:date_time_parser',
      input: {
        date_time: 'keen.timestamp'
      },
      output: 'timestamp_info'
    });
  }

  obj.keen = {
    timestamp: new Date().toISOString(),
    addons: addons
  };
};
