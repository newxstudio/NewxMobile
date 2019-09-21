

/*!
 * vue-router v3.0.6
 * (c) 2019 Evan You
 * @license MIT
 */
(function(global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
		typeof define === 'function' && define.amd ? define(factory) :
		(global.VueRouter = factory());
}(this, (function() {
	'use strict';

	/*  */

	function assert(condition, message) {
		if (!condition) {
			throw new Error(("[vue-router] " + message))
		}
	}

	function warn(condition, message) {
		if ("development" !== 'production' && !condition) {
			typeof console !== 'undefined' && console.warn(("[vue-router] " + message));
		}
	}

	function isError(err) {
		return Object.prototype.toString.call(err).indexOf('Error') > -1
	}

	function extend(a, b) {
		for (var key in b) {
			a[key] = b[key];
		}
		return a
	}

	var View = {
		name: 'RouterView',
		functional: true,
		props: {
			name: {
				type: String,
				default: 'default'
			}
		},
		render: function render(_, ref) {
			var props = ref.props;
			var children = ref.children;
			var parent = ref.parent;
			var data = ref.data;

			// used by devtools to display a router-view badge
			data.routerView = true;

			// directly use parent context's createElement() function
			// so that components rendered by router-view can resolve named slots
			var h = parent.$createElement;
			var name = props.name;
			var route = parent.$route;
			var cache = parent._routerViewCache || (parent._routerViewCache = {});

			// determine current view depth, also check to see if the tree
			// has been toggled inactive but kept-alive.
			var depth = 0;
			var inactive = false;
			while (parent && parent._routerRoot !== parent) {
				var vnodeData = parent.$vnode && parent.$vnode.data;
				if (vnodeData) {
					if (vnodeData.routerView) {
						depth++;
					}
					if (vnodeData.keepAlive && parent._inactive) {
						inactive = true;
					}
				}
				parent = parent.$parent;
			}
			data.routerViewDepth = depth;

			// render previous view if the tree is inactive and kept-alive
			if (inactive) {
				return h(cache[name], data, children)
			}

			var matched = route.matched[depth];
			// render empty node if no matched route
			if (!matched) {
				cache[name] = null;
				return h()
			}

			var component = cache[name] = matched.components[name];

			// attach instance registration hook
			// this will be called in the instance's injected lifecycle hooks
			data.registerRouteInstance = function(vm, val) {
				// val could be undefined for unregistration
				var current = matched.instances[name];
				if (
					(val && current !== vm) ||
					(!val && current === vm)
				) {
					matched.instances[name] = val;
				}
			}

			// also register instance in prepatch hook
			// in case the same component instance is reused across different routes
			;
			(data.hook || (data.hook = {})).prepatch = function(_, vnode) {
				matched.instances[name] = vnode.componentInstance;
			};

			// register instance in init hook
			// in case kept-alive component be actived when routes changed
			data.hook.init = function(vnode) {
				if (vnode.data.keepAlive &&
					vnode.componentInstance &&
					vnode.componentInstance !== matched.instances[name]
				) {
					matched.instances[name] = vnode.componentInstance;
				}
			};

			// resolve props
			var propsToPass = data.props = resolveProps(route, matched.props && matched.props[name]);
			if (propsToPass) {
				// clone to prevent mutation
				propsToPass = data.props = extend({}, propsToPass);
				// pass non-declared props as attrs
				var attrs = data.attrs = data.attrs || {};
				for (var key in propsToPass) {
					if (!component.props || !(key in component.props)) {
						attrs[key] = propsToPass[key];
						delete propsToPass[key];
					}
				}
			}

			return h(component, data, children)
		}
	}

	function resolveProps(route, config) {
		switch (typeof config) {
			case 'undefined':
				return
			case 'object':
				return config
			case 'function':
				return config(route)
			case 'boolean':
				return config ? route.params : undefined
			default:
				{
					warn(
						false,
						"props in \"" + (route.path) + "\" is a " + (typeof config) + ", " +
						"expecting an object, function or boolean."
					);
				}
		}
	}

	/*  */

	var encodeReserveRE = /[!'()*]/g;
	var encodeReserveReplacer = function(c) {
		return '%' + c.charCodeAt(0).toString(16);
	};
	var commaRE = /%2C/g;

	// fixed encodeURIComponent which is more conformant to RFC3986:
	// - escapes [!'()*]
	// - preserve commas
	var encode = function(str) {
		return encodeURIComponent(str)
			.replace(encodeReserveRE, encodeReserveReplacer)
			.replace(commaRE, ',');
	};

	var decode = decodeURIComponent;

	function resolveQuery(
		query,
		extraQuery,
		_parseQuery
	) {
		if (extraQuery === void 0) extraQuery = {};

		var parse = _parseQuery || parseQuery;
		var parsedQuery;
		try {
			parsedQuery = parse(query || '');
		} catch (e) {
			"development" !== 'production' && warn(false, e.message);
			parsedQuery = {};
		}
		for (var key in extraQuery) {
			parsedQuery[key] = extraQuery[key];
		}
		return parsedQuery
	}

	function parseQuery(query) {
		var res = {};

		query = query.trim().replace(/^(\?|#|&)/, '');

		if (!query) {
			return res
		}

		query.split('&').forEach(function(param) {
			var parts = param.replace(/\+/g, ' ').split('=');
			var key = decode(parts.shift());
			var val = parts.length > 0 ?
				decode(parts.join('=')) :
				null;

			if (res[key] === undefined) {
				res[key] = val;
			} else if (Array.isArray(res[key])) {
				res[key].push(val);
			} else {
				res[key] = [res[key], val];
			}
		});

		return res
	}

	function stringifyQuery(obj) {
		var res = obj ? Object.keys(obj).map(function(key) {
			var val = obj[key];

			if (val === undefined) {
				return ''
			}

			if (val === null) {
				return encode(key)
			}

			if (Array.isArray(val)) {
				var result = [];
				val.forEach(function(val2) {
					if (val2 === undefined) {
						return
					}
					if (val2 === null) {
						result.push(encode(key));
					} else {
						result.push(encode(key) + '=' + encode(val2));
					}
				});
				return result.join('&')
			}

			return encode(key) + '=' + encode(val)
		}).filter(function(x) {
			return x.length > 0;
		}).join('&') : null;
		return res ? ("?" + res) : ''
	}

	/*  */

	var trailingSlashRE = /\/?$/;

	function createRoute(
		record,
		location,
		redirectedFrom,
		router
	) {
		var stringifyQuery$$1 = router && router.options.stringifyQuery;

		var query = location.query || {};
		try {
			query = clone(query);
		} catch (e) {}

		var route = {
			name: location.name || (record && record.name),
			meta: (record && record.meta) || {},
			path: location.path || '/',
			hash: location.hash || '',
			query: query,
			params: location.params || {},
			fullPath: getFullPath(location, stringifyQuery$$1),
			matched: record ? formatMatch(record) : []
		};
		if (redirectedFrom) {
			route.redirectedFrom = getFullPath(redirectedFrom, stringifyQuery$$1);
		}
		return Object.freeze(route)
	}

	function clone(value) {
		if (Array.isArray(value)) {
			return value.map(clone)
		} else if (value && typeof value === 'object') {
			var res = {};
			for (var key in value) {
				res[key] = clone(value[key]);
			}
			return res
		} else {
			return value
		}
	}

	// the starting route that represents the initial state
	var START = createRoute(null, {
		path: '/'
	});

	function formatMatch(record) {
		var res = [];
		while (record) {
			res.unshift(record);
			record = record.parent;
		}
		return res
	}

	function getFullPath(
		ref,
		_stringifyQuery
	) {
		var path = ref.path;
		var query = ref.query;
		if (query === void 0) query = {};
		var hash = ref.hash;
		if (hash === void 0) hash = '';

		var stringify = _stringifyQuery || stringifyQuery;
		return (path || '/') + stringify(query) + hash
	}

	function isSameRoute(a, b) {
		if (b === START) {
			return a === b
		} else if (!b) {
			return false
		} else if (a.path && b.path) {
			return (
				a.path.replace(trailingSlashRE, '') === b.path.replace(trailingSlashRE, '') &&
				a.hash === b.hash &&
				isObjectEqual(a.query, b.query)
			)
		} else if (a.name && b.name) {
			return (
				a.name === b.name &&
				a.hash === b.hash &&
				isObjectEqual(a.query, b.query) &&
				isObjectEqual(a.params, b.params)
			)
		} else {
			return false
		}
	}

	function isObjectEqual(a, b) {
		if (a === void 0) a = {};
		if (b === void 0) b = {};

		// handle null value #1566
		if (!a || !b) {
			return a === b
		}
		var aKeys = Object.keys(a);
		var bKeys = Object.keys(b);
		if (aKeys.length !== bKeys.length) {
			return false
		}
		return aKeys.every(function(key) {
			var aVal = a[key];
			var bVal = b[key];
			// check nested equality
			if (typeof aVal === 'object' && typeof bVal === 'object') {
				return isObjectEqual(aVal, bVal)
			}
			return String(aVal) === String(bVal)
		})
	}

	function isIncludedRoute(current, target) {
		return (
			current.path.replace(trailingSlashRE, '/').indexOf(
				target.path.replace(trailingSlashRE, '/')
			) === 0 &&
			(!target.hash || current.hash === target.hash) &&
			queryIncludes(current.query, target.query)
		)
	}

	function queryIncludes(current, target) {
		for (var key in target) {
			if (!(key in current)) {
				return false
			}
		}
		return true
	}

	/*  */

	// work around weird flow bug
	var toTypes = [String, Object];
	var eventTypes = [String, Array];

	var Link = {
		name: 'RouterLink',
		props: {
			to: {
				type: toTypes,
				required: true
			},
			tag: {
				type: String,
				default: 'a'
			},
			exact: Boolean,
			append: Boolean,
			replace: Boolean,
			activeClass: String,
			exactActiveClass: String,
			event: {
				type: eventTypes,
				default: 'click'
			}
		},
		render: function render(h) {
			var this$1 = this;

			var router = this.$router;
			var current = this.$route;
			var ref = router.resolve(this.to, current, this.append);
			var location = ref.location;
			var route = ref.route;
			var href = ref.href;

			var classes = {};
			var globalActiveClass = router.options.linkActiveClass;
			var globalExactActiveClass = router.options.linkExactActiveClass;
			// Support global empty active class
			var activeClassFallback = globalActiveClass == null ?
				'router-link-active' :
				globalActiveClass;
			var exactActiveClassFallback = globalExactActiveClass == null ?
				'router-link-exact-active' :
				globalExactActiveClass;
			var activeClass = this.activeClass == null ?
				activeClassFallback :
				this.activeClass;
			var exactActiveClass = this.exactActiveClass == null ?
				exactActiveClassFallback :
				this.exactActiveClass;
			var compareTarget = location.path ?
				createRoute(null, location, null, router) :
				route;

			classes[exactActiveClass] = isSameRoute(current, compareTarget);
			classes[activeClass] = this.exact ?
				classes[exactActiveClass] :
				isIncludedRoute(current, compareTarget);

			var handler = function(e) {
				if (guardEvent(e)) {
					if (this$1.replace) {
						router.replace(location);
					} else {
						router.push(location);
					}
				}
			};

			var on = {
				click: guardEvent
			};
			if (Array.isArray(this.event)) {
				this.event.forEach(function(e) {
					on[e] = handler;
				});
			} else {
				on[this.event] = handler;
			}

			var data = {
				class: classes
			};

			if (this.tag === 'a') {
				data.on = on;
				data.attrs = {
					href: href
				};
			} else {
				// find the first <a> child and apply listener and href
				var a = findAnchor(this.$slots.default);
				if (a) {
					// in case the <a> is a static node
					a.isStatic = false;
					var aData = a.data = extend({}, a.data);
					aData.on = on;
					var aAttrs = a.data.attrs = extend({}, a.data.attrs);
					aAttrs.href = href;
				} else {
					// doesn't have <a> child, apply listener to self
					data.on = on;
				}
			}

			return h(this.tag, data, this.$slots.default)
		}
	}

	function guardEvent(e) {
		// don't redirect with control keys
		if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) {
			return
		}
		// don't redirect when preventDefault called
		if (e.defaultPrevented) {
			return
		}
		// don't redirect on right click
		if (e.button !== undefined && e.button !== 0) {
			return
		}
		// don't redirect if `target="_blank"`
		if (e.currentTarget && e.currentTarget.getAttribute) {
			var target = e.currentTarget.getAttribute('target');
			if (/\b_blank\b/i.test(target)) {
				return
			}
		}
		// this may be a Weex event which doesn't have this method
		if (e.preventDefault) {
			e.preventDefault();
		}
		return true
	}

	function findAnchor(children) {
		if (children) {
			var child;
			for (var i = 0; i < children.length; i++) {
				child = children[i];
				if (child.tag === 'a') {
					return child
				}
				if (child.children && (child = findAnchor(child.children))) {
					return child
				}
			}
		}
	}

	var _Vue;

	function install(Vue) {
		if (install.installed && _Vue === Vue) {
			return
		}
		install.installed = true;

		_Vue = Vue;

		var isDef = function(v) {
			return v !== undefined;
		};

		var registerInstance = function(vm, callVal) {
			var i = vm.$options._parentVnode;
			if (isDef(i) && isDef(i = i.data) && isDef(i = i.registerRouteInstance)) {
				i(vm, callVal);
			}
		};

		Vue.mixin({
			beforeCreate: function beforeCreate() {
				if (isDef(this.$options.router)) {
					this._routerRoot = this;
					this._router = this.$options.router;
					this._router.init(this);
					Vue.util.defineReactive(this, '_route', this._router.history.current);
				} else {
					this._routerRoot = (this.$parent && this.$parent._routerRoot) || this;
				}
				registerInstance(this, this);
			},
			destroyed: function destroyed() {
				registerInstance(this);
			}
		});

		Object.defineProperty(Vue.prototype, '$router', {
			get: function get() {
				return this._routerRoot._router
			}
		});

		Object.defineProperty(Vue.prototype, '$route', {
			get: function get() {
				return this._routerRoot._route
			}
		});

		Vue.component('RouterView', View);
		Vue.component('RouterLink', Link);

		var strats = Vue.config.optionMergeStrategies;
		// use the same hook merging strategy for route hooks
		strats.beforeRouteEnter = strats.beforeRouteLeave = strats.beforeRouteUpdate = strats.created;
	}

	/*  */

	var inBrowser = typeof window !== 'undefined';

	/*  */

	function resolvePath(
		relative,
		base,
		append
	) {
		var firstChar = relative.charAt(0);
		if (firstChar === '/') {
			return relative
		}

		if (firstChar === '?' || firstChar === '#') {
			return base + relative
		}

		var stack = base.split('/');

		// remove trailing segment if:
		// - not appending
		// - appending to trailing slash (last segment is empty)
		if (!append || !stack[stack.length - 1]) {
			stack.pop();
		}

		// resolve relative path
		var segments = relative.replace(/^\//, '').split('/');
		for (var i = 0; i < segments.length; i++) {
			var segment = segments[i];
			if (segment === '..') {
				stack.pop();
			} else if (segment !== '.') {
				stack.push(segment);
			}
		}

		// ensure leading slash
		if (stack[0] !== '') {
			stack.unshift('');
		}

		return stack.join('/')
	}

	function parsePath(path) {
		var hash = '';
		var query = '';

		var hashIndex = path.indexOf('#');
		if (hashIndex >= 0) {
			hash = path.slice(hashIndex);
			path = path.slice(0, hashIndex);
		}

		var queryIndex = path.indexOf('?');
		if (queryIndex >= 0) {
			query = path.slice(queryIndex + 1);
			path = path.slice(0, queryIndex);
		}

		return {
			path: path,
			query: query,
			hash: hash
		}
	}

	function cleanPath(path) {
		return path.replace(/\/\//g, '/')
	}

	var isarray = Array.isArray || function(arr) {
		return Object.prototype.toString.call(arr) == '[object Array]';
	};

	/**
	 * Expose `pathToRegexp`.
	 */
	var pathToRegexp_1 = pathToRegexp;
	var parse_1 = parse;
	var compile_1 = compile;
	var tokensToFunction_1 = tokensToFunction;
	var tokensToRegExp_1 = tokensToRegExp;

	/**
	 * The main path matching regexp utility.
	 *
	 * @type {RegExp}
	 */
	var PATH_REGEXP = new RegExp([
		// Match escaped characters that would otherwise appear in future matches.
		// This allows the user to escape special characters that won't transform.
		'(\\\\.)',
		// Match Express-style parameters and un-named parameters with a prefix
		// and optional suffixes. Matches appear as:
		//
		// "/:test(\\d+)?" => ["/", "test", "\d+", undefined, "?", undefined]
		// "/route(\\d+)"  => [undefined, undefined, undefined, "\d+", undefined, undefined]
		// "/*"            => ["/", undefined, undefined, undefined, undefined, "*"]
		'([\\/.])?(?:(?:\\:(\\w+)(?:\\(((?:\\\\.|[^\\\\()])+)\\))?|\\(((?:\\\\.|[^\\\\()])+)\\))([+*?])?|(\\*))'
	].join('|'), 'g');

	/**
	 * Parse a string for the raw tokens.
	 *
	 * @param  {string}  str
	 * @param  {Object=} options
	 * @return {!Array}
	 */
	function parse(str, options) {
		var tokens = [];
		var key = 0;
		var index = 0;
		var path = '';
		var defaultDelimiter = options && options.delimiter || '/';
		var res;

		while ((res = PATH_REGEXP.exec(str)) != null) {
			var m = res[0];
			var escaped = res[1];
			var offset = res.index;
			path += str.slice(index, offset);
			index = offset + m.length;

			// Ignore already escaped sequences.
			if (escaped) {
				path += escaped[1];
				continue
			}

			var next = str[index];
			var prefix = res[2];
			var name = res[3];
			var capture = res[4];
			var group = res[5];
			var modifier = res[6];
			var asterisk = res[7];

			// Push the current path onto the tokens.
			if (path) {
				tokens.push(path);
				path = '';
			}

			var partial = prefix != null && next != null && next !== prefix;
			var repeat = modifier === '+' || modifier === '*';
			var optional = modifier === '?' || modifier === '*';
			var delimiter = res[2] || defaultDelimiter;
			var pattern = capture || group;

			tokens.push({
				name: name || key++,
				prefix: prefix || '',
				delimiter: delimiter,
				optional: optional,
				repeat: repeat,
				partial: partial,
				asterisk: !!asterisk,
				pattern: pattern ? escapeGroup(pattern) : (asterisk ? '.*' : '[^' + escapeString(delimiter) + ']+?')
			});
		}

		// Match any characters still remaining.
		if (index < str.length) {
			path += str.substr(index);
		}

		// If the path exists, push it onto the end.
		if (path) {
			tokens.push(path);
		}

		return tokens
	}

	/**
	 * Compile a string to a template function for the path.
	 *
	 * @param  {string}             str
	 * @param  {Object=}            options
	 * @return {!function(Object=, Object=)}
	 */
	function compile(str, options) {
		return tokensToFunction(parse(str, options))
	}

	/**
	 * Prettier encoding of URI path segments.
	 *
	 * @param  {string}
	 * @return {string}
	 */
	function encodeURIComponentPretty(str) {
		return encodeURI(str).replace(/[\/?#]/g, function(c) {
			return '%' + c.charCodeAt(0).toString(16).toUpperCase()
		})
	}

	/**
	 * Encode the asterisk parameter. Similar to `pretty`, but allows slashes.
	 *
	 * @param  {string}
	 * @return {string}
	 */
	function encodeAsterisk(str) {
		return encodeURI(str).replace(/[?#]/g, function(c) {
			return '%' + c.charCodeAt(0).toString(16).toUpperCase()
		})
	}

	/**
	 * Expose a method for transforming tokens into the path function.
	 */
	function tokensToFunction(tokens) {
		// Compile all the tokens into regexps.
		var matches = new Array(tokens.length);

		// Compile all the patterns before compilation.
		for (var i = 0; i < tokens.length; i++) {
			if (typeof tokens[i] === 'object') {
				matches[i] = new RegExp('^(?:' + tokens[i].pattern + ')$');
			}
		}

		return function(obj, opts) {
			var path = '';
			var data = obj || {};
			var options = opts || {};
			var encode = options.pretty ? encodeURIComponentPretty : encodeURIComponent;

			for (var i = 0; i < tokens.length; i++) {
				var token = tokens[i];

				if (typeof token === 'string') {
					path += token;

					continue
				}

				var value = data[token.name];
				var segment;

				if (value == null) {
					if (token.optional) {
						// Prepend partial segment prefixes.
						if (token.partial) {
							path += token.prefix;
						}

						continue
					} else {
						throw new TypeError('Expected "' + token.name + '" to be defined')
					}
				}

				if (isarray(value)) {
					if (!token.repeat) {
						throw new TypeError('Expected "' + token.name + '" to not repeat, but received `' + JSON.stringify(value) +
							'`')
					}

					if (value.length === 0) {
						if (token.optional) {
							continue
						} else {
							throw new TypeError('Expected "' + token.name + '" to not be empty')
						}
					}

					for (var j = 0; j < value.length; j++) {
						segment = encode(value[j]);

						if (!matches[i].test(segment)) {
							throw new TypeError('Expected all "' + token.name + '" to match "' + token.pattern + '", but received `' +
								JSON.stringify(segment) + '`')
						}

						path += (j === 0 ? token.prefix : token.delimiter) + segment;
					}

					continue
				}

				segment = token.asterisk ? encodeAsterisk(value) : encode(value);

				if (!matches[i].test(segment)) {
					throw new TypeError('Expected "' + token.name + '" to match "' + token.pattern + '", but received "' + segment +
						'"')
				}

				path += token.prefix + segment;
			}

			return path
		}
	}

	/**
	 * Escape a regular expression string.
	 *
	 * @param  {string} str
	 * @return {string}
	 */
	function escapeString(str) {
		return str.replace(/([.+*?=^!:${}()[\]|\/\\])/g, '\\$1')
	}

	/**
	 * Escape the capturing group by escaping special characters and meaning.
	 *
	 * @param  {string} group
	 * @return {string}
	 */
	function escapeGroup(group) {
		return group.replace(/([=!:$\/()])/g, '\\$1')
	}

	/**
	 * Attach the keys as a property of the regexp.
	 *
	 * @param  {!RegExp} re
	 * @param  {Array}   keys
	 * @return {!RegExp}
	 */
	function attachKeys(re, keys) {
		re.keys = keys;
		return re
	}

	/**
	 * Get the flags for a regexp from the options.
	 *
	 * @param  {Object} options
	 * @return {string}
	 */
	function flags(options) {
		return options.sensitive ? '' : 'i'
	}

	/**
	 * Pull out keys from a regexp.
	 *
	 * @param  {!RegExp} path
	 * @param  {!Array}  keys
	 * @return {!RegExp}
	 */
	function regexpToRegexp(path, keys) {
		// Use a negative lookahead to match only capturing groups.
		var groups = path.source.match(/\((?!\?)/g);

		if (groups) {
			for (var i = 0; i < groups.length; i++) {
				keys.push({
					name: i,
					prefix: null,
					delimiter: null,
					optional: false,
					repeat: false,
					partial: false,
					asterisk: false,
					pattern: null
				});
			}
		}

		return attachKeys(path, keys)
	}

	/**
	 * Transform an array into a regexp.
	 *
	 * @param  {!Array}  path
	 * @param  {Array}   keys
	 * @param  {!Object} options
	 * @return {!RegExp}
	 */
	function arrayToRegexp(path, keys, options) {
		var parts = [];

		for (var i = 0; i < path.length; i++) {
			parts.push(pathToRegexp(path[i], keys, options).source);
		}

		var regexp = new RegExp('(?:' + parts.join('|') + ')', flags(options));

		return attachKeys(regexp, keys)
	}

	/**
	 * Create a path regexp from string input.
	 *
	 * @param  {string}  path
	 * @param  {!Array}  keys
	 * @param  {!Object} options
	 * @return {!RegExp}
	 */
	function stringToRegexp(path, keys, options) {
		return tokensToRegExp(parse(path, options), keys, options)
	}

	/**
	 * Expose a function for taking tokens and returning a RegExp.
	 *
	 * @param  {!Array}          tokens
	 * @param  {(Array|Object)=} keys
	 * @param  {Object=}         options
	 * @return {!RegExp}
	 */
	function tokensToRegExp(tokens, keys, options) {
		if (!isarray(keys)) {
			options = /** @type {!Object} */ (keys || options);
			keys = [];
		}

		options = options || {};

		var strict = options.strict;
		var end = options.end !== false;
		var route = '';

		// Iterate over the tokens and create our regexp string.
		for (var i = 0; i < tokens.length; i++) {
			var token = tokens[i];

			if (typeof token === 'string') {
				route += escapeString(token);
			} else {
				var prefix = escapeString(token.prefix);
				var capture = '(?:' + token.pattern + ')';

				keys.push(token);

				if (token.repeat) {
					capture += '(?:' + prefix + capture + ')*';
				}

				if (token.optional) {
					if (!token.partial) {
						capture = '(?:' + prefix + '(' + capture + '))?';
					} else {
						capture = prefix + '(' + capture + ')?';
					}
				} else {
					capture = prefix + '(' + capture + ')';
				}

				route += capture;
			}
		}

		var delimiter = escapeString(options.delimiter || '/');
		var endsWithDelimiter = route.slice(-delimiter.length) === delimiter;

		// In non-strict mode we allow a slash at the end of match. If the path to
		// match already ends with a slash, we remove it for consistency. The slash
		// is valid at the end of a path match, not in the middle. This is important
		// in non-ending mode, where "/test/" shouldn't match "/test//route".
		if (!strict) {
			route = (endsWithDelimiter ? route.slice(0, -delimiter.length) : route) + '(?:' + delimiter + '(?=$))?';
		}

		if (end) {
			route += '$';
		} else {
			// In non-ending mode, we need the capturing groups to match as much as
			// possible by using a positive lookahead to the end or next path segment.
			route += strict && endsWithDelimiter ? '' : '(?=' + delimiter + '|$)';
		}

		return attachKeys(new RegExp('^' + route, flags(options)), keys)
	}

	/**
	 * Normalize the given path string, returning a regular expression.
	 *
	 * An empty array can be passed in for the keys, which will hold the
	 * placeholder key descriptions. For example, using `/user/:id`, `keys` will
	 * contain `[{ name: 'id', delimiter: '/', optional: false, repeat: false }]`.
	 *
	 * @param  {(string|RegExp|Array)} path
	 * @param  {(Array|Object)=}       keys
	 * @param  {Object=}               options
	 * @return {!RegExp}
	 */
	function pathToRegexp(path, keys, options) {
		if (!isarray(keys)) {
			options = /** @type {!Object} */ (keys || options);
			keys = [];
		}

		options = options || {};

		if (path instanceof RegExp) {
			return regexpToRegexp(path, /** @type {!Array} */ (keys))
		}

		if (isarray(path)) {
			return arrayToRegexp( /** @type {!Array} */ (path), /** @type {!Array} */ (keys), options)
		}

		return stringToRegexp( /** @type {string} */ (path), /** @type {!Array} */ (keys), options)
	}
	pathToRegexp_1.parse = parse_1;
	pathToRegexp_1.compile = compile_1;
	pathToRegexp_1.tokensToFunction = tokensToFunction_1;
	pathToRegexp_1.tokensToRegExp = tokensToRegExp_1;

	/*  */

	// $flow-disable-line
	var regexpCompileCache = Object.create(null);

	function fillParams(
		path,
		params,
		routeMsg
	) {
		params = params || {};
		try {
			var filler =
				regexpCompileCache[path] ||
				(regexpCompileCache[path] = pathToRegexp_1.compile(path));

			// Fix #2505 resolving asterisk routes { name: 'not-found', params: { pathMatch: '/not-found' }}
			if (params.pathMatch) {
				params[0] = params.pathMatch;
			}

			return filler(params, {
				pretty: true
			})
		} catch (e) {
			{
				warn(false, ("missing param for " + routeMsg + ": " + (e.message)));
			}
			return ''
		} finally {
			// delete the 0 if it was added
			delete params[0];
		}
	}

	/*  */

	function createRouteMap(
		routes,
		oldPathList,
		oldPathMap,
		oldNameMap
	) {
		// the path list is used to control path matching priority
		var pathList = oldPathList || [];
		// $flow-disable-line
		var pathMap = oldPathMap || Object.create(null);
		// $flow-disable-line
		var nameMap = oldNameMap || Object.create(null);

		routes.forEach(function(route) {
			addRouteRecord(pathList, pathMap, nameMap, route);
		});

		// ensure wildcard routes are always at the end
		for (var i = 0, l = pathList.length; i < l; i++) {
			if (pathList[i] === '*') {
				pathList.push(pathList.splice(i, 1)[0]);
				l--;
				i--;
			}
		}

		return {
			pathList: pathList,
			pathMap: pathMap,
			nameMap: nameMap
		}
	}

	function addRouteRecord(
		pathList,
		pathMap,
		nameMap,
		route,
		parent,
		matchAs
	) {
		var path = route.path;
		var name = route.name; {
			assert(path != null, "\"path\" is required in a route configuration.");
			assert(
				typeof route.component !== 'string',
				"route config \"component\" for path: " + (String(path || name)) + " cannot be a " +
				"string id. Use an actual component instead."
			);
		}

		var pathToRegexpOptions = route.pathToRegexpOptions || {};
		var normalizedPath = normalizePath(
			path,
			parent,
			pathToRegexpOptions.strict
		);

		if (typeof route.caseSensitive === 'boolean') {
			pathToRegexpOptions.sensitive = route.caseSensitive;
		}

		var record = {
			path: normalizedPath,
			regex: compileRouteRegex(normalizedPath, pathToRegexpOptions),
			components: route.components || {
				default: route.component
			},
			instances: {},
			name: name,
			parent: parent,
			matchAs: matchAs,
			redirect: route.redirect,
			beforeEnter: route.beforeEnter,
			meta: route.meta || {},
			props: route.props == null ?
				{} :
				route.components ?
				route.props :
				{
					default: route.props
				}
		};

		if (route.children) {
			// Warn if route is named, does not redirect and has a default child route.
			// If users navigate to this route by name, the default child will
			// not be rendered (GH Issue #629)
			{
				if (route.name && !route.redirect && route.children.some(function(child) {
						return /^\/?$/.test(child.path);
					})) {
					warn(
						false,
						"Named Route '" + (route.name) + "' has a default child route. " +
						"When navigating to this named route (:to=\"{name: '" + (route.name) + "'\"), " +
						"the default child route will not be rendered. Remove the name from " +
						"this route and use the name of the default child route for named " +
						"links instead."
					);
				}
			}
			route.children.forEach(function(child) {
				var childMatchAs = matchAs ?
					cleanPath((matchAs + "/" + (child.path))) :
					undefined;
				addRouteRecord(pathList, pathMap, nameMap, child, record, childMatchAs);
			});
		}

		if (route.alias !== undefined) {
			var aliases = Array.isArray(route.alias) ?
				route.alias :
				[route.alias];

			aliases.forEach(function(alias) {
				var aliasRoute = {
					path: alias,
					children: route.children
				};
				addRouteRecord(
					pathList,
					pathMap,
					nameMap,
					aliasRoute,
					parent,
					record.path || '/' // matchAs
				);
			});
		}

		if (!pathMap[record.path]) {
			pathList.push(record.path);
			pathMap[record.path] = record;
		}

		if (name) {
			if (!nameMap[name]) {
				nameMap[name] = record;
			} else if ("development" !== 'production' && !matchAs) {
				warn(
					false,
					"Duplicate named routes definition: " +
					"{ name: \"" + name + "\", path: \"" + (record.path) + "\" }"
				);
			}
		}
	}

	function compileRouteRegex(path, pathToRegexpOptions) {
		var regex = pathToRegexp_1(path, [], pathToRegexpOptions); {
			var keys = Object.create(null);
			regex.keys.forEach(function(key) {
				warn(!keys[key.name], ("Duplicate param keys in route with path: \"" + path + "\""));
				keys[key.name] = true;
			});
		}
		return regex
	}

	function normalizePath(path, parent, strict) {
		if (!strict) {
			path = path.replace(/\/$/, '');
		}
		if (path[0] === '/') {
			return path
		}
		if (parent == null) {
			return path
		}
		return cleanPath(((parent.path) + "/" + path))
	}

	/*  */

	function normalizeLocation(
		raw,
		current,
		append,
		router
	) {
		var next = typeof raw === 'string' ? {
			path: raw
		} : raw;
		// named target
		if (next._normalized) {
			return next
		} else if (next.name) {
			return extend({}, raw)
		}

		// relative params
		if (!next.path && next.params && current) {
			next = extend({}, next);
			next._normalized = true;
			var params = extend(extend({}, current.params), next.params);
			if (current.name) {
				next.name = current.name;
				next.params = params;
			} else if (current.matched.length) {
				var rawPath = current.matched[current.matched.length - 1].path;
				next.path = fillParams(rawPath, params, ("path " + (current.path)));
			} else {
				warn(false, "relative params navigation requires a current route.");
			}
			return next
		}

		var parsedPath = parsePath(next.path || '');
		var basePath = (current && current.path) || '/';
		var path = parsedPath.path ?
			resolvePath(parsedPath.path, basePath, append || next.append) :
			basePath;

		var query = resolveQuery(
			parsedPath.query,
			next.query,
			router && router.options.parseQuery
		);

		var hash = next.hash || parsedPath.hash;
		if (hash && hash.charAt(0) !== '#') {
			hash = "#" + hash;
		}

		return {
			_normalized: true,
			path: path,
			query: query,
			hash: hash
		}
	}

	/*  */



	function createMatcher(
		routes,
		router
	) {
		var ref = createRouteMap(routes);
		var pathList = ref.pathList;
		var pathMap = ref.pathMap;
		var nameMap = ref.nameMap;

		function addRoutes(routes) {
			createRouteMap(routes, pathList, pathMap, nameMap);
		}

		function match(
			raw,
			currentRoute,
			redirectedFrom
		) {
			var location = normalizeLocation(raw, currentRoute, false, router);
			var name = location.name;

			if (name) {
				var record = nameMap[name]; {
					warn(record, ("Route with name '" + name + "' does not exist"));
				}
				if (!record) {
					return _createRoute(null, location)
				}
				var paramNames = record.regex.keys
					.filter(function(key) {
						return !key.optional;
					})
					.map(function(key) {
						return key.name;
					});

				if (typeof location.params !== 'object') {
					location.params = {};
				}

				if (currentRoute && typeof currentRoute.params === 'object') {
					for (var key in currentRoute.params) {
						if (!(key in location.params) && paramNames.indexOf(key) > -1) {
							location.params[key] = currentRoute.params[key];
						}
					}
				}

				if (record) {
					location.path = fillParams(record.path, location.params, ("named route \"" + name + "\""));
					return _createRoute(record, location, redirectedFrom)
				}
			} else if (location.path) {
				location.params = {};
				for (var i = 0; i < pathList.length; i++) {
					var path = pathList[i];
					var record$1 = pathMap[path];
					if (matchRoute(record$1.regex, location.path, location.params)) {
						return _createRoute(record$1, location, redirectedFrom)
					}
				}
			}
			// no match
			return _createRoute(null, location)
		}

		function redirect(
			record,
			location
		) {
			var originalRedirect = record.redirect;
			var redirect = typeof originalRedirect === 'function' ?
				originalRedirect(createRoute(record, location, null, router)) :
				originalRedirect;

			if (typeof redirect === 'string') {
				redirect = {
					path: redirect
				};
			}

			if (!redirect || typeof redirect !== 'object') {
				{
					warn(
						false, ("invalid redirect option: " + (JSON.stringify(redirect)))
					);
				}
				return _createRoute(null, location)
			}

			var re = redirect;
			var name = re.name;
			var path = re.path;
			var query = location.query;
			var hash = location.hash;
			var params = location.params;
			query = re.hasOwnProperty('query') ? re.query : query;
			hash = re.hasOwnProperty('hash') ? re.hash : hash;
			params = re.hasOwnProperty('params') ? re.params : params;

			if (name) {
				// resolved named direct
				var targetRecord = nameMap[name]; {
					assert(targetRecord, ("redirect failed: named route \"" + name + "\" not found."));
				}
				return match({
					_normalized: true,
					name: name,
					query: query,
					hash: hash,
					params: params
				}, undefined, location)
			} else if (path) {
				// 1. resolve relative redirect
				var rawPath = resolveRecordPath(path, record);
				// 2. resolve params
				var resolvedPath = fillParams(rawPath, params, ("redirect route with path \"" + rawPath + "\""));
				// 3. rematch with existing query and hash
				return match({
					_normalized: true,
					path: resolvedPath,
					query: query,
					hash: hash
				}, undefined, location)
			} else {
				{
					warn(false, ("invalid redirect option: " + (JSON.stringify(redirect))));
				}
				return _createRoute(null, location)
			}
		}

		function alias(
			record,
			location,
			matchAs
		) {
			var aliasedPath = fillParams(matchAs, location.params, ("aliased route with path \"" + matchAs + "\""));
			var aliasedMatch = match({
				_normalized: true,
				path: aliasedPath
			});
			if (aliasedMatch) {
				var matched = aliasedMatch.matched;
				var aliasedRecord = matched[matched.length - 1];
				location.params = aliasedMatch.params;
				return _createRoute(aliasedRecord, location)
			}
			return _createRoute(null, location)
		}

		function _createRoute(
			record,
			location,
			redirectedFrom
		) {
			if (record && record.redirect) {
				return redirect(record, redirectedFrom || location)
			}
			if (record && record.matchAs) {
				return alias(record, location, record.matchAs)
			}
			return createRoute(record, location, redirectedFrom, router)
		}

		return {
			match: match,
			addRoutes: addRoutes
		}
	}

	function matchRoute(
		regex,
		path,
		params
	) {
		var m = path.match(regex);

		if (!m) {
			return false
		} else if (!params) {
			return true
		}

		for (var i = 1, len = m.length; i < len; ++i) {
			var key = regex.keys[i - 1];
			var val = typeof m[i] === 'string' ? decodeURIComponent(m[i]) : m[i];
			if (key) {
				// Fix #1994: using * with props: true generates a param named 0
				params[key.name || 'pathMatch'] = val;
			}
		}

		return true
	}

	function resolveRecordPath(path, record) {
		return resolvePath(path, record.parent ? record.parent.path : '/', true)
	}

	/*  */

	var positionStore = Object.create(null);

	function setupScroll() {
		// Fix for #1585 for Firefox
		// Fix for #2195 Add optional third attribute to workaround a bug in safari https://bugs.webkit.org/show_bug.cgi?id=182678
		window.history.replaceState({
			key: getStateKey()
		}, '', window.location.href.replace(window.location.origin, ''));
		window.addEventListener('popstate', function(e) {
			saveScrollPosition();
			if (e.state && e.state.key) {
				setStateKey(e.state.key);
			}
		});
	}

	function handleScroll(
		router,
		to,
		from,
		isPop
	) {
		if (!router.app) {
			return
		}

		var behavior = router.options.scrollBehavior;
		if (!behavior) {
			return
		}

		{
			assert(typeof behavior === 'function', "scrollBehavior must be a function");
		}

		// wait until re-render finishes before scrolling
		router.app.$nextTick(function() {
			var position = getScrollPosition();
			var shouldScroll = behavior.call(router, to, from, isPop ? position : null);

			if (!shouldScroll) {
				return
			}

			if (typeof shouldScroll.then === 'function') {
				shouldScroll.then(function(shouldScroll) {
					scrollToPosition((shouldScroll), position);
				}).catch(function(err) {
					{
						assert(false, err.toString());
					}
				});
			} else {
				scrollToPosition(shouldScroll, position);
			}
		});
	}

	function saveScrollPosition() {
		var key = getStateKey();
		if (key) {
			positionStore[key] = {
				x: window.pageXOffset,
				y: window.pageYOffset
			};
		}
	}

	function getScrollPosition() {
		var key = getStateKey();
		if (key) {
			return positionStore[key]
		}
	}

	function getElementPosition(el, offset) {
		var docEl = document.documentElement;
		var docRect = docEl.getBoundingClientRect();
		var elRect = el.getBoundingClientRect();
		return {
			x: elRect.left - docRect.left - offset.x,
			y: elRect.top - docRect.top - offset.y
		}
	}

	function isValidPosition(obj) {
		return isNumber(obj.x) || isNumber(obj.y)
	}

	function normalizePosition(obj) {
		return {
			x: isNumber(obj.x) ? obj.x : window.pageXOffset,
			y: isNumber(obj.y) ? obj.y : window.pageYOffset
		}
	}

	function normalizeOffset(obj) {
		return {
			x: isNumber(obj.x) ? obj.x : 0,
			y: isNumber(obj.y) ? obj.y : 0
		}
	}

	function isNumber(v) {
		return typeof v === 'number'
	}

	function scrollToPosition(shouldScroll, position) {
		var isObject = typeof shouldScroll === 'object';
		if (isObject && typeof shouldScroll.selector === 'string') {
			var el = document.querySelector(shouldScroll.selector);
			if (el) {
				var offset = shouldScroll.offset && typeof shouldScroll.offset === 'object' ? shouldScroll.offset : {};
				offset = normalizeOffset(offset);
				position = getElementPosition(el, offset);
			} else if (isValidPosition(shouldScroll)) {
				position = normalizePosition(shouldScroll);
			}
		} else if (isObject && isValidPosition(shouldScroll)) {
			position = normalizePosition(shouldScroll);
		}

		if (position) {
			window.scrollTo(position.x, position.y);
		}
	}

	/*  */

	var supportsPushState = inBrowser && (function() {
		var ua = window.navigator.userAgent;

		if (
			(ua.indexOf('Android 2.') !== -1 || ua.indexOf('Android 4.0') !== -1) &&
			ua.indexOf('Mobile Safari') !== -1 &&
			ua.indexOf('Chrome') === -1 &&
			ua.indexOf('Windows Phone') === -1
		) {
			return false
		}

		return window.history && 'pushState' in window.history
	})();

	// use User Timing api (if present) for more accurate key precision
	var Time = inBrowser && window.performance && window.performance.now ?
		window.performance :
		Date;

	var _key = genKey();

	function genKey() {
		return Time.now().toFixed(3)
	}

	function getStateKey() {
		return _key
	}

	function setStateKey(key) {
		_key = key;
	}

	function pushState(url, replace) {
		saveScrollPosition();
		// try...catch the pushState call to get around Safari
		// DOM Exception 18 where it limits to 100 pushState calls
		var history = window.history;
		try {
			if (replace) {
				history.replaceState({
					key: _key
				}, '', url);
			} else {
				_key = genKey();
				history.pushState({
					key: _key
				}, '', url);
			}
		} catch (e) {
			window.location[replace ? 'replace' : 'assign'](url);
		}
	}

	function replaceState(url) {
		pushState(url, true);
	}

	/*  */

	function runQueue(queue, fn, cb) {
		var step = function(index) {
			if (index >= queue.length) {
				cb();
			} else {
				if (queue[index]) {
					fn(queue[index], function() {
						step(index + 1);
					});
				} else {
					step(index + 1);
				}
			}
		};
		step(0);
	}

	/*  */

	function resolveAsyncComponents(matched) {
		return function(to, from, next) {
			var hasAsync = false;
			var pending = 0;
			var error = null;

			flatMapComponents(matched, function(def, _, match, key) {
				// if it's a function and doesn't have cid attached,
				// assume it's an async component resolve function.
				// we are not using Vue's default async resolving mechanism because
				// we want to halt the navigation until the incoming component has been
				// resolved.
				if (typeof def === 'function' && def.cid === undefined) {
					hasAsync = true;
					pending++;

					var resolve = once(function(resolvedDef) {
						if (isESModule(resolvedDef)) {
							resolvedDef = resolvedDef.default;
						}
						// save resolved on async factory in case it's used elsewhere
						def.resolved = typeof resolvedDef === 'function' ?
							resolvedDef :
							_Vue.extend(resolvedDef);
						match.components[key] = resolvedDef;
						pending--;
						if (pending <= 0) {
							next();
						}
					});

					var reject = once(function(reason) {
						var msg = "Failed to resolve async component " + key + ": " + reason;
						"development" !== 'production' && warn(false, msg);
						if (!error) {
							error = isError(reason) ?
								reason :
								new Error(msg);
							next(error);
						}
					});

					var res;
					try {
						res = def(resolve, reject);
					} catch (e) {
						reject(e);
					}
					if (res) {
						if (typeof res.then === 'function') {
							res.then(resolve, reject);
						} else {
							// new syntax in Vue 2.3
							var comp = res.component;
							if (comp && typeof comp.then === 'function') {
								comp.then(resolve, reject);
							}
						}
					}
				}
			});

			if (!hasAsync) {
				next();
			}
		}
	}

	function flatMapComponents(
		matched,
		fn
	) {
		return flatten(matched.map(function(m) {
			return Object.keys(m.components).map(function(key) {
				return fn(
					m.components[key],
					m.instances[key],
					m, key
				);
			})
		}))
	}

	function flatten(arr) {
		return Array.prototype.concat.apply([], arr)
	}

	var hasSymbol =
		typeof Symbol === 'function' &&
		typeof Symbol.toStringTag === 'symbol';

	function isESModule(obj) {
		return obj.__esModule || (hasSymbol && obj[Symbol.toStringTag] === 'Module')
	}

	// in Webpack 2, require.ensure now also returns a Promise
	// so the resolve/reject functions may get called an extra time
	// if the user uses an arrow function shorthand that happens to
	// return that Promise.
	function once(fn) {
		var called = false;
		return function() {
			var args = [],
				len = arguments.length;
			while (len--) args[len] = arguments[len];

			if (called) {
				return
			}
			called = true;
			return fn.apply(this, args)
		}
	}

	/*  */

	var History = function History(router, base) {
		this.router = router;
		this.base = normalizeBase(base);
		// start with a route object that stands for "nowhere"
		this.current = START;
		this.pending = null;
		this.ready = false;
		this.readyCbs = [];
		this.readyErrorCbs = [];
		this.errorCbs = [];
	};

	History.prototype.listen = function listen(cb) {
		this.cb = cb;
	};

	History.prototype.onReady = function onReady(cb, errorCb) {
		if (this.ready) {
			cb();
		} else {
			this.readyCbs.push(cb);
			if (errorCb) {
				this.readyErrorCbs.push(errorCb);
			}
		}
	};

	History.prototype.onError = function onError(errorCb) {
		this.errorCbs.push(errorCb);
	};

	History.prototype.transitionTo = function transitionTo(location, onComplete, onAbort) {
		var this$1 = this;

		var route = this.router.match(location, this.current);
		this.confirmTransition(route, function() {
			this$1.updateRoute(route);
			onComplete && onComplete(route);
			this$1.ensureURL();

			// fire ready cbs once
			if (!this$1.ready) {
				this$1.ready = true;
				this$1.readyCbs.forEach(function(cb) {
					cb(route);
				});
			}
		}, function(err) {
			if (onAbort) {
				onAbort(err);
			}
			if (err && !this$1.ready) {
				this$1.ready = true;
				this$1.readyErrorCbs.forEach(function(cb) {
					cb(err);
				});
			}
		});
	};

	History.prototype.confirmTransition = function confirmTransition(route, onComplete, onAbort) {
		var this$1 = this;

		var current = this.current;
		var abort = function(err) {
			if (isError(err)) {
				if (this$1.errorCbs.length) {
					this$1.errorCbs.forEach(function(cb) {
						cb(err);
					});
				} else {
					warn(false, 'uncaught error during route navigation:');
					console.error(err);
				}
			}
			onAbort && onAbort(err);
		};
		if (
			isSameRoute(route, current) &&
			// in the case the route map has been dynamically appended to
			route.matched.length === current.matched.length
		) {
			this.ensureURL();
			return abort()
		}

		var ref = resolveQueue(this.current.matched, route.matched);
		var updated = ref.updated;
		var deactivated = ref.deactivated;
		var activated = ref.activated;

		var queue = [].concat(
			// in-component leave guards
			extractLeaveGuards(deactivated),
			// global before hooks
			this.router.beforeHooks,
			// in-component update hooks
			extractUpdateHooks(updated),
			// in-config enter guards
			activated.map(function(m) {
				return m.beforeEnter;
			}),
			// async components
			resolveAsyncComponents(activated)
		);

		this.pending = route;
		var iterator = function(hook, next) {
			if (this$1.pending !== route) {
				return abort()
			}
			try {
				hook(route, current, function(to) {
					if (to === false || isError(to)) {
						// next(false) -> abort navigation, ensure current URL
						this$1.ensureURL(true);
						abort(to);
					} else if (
						typeof to === 'string' ||
						(typeof to === 'object' && (
							typeof to.path === 'string' ||
							typeof to.name === 'string'
						))
					) {
						// next('/') or next({ path: '/' }) -> redirect
						abort();
						if (typeof to === 'object' && to.replace) {
							this$1.replace(to);
						} else {
							this$1.push(to);
						}
					} else {
						// confirm transition and pass on the value
						next(to);
					}
				});
			} catch (e) {
				abort(e);
			}
		};

		runQueue(queue, iterator, function() {
			var postEnterCbs = [];
			var isValid = function() {
				return this$1.current === route;
			};
			// wait until async components are resolved before
			// extracting in-component enter guards
			var enterGuards = extractEnterGuards(activated, postEnterCbs, isValid);
			var queue = enterGuards.concat(this$1.router.resolveHooks);
			runQueue(queue, iterator, function() {
				if (this$1.pending !== route) {
					return abort()
				}
				this$1.pending = null;
				onComplete(route);
				if (this$1.router.app) {
					this$1.router.app.$nextTick(function() {
						postEnterCbs.forEach(function(cb) {
							cb();
						});
					});
				}
			});
		});
	};

	History.prototype.updateRoute = function updateRoute(route) {
		var prev = this.current;
		this.current = route;
		this.cb && this.cb(route);
		this.router.afterHooks.forEach(function(hook) {
			hook && hook(route, prev);
		});
	};

	function normalizeBase(base) {
		if (!base) {
			if (inBrowser) {
				// respect <base> tag
				var baseEl = document.querySelector('base');
				base = (baseEl && baseEl.getAttribute('href')) || '/';
				// strip full URL origin
				base = base.replace(/^https?:\/\/[^\/]+/, '');
			} else {
				base = '/';
			}
		}
		// make sure there's the starting slash
		if (base.charAt(0) !== '/') {
			base = '/' + base;
		}
		// remove trailing slash
		return base.replace(/\/$/, '')
	}

	function resolveQueue(
		current,
		next
	) {
		var i;
		var max = Math.max(current.length, next.length);
		for (i = 0; i < max; i++) {
			if (current[i] !== next[i]) {
				break
			}
		}
		return {
			updated: next.slice(0, i),
			activated: next.slice(i),
			deactivated: current.slice(i)
		}
	}

	function extractGuards(
		records,
		name,
		bind,
		reverse
	) {
		var guards = flatMapComponents(records, function(def, instance, match, key) {
			var guard = extractGuard(def, name);
			if (guard) {
				return Array.isArray(guard) ?
					guard.map(function(guard) {
						return bind(guard, instance, match, key);
					}) :
					bind(guard, instance, match, key)
			}
		});
		return flatten(reverse ? guards.reverse() : guards)
	}

	function extractGuard(
		def,
		key
	) {
		if (typeof def !== 'function') {
			// extend now so that global mixins are applied.
			def = _Vue.extend(def);
		}
		return def.options[key]
	}

	function extractLeaveGuards(deactivated) {
		return extractGuards(deactivated, 'beforeRouteLeave', bindGuard, true)
	}

	function extractUpdateHooks(updated) {
		return extractGuards(updated, 'beforeRouteUpdate', bindGuard)
	}

	function bindGuard(guard, instance) {
		if (instance) {
			return function boundRouteGuard() {
				return guard.apply(instance, arguments)
			}
		}
	}

	function extractEnterGuards(
		activated,
		cbs,
		isValid
	) {
		return extractGuards(activated, 'beforeRouteEnter', function(guard, _, match, key) {
			return bindEnterGuard(guard, match, key, cbs, isValid)
		})
	}

	function bindEnterGuard(
		guard,
		match,
		key,
		cbs,
		isValid
	) {
		return function routeEnterGuard(to, from, next) {
			return guard(to, from, function(cb) {
				next(cb);
				if (typeof cb === 'function') {
					cbs.push(function() {
						// #750
						// if a router-view is wrapped with an out-in transition,
						// the instance may not have been registered at this time.
						// we will need to poll for registration until current route
						// is no longer valid.
						poll(cb, match.instances, key, isValid);
					});
				}
			})
		}
	}

	function poll(
		cb, // somehow flow cannot infer this is a function
		instances,
		key,
		isValid
	) {
		if (
			instances[key] &&
			!instances[key]._isBeingDestroyed // do not reuse being destroyed instance
		) {
			cb(instances[key]);
		} else if (isValid()) {
			setTimeout(function() {
				poll(cb, instances, key, isValid);
			}, 16);
		}
	}

	/*  */

	var HTML5History = /*@__PURE__*/ (function(History$$1) {
		function HTML5History(router, base) {
			var this$1 = this;

			History$$1.call(this, router, base);

			var expectScroll = router.options.scrollBehavior;
			var supportsScroll = supportsPushState && expectScroll;

			if (supportsScroll) {
				setupScroll();
			}

			var initLocation = getLocation(this.base);
			window.addEventListener('popstate', function(e) {
				var current = this$1.current;

				// Avoiding first `popstate` event dispatched in some browsers but first
				// history route not updated since async guard at the same time.
				var location = getLocation(this$1.base);
				if (this$1.current === START && location === initLocation) {
					return
				}

				this$1.transitionTo(location, function(route) {
					if (supportsScroll) {
						handleScroll(router, route, current, true);
					}
				});
			});
		}

		if (History$$1) HTML5History.__proto__ = History$$1;
		HTML5History.prototype = Object.create(History$$1 && History$$1.prototype);
		HTML5History.prototype.constructor = HTML5History;

		HTML5History.prototype.go = function go(n) {
			window.history.go(n);
		};

		HTML5History.prototype.push = function push(location, onComplete, onAbort) {
			var this$1 = this;

			var ref = this;
			var fromRoute = ref.current;
			this.transitionTo(location, function(route) {
				pushState(cleanPath(this$1.base + route.fullPath));
				handleScroll(this$1.router, route, fromRoute, false);
				onComplete && onComplete(route);
			}, onAbort);
		};

		HTML5History.prototype.replace = function replace(location, onComplete, onAbort) {
			var this$1 = this;

			var ref = this;
			var fromRoute = ref.current;
			this.transitionTo(location, function(route) {
				replaceState(cleanPath(this$1.base + route.fullPath));
				handleScroll(this$1.router, route, fromRoute, false);
				onComplete && onComplete(route);
			}, onAbort);
		};

		HTML5History.prototype.ensureURL = function ensureURL(push) {
			if (getLocation(this.base) !== this.current.fullPath) {
				var current = cleanPath(this.base + this.current.fullPath);
				push ? pushState(current) : replaceState(current);
			}
		};

		HTML5History.prototype.getCurrentLocation = function getCurrentLocation() {
			return getLocation(this.base)
		};

		return HTML5History;
	}(History));

	function getLocation(base) {
		var path = decodeURI(window.location.pathname);
		if (base && path.indexOf(base) === 0) {
			path = path.slice(base.length);
		}
		return (path || '/') + window.location.search + window.location.hash
	}

	/*  */

	var HashHistory = /*@__PURE__*/ (function(History$$1) {
		function HashHistory(router, base, fallback) {
			History$$1.call(this, router, base);
			// check history fallback deeplinking
			if (fallback && checkFallback(this.base)) {
				return
			}
			ensureSlash();
		}

		if (History$$1) HashHistory.__proto__ = History$$1;
		HashHistory.prototype = Object.create(History$$1 && History$$1.prototype);
		HashHistory.prototype.constructor = HashHistory;

		// this is delayed until the app mounts
		// to avoid the hashchange listener being fired too early
		HashHistory.prototype.setupListeners = function setupListeners() {
			var this$1 = this;

			var router = this.router;
			var expectScroll = router.options.scrollBehavior;
			var supportsScroll = supportsPushState && expectScroll;

			if (supportsScroll) {
				setupScroll();
			}

			window.addEventListener(supportsPushState ? 'popstate' : 'hashchange', function() {
				var current = this$1.current;
				if (!ensureSlash()) {
					return
				}
				this$1.transitionTo(getHash(), function(route) {
					if (supportsScroll) {
						handleScroll(this$1.router, route, current, true);
					}
					if (!supportsPushState) {
						replaceHash(route.fullPath);
					}
				});
			});
		};

		HashHistory.prototype.push = function push(location, onComplete, onAbort) {
			var this$1 = this;

			var ref = this;
			var fromRoute = ref.current;
			this.transitionTo(location, function(route) {
				pushHash(route.fullPath);
				handleScroll(this$1.router, route, fromRoute, false);
				onComplete && onComplete(route);
			}, onAbort);
		};

		HashHistory.prototype.replace = function replace(location, onComplete, onAbort) {
			var this$1 = this;

			var ref = this;
			var fromRoute = ref.current;
			this.transitionTo(location, function(route) {
				replaceHash(route.fullPath);
				handleScroll(this$1.router, route, fromRoute, false);
				onComplete && onComplete(route);
			}, onAbort);
		};

		HashHistory.prototype.go = function go(n) {
			window.history.go(n);
		};

		HashHistory.prototype.ensureURL = function ensureURL(push) {
			var current = this.current.fullPath;
			if (getHash() !== current) {
				push ? pushHash(current) : replaceHash(current);
			}
		};

		HashHistory.prototype.getCurrentLocation = function getCurrentLocation() {
			return getHash()
		};

		return HashHistory;
	}(History));

	function checkFallback(base) {
		var location = getLocation(base);
		if (!/^\/#/.test(location)) {
			window.location.replace(
				cleanPath(base + '/#' + location)
			);
			return true
		}
	}

	function ensureSlash() {
		var path = getHash();
		if (path.charAt(0) === '/') {
			return true
		}
		replaceHash('/' + path);
		return false
	}

	function getHash() {
		// We can't use window.location.hash here because it's not
		// consistent across browsers - Firefox will pre-decode it!
		var href = window.location.href;
		var index = href.indexOf('#');
		// empty path
		if (index < 0) {
			return ''
		}

		href = href.slice(index + 1);
		// decode the hash but not the search or hash
		// as search(query) is already decoded
		// https://github.com/vuejs/vue-router/issues/2708
		var searchIndex = href.indexOf('?');
		if (searchIndex < 0) {
			var hashIndex = href.indexOf('#');
			if (hashIndex > -1) {
				href = decodeURI(href.slice(0, hashIndex)) + href.slice(hashIndex);
			} else {
				href = decodeURI(href);
			}
		} else {
			if (searchIndex > -1) {
				href = decodeURI(href.slice(0, searchIndex)) + href.slice(searchIndex);
			}
		}

		return href
	}

	function getUrl(path) {
		var href = window.location.href;
		var i = href.indexOf('#');
		var base = i >= 0 ? href.slice(0, i) : href;
		return (base + "#" + path)
	}

	function pushHash(path) {
		if (supportsPushState) {
			pushState(getUrl(path));
		} else {
			window.location.hash = path;
		}
	}

	function replaceHash(path) {
		if (supportsPushState) {
			replaceState(getUrl(path));
		} else {
			window.location.replace(getUrl(path));
		}
	}

	/*  */

	var AbstractHistory = /*@__PURE__*/ (function(History$$1) {
		function AbstractHistory(router, base) {
			History$$1.call(this, router, base);
			this.stack = [];
			this.index = -1;
		}

		if (History$$1) AbstractHistory.__proto__ = History$$1;
		AbstractHistory.prototype = Object.create(History$$1 && History$$1.prototype);
		AbstractHistory.prototype.constructor = AbstractHistory;

		AbstractHistory.prototype.push = function push(location, onComplete, onAbort) {
			var this$1 = this;

			this.transitionTo(location, function(route) {
				this$1.stack = this$1.stack.slice(0, this$1.index + 1).concat(route);
				this$1.index++;
				onComplete && onComplete(route);
			}, onAbort);
		};

		AbstractHistory.prototype.replace = function replace(location, onComplete, onAbort) {
			var this$1 = this;

			this.transitionTo(location, function(route) {
				this$1.stack = this$1.stack.slice(0, this$1.index).concat(route);
				onComplete && onComplete(route);
			}, onAbort);
		};

		AbstractHistory.prototype.go = function go(n) {
			var this$1 = this;

			var targetIndex = this.index + n;
			if (targetIndex < 0 || targetIndex >= this.stack.length) {
				return
			}
			var route = this.stack[targetIndex];
			this.confirmTransition(route, function() {
				this$1.index = targetIndex;
				this$1.updateRoute(route);
			});
		};

		AbstractHistory.prototype.getCurrentLocation = function getCurrentLocation() {
			var current = this.stack[this.stack.length - 1];
			return current ? current.fullPath : '/'
		};

		AbstractHistory.prototype.ensureURL = function ensureURL() {
			// noop
		};

		return AbstractHistory;
	}(History));

	/*  */



	var VueRouter = function VueRouter(options) {
		if (options === void 0) options = {};

		this.app = null;
		this.apps = [];
		this.options = options;
		this.beforeHooks = [];
		this.resolveHooks = [];
		this.afterHooks = [];
		this.matcher = createMatcher(options.routes || [], this);

		var mode = options.mode || 'hash';
		this.fallback = mode === 'history' && !supportsPushState && options.fallback !== false;
		if (this.fallback) {
			mode = 'hash';
		}
		if (!inBrowser) {
			mode = 'abstract';
		}
		this.mode = mode;

		switch (mode) {
			case 'history':
				this.history = new HTML5History(this, options.base);
				break
			case 'hash':
				this.history = new HashHistory(this, options.base, this.fallback);
				break
			case 'abstract':
				this.history = new AbstractHistory(this, options.base);
				break
			default:
				{
					assert(false, ("invalid mode: " + mode));
				}
		}
	};

	var prototypeAccessors = {
		currentRoute: {
			configurable: true
		}
	};

	VueRouter.prototype.match = function match(
		raw,
		current,
		redirectedFrom
	) {
		return this.matcher.match(raw, current, redirectedFrom)
	};

	prototypeAccessors.currentRoute.get = function() {
		return this.history && this.history.current
	};

	VueRouter.prototype.init = function init(app /* Vue component instance */ ) {
		var this$1 = this;

		"development" !== 'production' && assert(
			install.installed,
			"not installed. Make sure to call `Vue.use(VueRouter)` " +
			"before creating root instance."
		);

		this.apps.push(app);

		// set up app destroyed handler
		// https://github.com/vuejs/vue-router/issues/2639
		app.$once('hook:destroyed', function() {
			// clean out app from this.apps array once destroyed
			var index = this$1.apps.indexOf(app);
			if (index > -1) {
				this$1.apps.splice(index, 1);
			}
			// ensure we still have a main app or null if no apps
			// we do not release the router so it can be reused
			if (this$1.app === app) {
				this$1.app = this$1.apps[0] || null;
			}
		});

		// main app previously initialized
		// return as we don't need to set up new history listener
		if (this.app) {
			return
		}

		this.app = app;

		var history = this.history;

		if (history instanceof HTML5History) {
			history.transitionTo(history.getCurrentLocation());
		} else if (history instanceof HashHistory) {
			var setupHashListener = function() {
				history.setupListeners();
			};
			history.transitionTo(
				history.getCurrentLocation(),
				setupHashListener,
				setupHashListener
			);
		}

		history.listen(function(route) {
			this$1.apps.forEach(function(app) {
				app._route = route;
			});
		});
	};

	VueRouter.prototype.beforeEach = function beforeEach(fn) {
		return registerHook(this.beforeHooks, fn)
	};

	VueRouter.prototype.beforeResolve = function beforeResolve(fn) {
		return registerHook(this.resolveHooks, fn)
	};

	VueRouter.prototype.afterEach = function afterEach(fn) {
		return registerHook(this.afterHooks, fn)
	};

	VueRouter.prototype.onReady = function onReady(cb, errorCb) {
		this.history.onReady(cb, errorCb);
	};

	VueRouter.prototype.onError = function onError(errorCb) {
		this.history.onError(errorCb);
	};

	VueRouter.prototype.push = function push(location, onComplete, onAbort) {
		this.history.push(location, onComplete, onAbort);
	};

	VueRouter.prototype.replace = function replace(location, onComplete, onAbort) {
		this.history.replace(location, onComplete, onAbort);
	};

	VueRouter.prototype.go = function go(n) {
		this.history.go(n);
	};

	VueRouter.prototype.back = function back() {
		this.go(-1);
	};

	VueRouter.prototype.forward = function forward() {
		this.go(1);
	};

	VueRouter.prototype.getMatchedComponents = function getMatchedComponents(to) {
		var route = to ?
			to.matched ?
			to :
			this.resolve(to).route :
			this.currentRoute;
		if (!route) {
			return []
		}
		return [].concat.apply([], route.matched.map(function(m) {
			return Object.keys(m.components).map(function(key) {
				return m.components[key]
			})
		}))
	};

	VueRouter.prototype.resolve = function resolve(
		to,
		current,
		append
	) {
		current = current || this.history.current;
		var location = normalizeLocation(
			to,
			current,
			append,
			this
		);
		var route = this.match(location, current);
		var fullPath = route.redirectedFrom || route.fullPath;
		var base = this.history.base;
		var href = createHref(base, fullPath, this.mode);
		return {
			location: location,
			route: route,
			href: href,
			// for backwards compat
			normalizedTo: location,
			resolved: route
		}
	};

	VueRouter.prototype.addRoutes = function addRoutes(routes) {
		this.matcher.addRoutes(routes);
		if (this.history.current !== START) {
			this.history.transitionTo(this.history.getCurrentLocation());
		}
	};

	Object.defineProperties(VueRouter.prototype, prototypeAccessors);

	function registerHook(list, fn) {
		list.push(fn);
		return function() {
			var i = list.indexOf(fn);
			if (i > -1) {
				list.splice(i, 1);
			}
		}
	}

	function createHref(base, fullPath, mode) {
		var path = mode === 'hash' ? '#' + fullPath : fullPath;
		return base ? cleanPath(base + '/' + path) : path
	}

	VueRouter.install = install;
	VueRouter.version = '3.0.6';

	if (inBrowser && window.Vue) {
		window.Vue.use(VueRouter);
	}

	return VueRouter;

})));


/*!
 * vue-resource v1.5.1
 * https://github.com/pagekit/vue-resource
 * Released under the MIT License.
 */

! function(t, e) {
	"object" == typeof exports && "undefined" != typeof module ? module.exports = e() : "function" == typeof define &&
		define.amd ? define(e) : t.VueResource = e()
}(this, function() {
	"use strict";

	function u(t) {
		this.state = 2, this.value = void 0, this.deferred = [];
		var e = this;
		try {
			t(function(t) {
				e.resolve(t)
			}, function(t) {
				e.reject(t)
			})
		} catch (t) {
			e.reject(t)
		}
	}
	u.reject = function(n) {
		return new u(function(t, e) {
			e(n)
		})
	}, u.resolve = function(n) {
		return new u(function(t, e) {
			t(n)
		})
	}, u.all = function(s) {
		return new u(function(n, t) {
			var o = 0,
				r = [];

			function e(e) {
				return function(t) {
					r[e] = t, (o += 1) === s.length && n(r)
				}
			}
			0 === s.length && n(r);
			for (var i = 0; i < s.length; i += 1) u.resolve(s[i]).then(e(i), t)
		})
	}, u.race = function(o) {
		return new u(function(t, e) {
			for (var n = 0; n < o.length; n += 1) u.resolve(o[n]).then(t, e)
		})
	};
	var t = u.prototype;

	function c(t, e) {
		t instanceof Promise ? this.promise = t : this.promise = new Promise(t.bind(e)), this.context = e
	}
	t.resolve = function(t) {
		var e = this;
		if (2 === e.state) {
			if (t === e) throw new TypeError("Promise settled with itself.");
			var n = !1;
			try {
				var o = t && t.then;
				if (null !== t && "object" == typeof t && "function" == typeof o) return void o.call(t, function(t) {
					n || e.resolve(t), n = !0
				}, function(t) {
					n || e.reject(t), n = !0
				})
			} catch (t) {
				return void(n || e.reject(t))
			}
			e.state = 0, e.value = t, e.notify()
		}
	}, t.reject = function(t) {
		var e = this;
		if (2 === e.state) {
			if (t === e) throw new TypeError("Promise settled with itself.");
			e.state = 1, e.value = t, e.notify()
		}
	}, t.notify = function() {
		var t, i = this;
		r(function() {
			if (2 !== i.state)
				for (; i.deferred.length;) {
					var t = i.deferred.shift(),
						e = t[0],
						n = t[1],
						o = t[2],
						r = t[3];
					try {
						0 === i.state ? o("function" == typeof e ? e.call(void 0, i.value) : i.value) : 1 === i.state && ("function" ==
							typeof n ? o(n.call(void 0, i.value)) : r(i.value))
					} catch (t) {
						r(t)
					}
				}
		}, t)
	}, t.then = function(n, o) {
		var r = this;
		return new u(function(t, e) {
			r.deferred.push([n, o, t, e]), r.notify()
		})
	}, t.catch = function(t) {
		return this.then(void 0, t)
	}, "undefined" == typeof Promise && (window.Promise = u), c.all = function(t, e) {
		return new c(Promise.all(t), e)
	}, c.resolve = function(t, e) {
		return new c(Promise.resolve(t), e)
	}, c.reject = function(t, e) {
		return new c(Promise.reject(t), e)
	}, c.race = function(t, e) {
		return new c(Promise.race(t), e)
	};
	var e = c.prototype;
	e.bind = function(t) {
		return this.context = t, this
	}, e.then = function(t, e) {
		return t && t.bind && this.context && (t = t.bind(this.context)), e && e.bind && this.context && (e = e.bind(this.context)),
			new c(this.promise.then(t, e), this.context)
	}, e.catch = function(t) {
		return t && t.bind && this.context && (t = t.bind(this.context)), new c(this.promise.catch(t), this.context)
	}, e.finally = function(e) {
		return this.then(function(t) {
			return e.call(this), t
		}, function(t) {
			return e.call(this), Promise.reject(t)
		})
	};
	var r, i = {}.hasOwnProperty,
		o = [].slice,
		a = !1,
		s = "undefined" != typeof window;

	function f(t) {
		return t ? t.replace(/^\s*|\s*$/g, "") : ""
	}

	function p(t) {
		return t ? t.toLowerCase() : ""
	}
	var h = Array.isArray;

	function d(t) {
		return "string" == typeof t
	}

	function l(t) {
		return "function" == typeof t
	}

	function m(t) {
		return null !== t && "object" == typeof t
	}

	function y(t) {
		return m(t) && Object.getPrototypeOf(t) == Object.prototype
	}

	function v(t, e, n) {
		var o = c.resolve(t);
		return arguments.length < 2 ? o : o.then(e, n)
	}

	function b(t, e, n) {
		return l(n = n || {}) && (n = n.call(e)), T(t.bind({
			$vm: e,
			$options: n
		}), t, {
			$options: n
		})
	}

	function g(t, e) {
		var n, o;
		if (h(t))
			for (n = 0; n < t.length; n++) e.call(t[n], t[n], n);
		else if (m(t))
			for (o in t) i.call(t, o) && e.call(t[o], t[o], o);
		return t
	}
	var w = Object.assign || function(e) {
		return o.call(arguments, 1).forEach(function(t) {
			x(e, t)
		}), e
	};

	function T(e) {
		return o.call(arguments, 1).forEach(function(t) {
			x(e, t, !0)
		}), e
	}

	function x(t, e, n) {
		for (var o in e) n && (y(e[o]) || h(e[o])) ? (y(e[o]) && !y(t[o]) && (t[o] = {}), h(e[o]) && !h(t[o]) && (t[o] = []),
			x(t[o], e[o], n)) : void 0 !== e[o] && (t[o] = e[o])
	}

	function j(t, e, n) {
		var o, u, a, r = (o = t, u = ["+", "#", ".", "/", ";", "?", "&"], {
				vars: a = [],
				expand: function(s) {
					return o.replace(/\{([^{}]+)\}|([^{}]+)/g, function(t, e, n) {
						if (e) {
							var o = null,
								r = [];
							if (-1 !== u.indexOf(e.charAt(0)) && (o = e.charAt(0), e = e.substr(1)), e.split(/,/g).forEach(function(t) {
									var e = /([^:*]*)(?::(\d+)|(\*))?/.exec(t);
									r.push.apply(r, function(t, e, n, o) {
										var r = t[n],
											i = [];
										if (E(r) && "" !== r)
											if ("string" == typeof r || "number" == typeof r || "boolean" == typeof r) r = r.toString(), o &&
												"*" !== o && (r = r.substring(0, parseInt(o, 10))), i.push(O(e, r, P(e) ? n : null));
											else if ("*" === o) Array.isArray(r) ? r.filter(E).forEach(function(t) {
											i.push(O(e, t, P(e) ? n : null))
										}) : Object.keys(r).forEach(function(t) {
											E(r[t]) && i.push(O(e, r[t], t))
										});
										else {
											var s = [];
											Array.isArray(r) ? r.filter(E).forEach(function(t) {
												s.push(O(e, t))
											}) : Object.keys(r).forEach(function(t) {
												E(r[t]) && (s.push(encodeURIComponent(t)), s.push(O(e, r[t].toString())))
											}), P(e) ? i.push(encodeURIComponent(n) + "=" + s.join(",")) : 0 !== s.length && i.push(s.join(","))
										} else ";" === e ? i.push(encodeURIComponent(n)) : "" !== r || "&" !== e && "?" !== e ? "" === r && i
											.push("") : i.push(encodeURIComponent(n) + "=");
										return i
									}(s, o, e[1], e[2] || e[3])), a.push(e[1])
								}), o && "+" !== o) {
								var i = ",";
								return "?" === o ? i = "&" : "#" !== o && (i = o), (0 !== r.length ? o : "") + r.join(i)
							}
							return r.join(",")
						}
						return C(n)
					})
				}
			}),
			i = r.expand(e);
		return n && n.push.apply(n, r.vars), i
	}

	function E(t) {
		return null != t
	}

	function P(t) {
		return ";" === t || "&" === t || "?" === t
	}

	function O(t, e, n) {
		return e = "+" === t || "#" === t ? C(e) : encodeURIComponent(e), n ? encodeURIComponent(n) + "=" + e : e
	}

	function C(t) {
		return t.split(/(%[0-9A-Fa-f]{2})/g).map(function(t) {
			return /%[0-9A-Fa-f]/.test(t) || (t = encodeURI(t)), t
		}).join("")
	}

	function $(t, e) {
		var r, i = this || {},
			n = t;
		return d(t) && (n = {
			url: t,
			params: e
		}), n = T({}, $.options, i.$options, n), $.transforms.forEach(function(t) {
			var e, n, o;
			d(t) && (t = $.transform[t]), l(t) && (e = t, n = r, o = i.$vm, r = function(t) {
				return e.call(o, t, n)
			})
		}), r(n)
	}

	function U(i) {
		return new c(function(o) {
			var r = new XDomainRequest,
				t = function(t) {
					var e = t.type,
						n = 0;
					"load" === e ? n = 200 : "error" === e && (n = 500), o(i.respondWith(r.responseText, {
						status: n
					}))
				};
			i.abort = function() {
					return r.abort()
				}, r.open(i.method, i.getUrl()), i.timeout && (r.timeout = i.timeout), r.onload = t, r.onabort = t, r.onerror =
				t, r.ontimeout = t, r.onprogress = function() {}, r.send(i.getBody())
		})
	}
	$.options = {
		url: "",
		root: null,
		params: {}
	}, $.transform = {
		template: function(e) {
			var t = [],
				n = j(e.url, e.params, t);
			return t.forEach(function(t) {
				delete e.params[t]
			}), n
		},
		query: function(t, e) {
			var n = Object.keys($.options.params),
				o = {},
				r = e(t);
			return g(t.params, function(t, e) {
				-1 === n.indexOf(e) && (o[e] = t)
			}), (o = $.params(o)) && (r += (-1 == r.indexOf("?") ? "?" : "&") + o), r
		},
		root: function(t, e) {
			var n, o, r = e(t);
			return d(t.root) && !/^(https?:)?\//.test(r) && (n = t.root, o = "/", r = (n && void 0 === o ? n.replace(/\s+$/,
				"") : n && o ? n.replace(new RegExp("[" + o + "]+$"), "") : n) + "/" + r), r
		}
	}, $.transforms = ["template", "query", "root"], $.params = function(t) {
		var e = [],
			n = encodeURIComponent;
		return e.add = function(t, e) {
				l(e) && (e = e()), null === e && (e = ""), this.push(n(t) + "=" + n(e))
			},
			function n(o, t, r) {
				var i, s = h(t),
					u = y(t);
				g(t, function(t, e) {
					i = m(t) || h(t), r && (e = r + "[" + (u || i ? e : "") + "]"), !r && s ? o.add(t.name, t.value) : i ? n(o, t,
						e) : o.add(e, t)
				})
			}(e, t), e.join("&").replace(/%20/g, "+")
	}, $.parse = function(t) {
		var e = document.createElement("a");
		return document.documentMode && (e.href = t, t = e.href), e.href = t, {
			href: e.href,
			protocol: e.protocol ? e.protocol.replace(/:$/, "") : "",
			port: e.port,
			host: e.host,
			hostname: e.hostname,
			pathname: "/" === e.pathname.charAt(0) ? e.pathname : "/" + e.pathname,
			search: e.search ? e.search.replace(/^\?/, "") : "",
			hash: e.hash ? e.hash.replace(/^#/, "") : ""
		}
	};
	var R = s && "withCredentials" in new XMLHttpRequest;

	function n(u) {
		return new c(function(o) {
			var t, r, e = u.jsonp || "callback",
				i = u.jsonpCallback || "_jsonp" + Math.random().toString(36).substr(2),
				s = null;
			t = function(t) {
					var e = t.type,
						n = 0;
					"load" === e && null !== s ? n = 200 : "error" === e && (n = 500), n && window[i] && (delete window[i],
						document.body.removeChild(r)), o(u.respondWith(s, {
						status: n
					}))
				}, window[i] = function(t) {
					s = JSON.stringify(t)
				}, u.abort = function() {
					t({
						type: "abort"
					})
				}, u.params[e] = i, u.timeout && setTimeout(u.abort, u.timeout), (r = document.createElement("script")).src = u.getUrl(),
				r.type = "text/javascript", r.async = !0, r.onload = t, r.onerror = t, document.body.appendChild(r)
		})
	}

	function A(r) {
		return new c(function(n) {
			var o = new XMLHttpRequest,
				t = function(t) {
					var e = r.respondWith("response" in o ? o.response : o.responseText, {
						status: 1223 === o.status ? 204 : o.status,
						statusText: 1223 === o.status ? "No Content" : f(o.statusText)
					});
					g(f(o.getAllResponseHeaders()).split("\n"), function(t) {
						e.headers.append(t.slice(0, t.indexOf(":")), t.slice(t.indexOf(":") + 1))
					}), n(e)
				};
			r.abort = function() {
					return o.abort()
				}, o.open(r.method, r.getUrl(), !0), r.timeout && (o.timeout = r.timeout), r.responseType && "responseType" in o &&
				(o.responseType = r.responseType), (r.withCredentials || r.credentials) && (o.withCredentials = !0), r.crossOrigin ||
				r.headers.set("X-Requested-With", "XMLHttpRequest"), l(r.progress) && "GET" === r.method && o.addEventListener(
					"progress", r.progress), l(r.downloadProgress) && o.addEventListener("progress", r.downloadProgress), l(r.progress) &&
				/^(POST|PUT)$/i.test(r.method) && o.upload.addEventListener("progress", r.progress), l(r.uploadProgress) && o.upload &&
				o.upload.addEventListener("progress", r.uploadProgress), r.headers.forEach(function(t, e) {
					o.setRequestHeader(e, t)
				}), o.onload = t, o.onabort = t, o.onerror = t, o.ontimeout = t, o.send(r.getBody())
		})
	}

	function S(s) {
		var u = require("got");
		return new c(function(e) {
			var n, t = s.getUrl(),
				o = s.getBody(),
				r = s.method,
				i = {};
			s.headers.forEach(function(t, e) {
				i[e] = t
			}), u(t, {
				body: o,
				method: r,
				headers: i
			}).then(n = function(t) {
				var n = s.respondWith(t.body, {
					status: t.statusCode,
					statusText: f(t.statusMessage)
				});
				g(t.headers, function(t, e) {
					n.headers.set(e, t)
				}), e(n)
			}, function(t) {
				return n(t.response)
			})
		})
	}

	function k(t) {
		return (t.client || (s ? A : S))(t)
	}
	var I = function(t) {
		var n = this;
		this.map = {}, g(t, function(t, e) {
			return n.append(e, t)
		})
	};

	function L(t, n) {
		return Object.keys(t).reduce(function(t, e) {
			return p(n) === p(e) ? e : t
		}, null)
	}
	I.prototype.has = function(t) {
		return null !== L(this.map, t)
	}, I.prototype.get = function(t) {
		var e = this.map[L(this.map, t)];
		return e ? e.join() : null
	}, I.prototype.getAll = function(t) {
		return this.map[L(this.map, t)] || []
	}, I.prototype.set = function(t, e) {
		this.map[function(t) {
			if (/[^a-z0-9\-#$%&'*+.^_`|~]/i.test(t)) throw new TypeError("Invalid character in header field name");
			return f(t)
		}(L(this.map, t) || t)] = [f(e)]
	}, I.prototype.append = function(t, e) {
		var n = this.map[L(this.map, t)];
		n ? n.push(f(e)) : this.set(t, e)
	}, I.prototype.delete = function(t) {
		delete this.map[L(this.map, t)]
	}, I.prototype.deleteAll = function() {
		this.map = {}
	}, I.prototype.forEach = function(n, o) {
		var r = this;
		g(this.map, function(t, e) {
			g(t, function(t) {
				return n.call(o, t, e, r)
			})
		})
	};
	var q = function(t, e) {
		var n, o, r, i = e.url,
			s = e.headers,
			u = e.status,
			a = e.statusText;
		this.url = i, this.ok = 200 <= u && u < 300, this.status = u || 0, this.statusText = a || "", this.headers = new I(
			s), d(this.body = t) ? this.bodyText = t : (r = t, "undefined" != typeof Blob && r instanceof Blob && (this.bodyBlob =
			t, (0 === (o = t).type.indexOf("text") || -1 !== o.type.indexOf("json")) && (this.bodyText = (n = t, new c(
				function(t) {
					var e = new FileReader;
					e.readAsText(n), e.onload = function() {
						t(e.result)
					}
				})))))
	};
	q.prototype.blob = function() {
		return v(this.bodyBlob)
	}, q.prototype.text = function() {
		return v(this.bodyText)
	}, q.prototype.json = function() {
		return v(this.text(), function(t) {
			return JSON.parse(t)
		})
	}, Object.defineProperty(q.prototype, "data", {
		get: function() {
			return this.body
		},
		set: function(t) {
			this.body = t
		}
	});
	var H = function(t) {
		var e;
		this.body = null, this.params = {}, w(this, t, {
			method: (e = t.method || "GET", e ? e.toUpperCase() : "")
		}), this.headers instanceof I || (this.headers = new I(this.headers))
	};
	H.prototype.getUrl = function() {
		return $(this)
	}, H.prototype.getBody = function() {
		return this.body
	}, H.prototype.respondWith = function(t, e) {
		return new q(t, w(e || {}, {
			url: this.getUrl()
		}))
	};
	var B = {
		"Content-Type": "application/json;charset=utf-8"
	};

	function M(t) {
		var e = this || {},
			n = function(i) {
				var s = [k],
					u = [];

				function t(t) {
					for (; s.length;) {
						var e = s.pop();
						if (l(e)) {
							var o = void 0,
								n = void 0;
							if (m(o = e.call(i, t, function(t) {
									return n = t
								}) || n)) return new c(function(t, n) {
								u.forEach(function(e) {
									o = v(o, function(t) {
										return e.call(i, t) || t
									}, n)
								}), v(o, t, n)
							}, i);
							l(o) && u.unshift(o)
						} else r = "Invalid interceptor of type " + typeof e + ", must be a function", "undefined" != typeof console &&
							a && console.warn("[VueResource warn]: " + r)
					}
					var r
				}
				return m(i) || (i = null), t.use = function(t) {
					s.push(t)
				}, t
			}(e.$vm);
		return function(n) {
			o.call(arguments, 1).forEach(function(t) {
				for (var e in t) void 0 === n[e] && (n[e] = t[e])
			})
		}(t || {}, e.$options, M.options), M.interceptors.forEach(function(t) {
			d(t) && (t = M.interceptor[t]), l(t) && n.use(t)
		}), n(new H(t)).then(function(t) {
			return t.ok ? t : c.reject(t)
		}, function(t) {
			var e;
			return t instanceof Error && (e = t, "undefined" != typeof console && console.error(e)), c.reject(t)
		})
	}

	function N(n, o, t, r) {
		var i = this || {},
			s = {};
		return g(t = w({}, N.actions, t), function(t, e) {
			t = T({
				url: n,
				params: w({}, o)
			}, r, t), s[e] = function() {
				return (i.$http || M)(function(t, e) {
					var n, o = w({}, t),
						r = {};
					switch (e.length) {
						case 2:
							r = e[0], n = e[1];
							break;
						case 1:
							/^(POST|PUT|PATCH)$/i.test(o.method) ? n = e[0] : r = e[0];
							break;
						case 0:
							break;
						default:
							throw "Expected up to 2 arguments [params, body], got " + e.length + " arguments"
					}
					return o.body = n, o.params = w({}, o.params, r), o
				}(t, arguments))
			}
		}), s
	}

	function D(n) {
		var t, e, o;
		D.installed || (e = (t = n).config, o = t.nextTick, r = o, a = e.debug || !e.silent, n.url = $, n.http = M, n.resource =
			N, n.Promise = c, Object.defineProperties(n.prototype, {
				$url: {
					get: function() {
						return b(n.url, this, this.$options.url)
					}
				},
				$http: {
					get: function() {
						return b(n.http, this, this.$options.http)
					}
				},
				$resource: {
					get: function() {
						return n.resource.bind(this)
					}
				},
				$promise: {
					get: function() {
						var e = this;
						return function(t) {
							return new n.Promise(t, e)
						}
					}
				}
			}))
	}
	return M.options = {}, M.headers = {
		put: B,
		post: B,
		patch: B,
		delete: B,
		common: {
			Accept: "application/json, text/plain, */*"
		},
		custom: {}
	}, M.interceptor = {
		before: function(t) {
			l(t.before) && t.before.call(this, t)
		},
		method: function(t) {
			t.emulateHTTP && /^(PUT|PATCH|DELETE)$/i.test(t.method) && (t.headers.set("X-HTTP-Method-Override", t.method), t.method =
				"POST")
		},
		jsonp: function(t) {
			"JSONP" == t.method && (t.client = n)
		},
		json: function(t) {
			var e = t.headers.get("Content-Type") || "";
			return m(t.body) && 0 === e.indexOf("application/json") && (t.body = JSON.stringify(t.body)),
				function(o) {
					return o.bodyText ? v(o.text(), function(t) {
						var e, n;
						if (0 === (o.headers.get("Content-Type") || "").indexOf("application/json") || (n = (e = t).match(
								/^\s*(\[|\{)/)) && {
								"[": /]\s*$/,
								"{": /}\s*$/
							} [n[1]].test(e)) try {
							o.body = JSON.parse(t)
						} catch (t) {
							o.body = null
						} else o.body = t;
						return o
					}) : o
				}
		},
		form: function(t) {
			var e;
			e = t.body, "undefined" != typeof FormData && e instanceof FormData ? t.headers.delete("Content-Type") : m(t.body) &&
				t.emulateJSON && (t.body = $.params(t.body), t.headers.set("Content-Type", "application/x-www-form-urlencoded"))
		},
		header: function(n) {
			g(w({}, M.headers.common, n.crossOrigin ? {} : M.headers.custom, M.headers[p(n.method)]), function(t, e) {
				n.headers.has(e) || n.headers.set(e, t)
			})
		},
		cors: function(t) {
			if (s) {
				var e = $.parse(location.href),
					n = $.parse(t.getUrl());
				n.protocol === e.protocol && n.host === e.host || (t.crossOrigin = !0, t.emulateHTTP = !1, R || (t.client = U))
			}
		}
	}, M.interceptors = ["before", "method", "jsonp", "json", "form", "header", "cors"], ["get", "delete", "head",
		"jsonp"
	].forEach(function(n) {
		M[n] = function(t, e) {
			return this(w(e || {}, {
				url: t,
				method: n
			}))
		}
	}), ["post", "put", "patch"].forEach(function(o) {
		M[o] = function(t, e, n) {
			return this(w(n || {}, {
				url: t,
				method: o,
				body: e
			}))
		}
	}), N.actions = {
		get: {
			method: "GET"
		},
		save: {
			method: "POST"
		},
		query: {
			method: "GET"
		},
		update: {
			method: "PUT"
		},
		remove: {
			method: "DELETE"
		},
		delete: {
			method: "DELETE"
		}
	}, "undefined" != typeof window && window.Vue && window.Vue.use(D), D
});


/**
 * Swiper 4.5.0
 * Most modern mobile touch slider and framework with hardware accelerated transitions
 * http://www.idangero.us/swiper/
 *
 * Copyright 2014-2019 Vladimir Kharlampidi
 *
 * Released under the MIT License
 *
 * Released on: February 22, 2019
 */
!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?module.exports=t():"function"==typeof define&&define.amd?define(t):(e=e||self).Swiper=t()}(this,function(){"use strict";var f="undefined"==typeof document?{body:{},addEventListener:function(){},removeEventListener:function(){},activeElement:{blur:function(){},nodeName:""},querySelector:function(){return null},querySelectorAll:function(){return[]},getElementById:function(){return null},createEvent:function(){return{initEvent:function(){}}},createElement:function(){return{children:[],childNodes:[],style:{},setAttribute:function(){},getElementsByTagName:function(){return[]}}},location:{hash:""}}:document,J="undefined"==typeof window?{document:f,navigator:{userAgent:""},location:{},history:{},CustomEvent:function(){return this},addEventListener:function(){},removeEventListener:function(){},getComputedStyle:function(){return{getPropertyValue:function(){return""}}},Image:function(){},Date:function(){},screen:{},setTimeout:function(){},clearTimeout:function(){}}:window,l=function(e){for(var t=0;t<e.length;t+=1)this[t]=e[t];return this.length=e.length,this};function L(e,t){var a=[],i=0;if(e&&!t&&e instanceof l)return e;if(e)if("string"==typeof e){var s,r,n=e.trim();if(0<=n.indexOf("<")&&0<=n.indexOf(">")){var o="div";for(0===n.indexOf("<li")&&(o="ul"),0===n.indexOf("<tr")&&(o="tbody"),0!==n.indexOf("<td")&&0!==n.indexOf("<th")||(o="tr"),0===n.indexOf("<tbody")&&(o="table"),0===n.indexOf("<option")&&(o="select"),(r=f.createElement(o)).innerHTML=n,i=0;i<r.childNodes.length;i+=1)a.push(r.childNodes[i])}else for(s=t||"#"!==e[0]||e.match(/[ .<>:~]/)?(t||f).querySelectorAll(e.trim()):[f.getElementById(e.trim().split("#")[1])],i=0;i<s.length;i+=1)s[i]&&a.push(s[i])}else if(e.nodeType||e===J||e===f)a.push(e);else if(0<e.length&&e[0].nodeType)for(i=0;i<e.length;i+=1)a.push(e[i]);return new l(a)}function r(e){for(var t=[],a=0;a<e.length;a+=1)-1===t.indexOf(e[a])&&t.push(e[a]);return t}L.fn=l.prototype,L.Class=l,L.Dom7=l;var t={addClass:function(e){if(void 0===e)return this;for(var t=e.split(" "),a=0;a<t.length;a+=1)for(var i=0;i<this.length;i+=1)void 0!==this[i]&&void 0!==this[i].classList&&this[i].classList.add(t[a]);return this},removeClass:function(e){for(var t=e.split(" "),a=0;a<t.length;a+=1)for(var i=0;i<this.length;i+=1)void 0!==this[i]&&void 0!==this[i].classList&&this[i].classList.remove(t[a]);return this},hasClass:function(e){return!!this[0]&&this[0].classList.contains(e)},toggleClass:function(e){for(var t=e.split(" "),a=0;a<t.length;a+=1)for(var i=0;i<this.length;i+=1)void 0!==this[i]&&void 0!==this[i].classList&&this[i].classList.toggle(t[a]);return this},attr:function(e,t){var a=arguments;if(1===arguments.length&&"string"==typeof e)return this[0]?this[0].getAttribute(e):void 0;for(var i=0;i<this.length;i+=1)if(2===a.length)this[i].setAttribute(e,t);else for(var s in e)this[i][s]=e[s],this[i].setAttribute(s,e[s]);return this},removeAttr:function(e){for(var t=0;t<this.length;t+=1)this[t].removeAttribute(e);return this},data:function(e,t){var a;if(void 0!==t){for(var i=0;i<this.length;i+=1)(a=this[i]).dom7ElementDataStorage||(a.dom7ElementDataStorage={}),a.dom7ElementDataStorage[e]=t;return this}if(a=this[0]){if(a.dom7ElementDataStorage&&e in a.dom7ElementDataStorage)return a.dom7ElementDataStorage[e];var s=a.getAttribute("data-"+e);return s||void 0}},transform:function(e){for(var t=0;t<this.length;t+=1){var a=this[t].style;a.webkitTransform=e,a.transform=e}return this},transition:function(e){"string"!=typeof e&&(e+="ms");for(var t=0;t<this.length;t+=1){var a=this[t].style;a.webkitTransitionDuration=e,a.transitionDuration=e}return this},on:function(){for(var e,t=[],a=arguments.length;a--;)t[a]=arguments[a];var i=t[0],r=t[1],n=t[2],s=t[3];function o(e){var t=e.target;if(t){var a=e.target.dom7EventData||[];if(a.indexOf(e)<0&&a.unshift(e),L(t).is(r))n.apply(t,a);else for(var i=L(t).parents(),s=0;s<i.length;s+=1)L(i[s]).is(r)&&n.apply(i[s],a)}}function l(e){var t=e&&e.target&&e.target.dom7EventData||[];t.indexOf(e)<0&&t.unshift(e),n.apply(this,t)}"function"==typeof t[1]&&(i=(e=t)[0],n=e[1],s=e[2],r=void 0),s||(s=!1);for(var d,p=i.split(" "),c=0;c<this.length;c+=1){var u=this[c];if(r)for(d=0;d<p.length;d+=1){var h=p[d];u.dom7LiveListeners||(u.dom7LiveListeners={}),u.dom7LiveListeners[h]||(u.dom7LiveListeners[h]=[]),u.dom7LiveListeners[h].push({listener:n,proxyListener:o}),u.addEventListener(h,o,s)}else for(d=0;d<p.length;d+=1){var v=p[d];u.dom7Listeners||(u.dom7Listeners={}),u.dom7Listeners[v]||(u.dom7Listeners[v]=[]),u.dom7Listeners[v].push({listener:n,proxyListener:l}),u.addEventListener(v,l,s)}}return this},off:function(){for(var e,t=[],a=arguments.length;a--;)t[a]=arguments[a];var i=t[0],s=t[1],r=t[2],n=t[3];"function"==typeof t[1]&&(i=(e=t)[0],r=e[1],n=e[2],s=void 0),n||(n=!1);for(var o=i.split(" "),l=0;l<o.length;l+=1)for(var d=o[l],p=0;p<this.length;p+=1){var c=this[p],u=void 0;if(!s&&c.dom7Listeners?u=c.dom7Listeners[d]:s&&c.dom7LiveListeners&&(u=c.dom7LiveListeners[d]),u&&u.length)for(var h=u.length-1;0<=h;h-=1){var v=u[h];r&&v.listener===r?(c.removeEventListener(d,v.proxyListener,n),u.splice(h,1)):r&&v.listener&&v.listener.dom7proxy&&v.listener.dom7proxy===r?(c.removeEventListener(d,v.proxyListener,n),u.splice(h,1)):r||(c.removeEventListener(d,v.proxyListener,n),u.splice(h,1))}}return this},trigger:function(){for(var e=[],t=arguments.length;t--;)e[t]=arguments[t];for(var a=e[0].split(" "),i=e[1],s=0;s<a.length;s+=1)for(var r=a[s],n=0;n<this.length;n+=1){var o=this[n],l=void 0;try{l=new J.CustomEvent(r,{detail:i,bubbles:!0,cancelable:!0})}catch(e){(l=f.createEvent("Event")).initEvent(r,!0,!0),l.detail=i}o.dom7EventData=e.filter(function(e,t){return 0<t}),o.dispatchEvent(l),o.dom7EventData=[],delete o.dom7EventData}return this},transitionEnd:function(t){var a,i=["webkitTransitionEnd","transitionend"],s=this;function r(e){if(e.target===this)for(t.call(this,e),a=0;a<i.length;a+=1)s.off(i[a],r)}if(t)for(a=0;a<i.length;a+=1)s.on(i[a],r);return this},outerWidth:function(e){if(0<this.length){if(e){var t=this.styles();return this[0].offsetWidth+parseFloat(t.getPropertyValue("margin-right"))+parseFloat(t.getPropertyValue("margin-left"))}return this[0].offsetWidth}return null},outerHeight:function(e){if(0<this.length){if(e){var t=this.styles();return this[0].offsetHeight+parseFloat(t.getPropertyValue("margin-top"))+parseFloat(t.getPropertyValue("margin-bottom"))}return this[0].offsetHeight}return null},offset:function(){if(0<this.length){var e=this[0],t=e.getBoundingClientRect(),a=f.body,i=e.clientTop||a.clientTop||0,s=e.clientLeft||a.clientLeft||0,r=e===J?J.scrollY:e.scrollTop,n=e===J?J.scrollX:e.scrollLeft;return{top:t.top+r-i,left:t.left+n-s}}return null},css:function(e,t){var a;if(1===arguments.length){if("string"!=typeof e){for(a=0;a<this.length;a+=1)for(var i in e)this[a].style[i]=e[i];return this}if(this[0])return J.getComputedStyle(this[0],null).getPropertyValue(e)}if(2===arguments.length&&"string"==typeof e){for(a=0;a<this.length;a+=1)this[a].style[e]=t;return this}return this},each:function(e){if(!e)return this;for(var t=0;t<this.length;t+=1)if(!1===e.call(this[t],t,this[t]))return this;return this},html:function(e){if(void 0===e)return this[0]?this[0].innerHTML:void 0;for(var t=0;t<this.length;t+=1)this[t].innerHTML=e;return this},text:function(e){if(void 0===e)return this[0]?this[0].textContent.trim():null;for(var t=0;t<this.length;t+=1)this[t].textContent=e;return this},is:function(e){var t,a,i=this[0];if(!i||void 0===e)return!1;if("string"==typeof e){if(i.matches)return i.matches(e);if(i.webkitMatchesSelector)return i.webkitMatchesSelector(e);if(i.msMatchesSelector)return i.msMatchesSelector(e);for(t=L(e),a=0;a<t.length;a+=1)if(t[a]===i)return!0;return!1}if(e===f)return i===f;if(e===J)return i===J;if(e.nodeType||e instanceof l){for(t=e.nodeType?[e]:e,a=0;a<t.length;a+=1)if(t[a]===i)return!0;return!1}return!1},index:function(){var e,t=this[0];if(t){for(e=0;null!==(t=t.previousSibling);)1===t.nodeType&&(e+=1);return e}},eq:function(e){if(void 0===e)return this;var t,a=this.length;return new l(a-1<e?[]:e<0?(t=a+e)<0?[]:[this[t]]:[this[e]])},append:function(){for(var e,t=[],a=arguments.length;a--;)t[a]=arguments[a];for(var i=0;i<t.length;i+=1){e=t[i];for(var s=0;s<this.length;s+=1)if("string"==typeof e){var r=f.createElement("div");for(r.innerHTML=e;r.firstChild;)this[s].appendChild(r.firstChild)}else if(e instanceof l)for(var n=0;n<e.length;n+=1)this[s].appendChild(e[n]);else this[s].appendChild(e)}return this},prepend:function(e){var t,a;for(t=0;t<this.length;t+=1)if("string"==typeof e){var i=f.createElement("div");for(i.innerHTML=e,a=i.childNodes.length-1;0<=a;a-=1)this[t].insertBefore(i.childNodes[a],this[t].childNodes[0])}else if(e instanceof l)for(a=0;a<e.length;a+=1)this[t].insertBefore(e[a],this[t].childNodes[0]);else this[t].insertBefore(e,this[t].childNodes[0]);return this},next:function(e){return 0<this.length?e?this[0].nextElementSibling&&L(this[0].nextElementSibling).is(e)?new l([this[0].nextElementSibling]):new l([]):this[0].nextElementSibling?new l([this[0].nextElementSibling]):new l([]):new l([])},nextAll:function(e){var t=[],a=this[0];if(!a)return new l([]);for(;a.nextElementSibling;){var i=a.nextElementSibling;e?L(i).is(e)&&t.push(i):t.push(i),a=i}return new l(t)},prev:function(e){if(0<this.length){var t=this[0];return e?t.previousElementSibling&&L(t.previousElementSibling).is(e)?new l([t.previousElementSibling]):new l([]):t.previousElementSibling?new l([t.previousElementSibling]):new l([])}return new l([])},prevAll:function(e){var t=[],a=this[0];if(!a)return new l([]);for(;a.previousElementSibling;){var i=a.previousElementSibling;e?L(i).is(e)&&t.push(i):t.push(i),a=i}return new l(t)},parent:function(e){for(var t=[],a=0;a<this.length;a+=1)null!==this[a].parentNode&&(e?L(this[a].parentNode).is(e)&&t.push(this[a].parentNode):t.push(this[a].parentNode));return L(r(t))},parents:function(e){for(var t=[],a=0;a<this.length;a+=1)for(var i=this[a].parentNode;i;)e?L(i).is(e)&&t.push(i):t.push(i),i=i.parentNode;return L(r(t))},closest:function(e){var t=this;return void 0===e?new l([]):(t.is(e)||(t=t.parents(e).eq(0)),t)},find:function(e){for(var t=[],a=0;a<this.length;a+=1)for(var i=this[a].querySelectorAll(e),s=0;s<i.length;s+=1)t.push(i[s]);return new l(t)},children:function(e){for(var t=[],a=0;a<this.length;a+=1)for(var i=this[a].childNodes,s=0;s<i.length;s+=1)e?1===i[s].nodeType&&L(i[s]).is(e)&&t.push(i[s]):1===i[s].nodeType&&t.push(i[s]);return new l(r(t))},remove:function(){for(var e=0;e<this.length;e+=1)this[e].parentNode&&this[e].parentNode.removeChild(this[e]);return this},add:function(){for(var e=[],t=arguments.length;t--;)e[t]=arguments[t];var a,i;for(a=0;a<e.length;a+=1){var s=L(e[a]);for(i=0;i<s.length;i+=1)this[this.length]=s[i],this.length+=1}return this},styles:function(){return this[0]?J.getComputedStyle(this[0],null):{}}};Object.keys(t).forEach(function(e){L.fn[e]=t[e]});var e,a,i,s,ee={deleteProps:function(e){var t=e;Object.keys(t).forEach(function(e){try{t[e]=null}catch(e){}try{delete t[e]}catch(e){}})},nextTick:function(e,t){return void 0===t&&(t=0),setTimeout(e,t)},now:function(){return Date.now()},getTranslate:function(e,t){var a,i,s;void 0===t&&(t="x");var r=J.getComputedStyle(e,null);return J.WebKitCSSMatrix?(6<(i=r.transform||r.webkitTransform).split(",").length&&(i=i.split(", ").map(function(e){return e.replace(",",".")}).join(", ")),s=new J.WebKitCSSMatrix("none"===i?"":i)):a=(s=r.MozTransform||r.OTransform||r.MsTransform||r.msTransform||r.transform||r.getPropertyValue("transform").replace("translate(","matrix(1, 0, 0, 1,")).toString().split(","),"x"===t&&(i=J.WebKitCSSMatrix?s.m41:16===a.length?parseFloat(a[12]):parseFloat(a[4])),"y"===t&&(i=J.WebKitCSSMatrix?s.m42:16===a.length?parseFloat(a[13]):parseFloat(a[5])),i||0},parseUrlQuery:function(e){var t,a,i,s,r={},n=e||J.location.href;if("string"==typeof n&&n.length)for(s=(a=(n=-1<n.indexOf("?")?n.replace(/\S*\?/,""):"").split("&").filter(function(e){return""!==e})).length,t=0;t<s;t+=1)i=a[t].replace(/#\S+/g,"").split("="),r[decodeURIComponent(i[0])]=void 0===i[1]?void 0:decodeURIComponent(i[1])||"";return r},isObject:function(e){return"object"==typeof e&&null!==e&&e.constructor&&e.constructor===Object},extend:function(){for(var e=[],t=arguments.length;t--;)e[t]=arguments[t];for(var a=Object(e[0]),i=1;i<e.length;i+=1){var s=e[i];if(null!=s)for(var r=Object.keys(Object(s)),n=0,o=r.length;n<o;n+=1){var l=r[n],d=Object.getOwnPropertyDescriptor(s,l);void 0!==d&&d.enumerable&&(ee.isObject(a[l])&&ee.isObject(s[l])?ee.extend(a[l],s[l]):!ee.isObject(a[l])&&ee.isObject(s[l])?(a[l]={},ee.extend(a[l],s[l])):a[l]=s[l])}}return a}},te=(i=f.createElement("div"),{touch:J.Modernizr&&!0===J.Modernizr.touch||!!(0<J.navigator.maxTouchPoints||"ontouchstart"in J||J.DocumentTouch&&f instanceof J.DocumentTouch),pointerEvents:!!(J.navigator.pointerEnabled||J.PointerEvent||"maxTouchPoints"in J.navigator&&0<J.navigator.maxTouchPoints),prefixedPointerEvents:!!J.navigator.msPointerEnabled,transition:(a=i.style,"transition"in a||"webkitTransition"in a||"MozTransition"in a),transforms3d:J.Modernizr&&!0===J.Modernizr.csstransforms3d||(e=i.style,"webkitPerspective"in e||"MozPerspective"in e||"OPerspective"in e||"MsPerspective"in e||"perspective"in e),flexbox:function(){for(var e=i.style,t="alignItems webkitAlignItems webkitBoxAlign msFlexAlign mozBoxAlign webkitFlexDirection msFlexDirection mozBoxDirection mozBoxOrient webkitBoxDirection webkitBoxOrient".split(" "),a=0;a<t.length;a+=1)if(t[a]in e)return!0;return!1}(),observer:"MutationObserver"in J||"WebkitMutationObserver"in J,passiveListener:function(){var e=!1;try{var t=Object.defineProperty({},"passive",{get:function(){e=!0}});J.addEventListener("testPassiveListener",null,t)}catch(e){}return e}(),gestures:"ongesturestart"in J}),I={isIE:!!J.navigator.userAgent.match(/Trident/g)||!!J.navigator.userAgent.match(/MSIE/g),isEdge:!!J.navigator.userAgent.match(/Edge/g),isSafari:(s=J.navigator.userAgent.toLowerCase(),0<=s.indexOf("safari")&&s.indexOf("chrome")<0&&s.indexOf("android")<0),isUiWebView:/(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(J.navigator.userAgent)},n=function(e){void 0===e&&(e={});var t=this;t.params=e,t.eventsListeners={},t.params&&t.params.on&&Object.keys(t.params.on).forEach(function(e){t.on(e,t.params.on[e])})},o={components:{configurable:!0}};n.prototype.on=function(e,t,a){var i=this;if("function"!=typeof t)return i;var s=a?"unshift":"push";return e.split(" ").forEach(function(e){i.eventsListeners[e]||(i.eventsListeners[e]=[]),i.eventsListeners[e][s](t)}),i},n.prototype.once=function(a,i,e){var s=this;if("function"!=typeof i)return s;function r(){for(var e=[],t=arguments.length;t--;)e[t]=arguments[t];i.apply(s,e),s.off(a,r),r.f7proxy&&delete r.f7proxy}return r.f7proxy=i,s.on(a,r,e)},n.prototype.off=function(e,i){var s=this;return s.eventsListeners&&e.split(" ").forEach(function(a){void 0===i?s.eventsListeners[a]=[]:s.eventsListeners[a]&&s.eventsListeners[a].length&&s.eventsListeners[a].forEach(function(e,t){(e===i||e.f7proxy&&e.f7proxy===i)&&s.eventsListeners[a].splice(t,1)})}),s},n.prototype.emit=function(){for(var e=[],t=arguments.length;t--;)e[t]=arguments[t];var a,i,s,r=this;return r.eventsListeners&&("string"==typeof e[0]||Array.isArray(e[0])?(a=e[0],i=e.slice(1,e.length),s=r):(a=e[0].events,i=e[0].data,s=e[0].context||r),(Array.isArray(a)?a:a.split(" ")).forEach(function(e){if(r.eventsListeners&&r.eventsListeners[e]){var t=[];r.eventsListeners[e].forEach(function(e){t.push(e)}),t.forEach(function(e){e.apply(s,i)})}})),r},n.prototype.useModulesParams=function(a){var i=this;i.modules&&Object.keys(i.modules).forEach(function(e){var t=i.modules[e];t.params&&ee.extend(a,t.params)})},n.prototype.useModules=function(i){void 0===i&&(i={});var s=this;s.modules&&Object.keys(s.modules).forEach(function(e){var a=s.modules[e],t=i[e]||{};a.instance&&Object.keys(a.instance).forEach(function(e){var t=a.instance[e];s[e]="function"==typeof t?t.bind(s):t}),a.on&&s.on&&Object.keys(a.on).forEach(function(e){s.on(e,a.on[e])}),a.create&&a.create.bind(s)(t)})},o.components.set=function(e){this.use&&this.use(e)},n.installModule=function(t){for(var e=[],a=arguments.length-1;0<a--;)e[a]=arguments[a+1];var i=this;i.prototype.modules||(i.prototype.modules={});var s=t.name||Object.keys(i.prototype.modules).length+"_"+ee.now();return(i.prototype.modules[s]=t).proto&&Object.keys(t.proto).forEach(function(e){i.prototype[e]=t.proto[e]}),t.static&&Object.keys(t.static).forEach(function(e){i[e]=t.static[e]}),t.install&&t.install.apply(i,e),i},n.use=function(e){for(var t=[],a=arguments.length-1;0<a--;)t[a]=arguments[a+1];var i=this;return Array.isArray(e)?(e.forEach(function(e){return i.installModule(e)}),i):i.installModule.apply(i,[e].concat(t))},Object.defineProperties(n,o);var d={updateSize:function(){var e,t,a=this,i=a.$el;e=void 0!==a.params.width?a.params.width:i[0].clientWidth,t=void 0!==a.params.height?a.params.height:i[0].clientHeight,0===e&&a.isHorizontal()||0===t&&a.isVertical()||(e=e-parseInt(i.css("padding-left"),10)-parseInt(i.css("padding-right"),10),t=t-parseInt(i.css("padding-top"),10)-parseInt(i.css("padding-bottom"),10),ee.extend(a,{width:e,height:t,size:a.isHorizontal()?e:t}))},updateSlides:function(){var e=this,t=e.params,a=e.$wrapperEl,i=e.size,s=e.rtlTranslate,r=e.wrongRTL,n=e.virtual&&t.virtual.enabled,o=n?e.virtual.slides.length:e.slides.length,l=a.children("."+e.params.slideClass),d=n?e.virtual.slides.length:l.length,p=[],c=[],u=[],h=t.slidesOffsetBefore;"function"==typeof h&&(h=t.slidesOffsetBefore.call(e));var v=t.slidesOffsetAfter;"function"==typeof v&&(v=t.slidesOffsetAfter.call(e));var f=e.snapGrid.length,m=e.snapGrid.length,g=t.spaceBetween,b=-h,w=0,y=0;if(void 0!==i){var x,T;"string"==typeof g&&0<=g.indexOf("%")&&(g=parseFloat(g.replace("%",""))/100*i),e.virtualSize=-g,s?l.css({marginLeft:"",marginTop:""}):l.css({marginRight:"",marginBottom:""}),1<t.slidesPerColumn&&(x=Math.floor(d/t.slidesPerColumn)===d/e.params.slidesPerColumn?d:Math.ceil(d/t.slidesPerColumn)*t.slidesPerColumn,"auto"!==t.slidesPerView&&"row"===t.slidesPerColumnFill&&(x=Math.max(x,t.slidesPerView*t.slidesPerColumn)));for(var E,S=t.slidesPerColumn,C=x/S,M=Math.floor(d/t.slidesPerColumn),z=0;z<d;z+=1){T=0;var P=l.eq(z);if(1<t.slidesPerColumn){var k=void 0,$=void 0,L=void 0;"column"===t.slidesPerColumnFill?(L=z-($=Math.floor(z/S))*S,(M<$||$===M&&L===S-1)&&S<=(L+=1)&&(L=0,$+=1),k=$+L*x/S,P.css({"-webkit-box-ordinal-group":k,"-moz-box-ordinal-group":k,"-ms-flex-order":k,"-webkit-order":k,order:k})):$=z-(L=Math.floor(z/C))*C,P.css("margin-"+(e.isHorizontal()?"top":"left"),0!==L&&t.spaceBetween&&t.spaceBetween+"px").attr("data-swiper-column",$).attr("data-swiper-row",L)}if("none"!==P.css("display")){if("auto"===t.slidesPerView){var I=J.getComputedStyle(P[0],null),D=P[0].style.transform,O=P[0].style.webkitTransform;if(D&&(P[0].style.transform="none"),O&&(P[0].style.webkitTransform="none"),t.roundLengths)T=e.isHorizontal()?P.outerWidth(!0):P.outerHeight(!0);else if(e.isHorizontal()){var A=parseFloat(I.getPropertyValue("width")),H=parseFloat(I.getPropertyValue("padding-left")),N=parseFloat(I.getPropertyValue("padding-right")),G=parseFloat(I.getPropertyValue("margin-left")),B=parseFloat(I.getPropertyValue("margin-right")),X=I.getPropertyValue("box-sizing");T=X&&"border-box"===X?A+G+B:A+H+N+G+B}else{var Y=parseFloat(I.getPropertyValue("height")),V=parseFloat(I.getPropertyValue("padding-top")),F=parseFloat(I.getPropertyValue("padding-bottom")),R=parseFloat(I.getPropertyValue("margin-top")),q=parseFloat(I.getPropertyValue("margin-bottom")),W=I.getPropertyValue("box-sizing");T=W&&"border-box"===W?Y+R+q:Y+V+F+R+q}D&&(P[0].style.transform=D),O&&(P[0].style.webkitTransform=O),t.roundLengths&&(T=Math.floor(T))}else T=(i-(t.slidesPerView-1)*g)/t.slidesPerView,t.roundLengths&&(T=Math.floor(T)),l[z]&&(e.isHorizontal()?l[z].style.width=T+"px":l[z].style.height=T+"px");l[z]&&(l[z].swiperSlideSize=T),u.push(T),t.centeredSlides?(b=b+T/2+w/2+g,0===w&&0!==z&&(b=b-i/2-g),0===z&&(b=b-i/2-g),Math.abs(b)<.001&&(b=0),t.roundLengths&&(b=Math.floor(b)),y%t.slidesPerGroup==0&&p.push(b),c.push(b)):(t.roundLengths&&(b=Math.floor(b)),y%t.slidesPerGroup==0&&p.push(b),c.push(b),b=b+T+g),e.virtualSize+=T+g,w=T,y+=1}}if(e.virtualSize=Math.max(e.virtualSize,i)+v,s&&r&&("slide"===t.effect||"coverflow"===t.effect)&&a.css({width:e.virtualSize+t.spaceBetween+"px"}),te.flexbox&&!t.setWrapperSize||(e.isHorizontal()?a.css({width:e.virtualSize+t.spaceBetween+"px"}):a.css({height:e.virtualSize+t.spaceBetween+"px"})),1<t.slidesPerColumn&&(e.virtualSize=(T+t.spaceBetween)*x,e.virtualSize=Math.ceil(e.virtualSize/t.slidesPerColumn)-t.spaceBetween,e.isHorizontal()?a.css({width:e.virtualSize+t.spaceBetween+"px"}):a.css({height:e.virtualSize+t.spaceBetween+"px"}),t.centeredSlides)){E=[];for(var j=0;j<p.length;j+=1){var U=p[j];t.roundLengths&&(U=Math.floor(U)),p[j]<e.virtualSize+p[0]&&E.push(U)}p=E}if(!t.centeredSlides){E=[];for(var K=0;K<p.length;K+=1){var _=p[K];t.roundLengths&&(_=Math.floor(_)),p[K]<=e.virtualSize-i&&E.push(_)}p=E,1<Math.floor(e.virtualSize-i)-Math.floor(p[p.length-1])&&p.push(e.virtualSize-i)}if(0===p.length&&(p=[0]),0!==t.spaceBetween&&(e.isHorizontal()?s?l.css({marginLeft:g+"px"}):l.css({marginRight:g+"px"}):l.css({marginBottom:g+"px"})),t.centerInsufficientSlides){var Z=0;if(u.forEach(function(e){Z+=e+(t.spaceBetween?t.spaceBetween:0)}),(Z-=t.spaceBetween)<i){var Q=(i-Z)/2;p.forEach(function(e,t){p[t]=e-Q}),c.forEach(function(e,t){c[t]=e+Q})}}ee.extend(e,{slides:l,snapGrid:p,slidesGrid:c,slidesSizesGrid:u}),d!==o&&e.emit("slidesLengthChange"),p.length!==f&&(e.params.watchOverflow&&e.checkOverflow(),e.emit("snapGridLengthChange")),c.length!==m&&e.emit("slidesGridLengthChange"),(t.watchSlidesProgress||t.watchSlidesVisibility)&&e.updateSlidesOffset()}},updateAutoHeight:function(e){var t,a=this,i=[],s=0;if("number"==typeof e?a.setTransition(e):!0===e&&a.setTransition(a.params.speed),"auto"!==a.params.slidesPerView&&1<a.params.slidesPerView)for(t=0;t<Math.ceil(a.params.slidesPerView);t+=1){var r=a.activeIndex+t;if(r>a.slides.length)break;i.push(a.slides.eq(r)[0])}else i.push(a.slides.eq(a.activeIndex)[0]);for(t=0;t<i.length;t+=1)if(void 0!==i[t]){var n=i[t].offsetHeight;s=s<n?n:s}s&&a.$wrapperEl.css("height",s+"px")},updateSlidesOffset:function(){for(var e=this.slides,t=0;t<e.length;t+=1)e[t].swiperSlideOffset=this.isHorizontal()?e[t].offsetLeft:e[t].offsetTop},updateSlidesProgress:function(e){void 0===e&&(e=this&&this.translate||0);var t=this,a=t.params,i=t.slides,s=t.rtlTranslate;if(0!==i.length){void 0===i[0].swiperSlideOffset&&t.updateSlidesOffset();var r=-e;s&&(r=e),i.removeClass(a.slideVisibleClass),t.visibleSlidesIndexes=[],t.visibleSlides=[];for(var n=0;n<i.length;n+=1){var o=i[n],l=(r+(a.centeredSlides?t.minTranslate():0)-o.swiperSlideOffset)/(o.swiperSlideSize+a.spaceBetween);if(a.watchSlidesVisibility){var d=-(r-o.swiperSlideOffset),p=d+t.slidesSizesGrid[n];(0<=d&&d<t.size||0<p&&p<=t.size||d<=0&&p>=t.size)&&(t.visibleSlides.push(o),t.visibleSlidesIndexes.push(n),i.eq(n).addClass(a.slideVisibleClass))}o.progress=s?-l:l}t.visibleSlides=L(t.visibleSlides)}},updateProgress:function(e){void 0===e&&(e=this&&this.translate||0);var t=this,a=t.params,i=t.maxTranslate()-t.minTranslate(),s=t.progress,r=t.isBeginning,n=t.isEnd,o=r,l=n;0===i?n=r=!(s=0):(r=(s=(e-t.minTranslate())/i)<=0,n=1<=s),ee.extend(t,{progress:s,isBeginning:r,isEnd:n}),(a.watchSlidesProgress||a.watchSlidesVisibility)&&t.updateSlidesProgress(e),r&&!o&&t.emit("reachBeginning toEdge"),n&&!l&&t.emit("reachEnd toEdge"),(o&&!r||l&&!n)&&t.emit("fromEdge"),t.emit("progress",s)},updateSlidesClasses:function(){var e,t=this,a=t.slides,i=t.params,s=t.$wrapperEl,r=t.activeIndex,n=t.realIndex,o=t.virtual&&i.virtual.enabled;a.removeClass(i.slideActiveClass+" "+i.slideNextClass+" "+i.slidePrevClass+" "+i.slideDuplicateActiveClass+" "+i.slideDuplicateNextClass+" "+i.slideDuplicatePrevClass),(e=o?t.$wrapperEl.find("."+i.slideClass+'[data-swiper-slide-index="'+r+'"]'):a.eq(r)).addClass(i.slideActiveClass),i.loop&&(e.hasClass(i.slideDuplicateClass)?s.children("."+i.slideClass+":not(."+i.slideDuplicateClass+')[data-swiper-slide-index="'+n+'"]').addClass(i.slideDuplicateActiveClass):s.children("."+i.slideClass+"."+i.slideDuplicateClass+'[data-swiper-slide-index="'+n+'"]').addClass(i.slideDuplicateActiveClass));var l=e.nextAll("."+i.slideClass).eq(0).addClass(i.slideNextClass);i.loop&&0===l.length&&(l=a.eq(0)).addClass(i.slideNextClass);var d=e.prevAll("."+i.slideClass).eq(0).addClass(i.slidePrevClass);i.loop&&0===d.length&&(d=a.eq(-1)).addClass(i.slidePrevClass),i.loop&&(l.hasClass(i.slideDuplicateClass)?s.children("."+i.slideClass+":not(."+i.slideDuplicateClass+')[data-swiper-slide-index="'+l.attr("data-swiper-slide-index")+'"]').addClass(i.slideDuplicateNextClass):s.children("."+i.slideClass+"."+i.slideDuplicateClass+'[data-swiper-slide-index="'+l.attr("data-swiper-slide-index")+'"]').addClass(i.slideDuplicateNextClass),d.hasClass(i.slideDuplicateClass)?s.children("."+i.slideClass+":not(."+i.slideDuplicateClass+')[data-swiper-slide-index="'+d.attr("data-swiper-slide-index")+'"]').addClass(i.slideDuplicatePrevClass):s.children("."+i.slideClass+"."+i.slideDuplicateClass+'[data-swiper-slide-index="'+d.attr("data-swiper-slide-index")+'"]').addClass(i.slideDuplicatePrevClass))},updateActiveIndex:function(e){var t,a=this,i=a.rtlTranslate?a.translate:-a.translate,s=a.slidesGrid,r=a.snapGrid,n=a.params,o=a.activeIndex,l=a.realIndex,d=a.snapIndex,p=e;if(void 0===p){for(var c=0;c<s.length;c+=1)void 0!==s[c+1]?i>=s[c]&&i<s[c+1]-(s[c+1]-s[c])/2?p=c:i>=s[c]&&i<s[c+1]&&(p=c+1):i>=s[c]&&(p=c);n.normalizeSlideIndex&&(p<0||void 0===p)&&(p=0)}if((t=0<=r.indexOf(i)?r.indexOf(i):Math.floor(p/n.slidesPerGroup))>=r.length&&(t=r.length-1),p!==o){var u=parseInt(a.slides.eq(p).attr("data-swiper-slide-index")||p,10);ee.extend(a,{snapIndex:t,realIndex:u,previousIndex:o,activeIndex:p}),a.emit("activeIndexChange"),a.emit("snapIndexChange"),l!==u&&a.emit("realIndexChange"),a.emit("slideChange")}else t!==d&&(a.snapIndex=t,a.emit("snapIndexChange"))},updateClickedSlide:function(e){var t=this,a=t.params,i=L(e.target).closest("."+a.slideClass)[0],s=!1;if(i)for(var r=0;r<t.slides.length;r+=1)t.slides[r]===i&&(s=!0);if(!i||!s)return t.clickedSlide=void 0,void(t.clickedIndex=void 0);t.clickedSlide=i,t.virtual&&t.params.virtual.enabled?t.clickedIndex=parseInt(L(i).attr("data-swiper-slide-index"),10):t.clickedIndex=L(i).index(),a.slideToClickedSlide&&void 0!==t.clickedIndex&&t.clickedIndex!==t.activeIndex&&t.slideToClickedSlide()}};var p={getTranslate:function(e){void 0===e&&(e=this.isHorizontal()?"x":"y");var t=this.params,a=this.rtlTranslate,i=this.translate,s=this.$wrapperEl;if(t.virtualTranslate)return a?-i:i;var r=ee.getTranslate(s[0],e);return a&&(r=-r),r||0},setTranslate:function(e,t){var a=this,i=a.rtlTranslate,s=a.params,r=a.$wrapperEl,n=a.progress,o=0,l=0;a.isHorizontal()?o=i?-e:e:l=e,s.roundLengths&&(o=Math.floor(o),l=Math.floor(l)),s.virtualTranslate||(te.transforms3d?r.transform("translate3d("+o+"px, "+l+"px, 0px)"):r.transform("translate("+o+"px, "+l+"px)")),a.previousTranslate=a.translate,a.translate=a.isHorizontal()?o:l;var d=a.maxTranslate()-a.minTranslate();(0===d?0:(e-a.minTranslate())/d)!==n&&a.updateProgress(e),a.emit("setTranslate",a.translate,t)},minTranslate:function(){return-this.snapGrid[0]},maxTranslate:function(){return-this.snapGrid[this.snapGrid.length-1]}};var c={setTransition:function(e,t){this.$wrapperEl.transition(e),this.emit("setTransition",e,t)},transitionStart:function(e,t){void 0===e&&(e=!0);var a=this,i=a.activeIndex,s=a.params,r=a.previousIndex;s.autoHeight&&a.updateAutoHeight();var n=t;if(n||(n=r<i?"next":i<r?"prev":"reset"),a.emit("transitionStart"),e&&i!==r){if("reset"===n)return void a.emit("slideResetTransitionStart");a.emit("slideChangeTransitionStart"),"next"===n?a.emit("slideNextTransitionStart"):a.emit("slidePrevTransitionStart")}},transitionEnd:function(e,t){void 0===e&&(e=!0);var a=this,i=a.activeIndex,s=a.previousIndex;a.animating=!1,a.setTransition(0);var r=t;if(r||(r=s<i?"next":i<s?"prev":"reset"),a.emit("transitionEnd"),e&&i!==s){if("reset"===r)return void a.emit("slideResetTransitionEnd");a.emit("slideChangeTransitionEnd"),"next"===r?a.emit("slideNextTransitionEnd"):a.emit("slidePrevTransitionEnd")}}};var u={slideTo:function(e,t,a,i){void 0===e&&(e=0),void 0===t&&(t=this.params.speed),void 0===a&&(a=!0);var s=this,r=e;r<0&&(r=0);var n=s.params,o=s.snapGrid,l=s.slidesGrid,d=s.previousIndex,p=s.activeIndex,c=s.rtlTranslate;if(s.animating&&n.preventInteractionOnTransition)return!1;var u=Math.floor(r/n.slidesPerGroup);u>=o.length&&(u=o.length-1),(p||n.initialSlide||0)===(d||0)&&a&&s.emit("beforeSlideChangeStart");var h,v=-o[u];if(s.updateProgress(v),n.normalizeSlideIndex)for(var f=0;f<l.length;f+=1)-Math.floor(100*v)>=Math.floor(100*l[f])&&(r=f);if(s.initialized&&r!==p){if(!s.allowSlideNext&&v<s.translate&&v<s.minTranslate())return!1;if(!s.allowSlidePrev&&v>s.translate&&v>s.maxTranslate()&&(p||0)!==r)return!1}return h=p<r?"next":r<p?"prev":"reset",c&&-v===s.translate||!c&&v===s.translate?(s.updateActiveIndex(r),n.autoHeight&&s.updateAutoHeight(),s.updateSlidesClasses(),"slide"!==n.effect&&s.setTranslate(v),"reset"!==h&&(s.transitionStart(a,h),s.transitionEnd(a,h)),!1):(0!==t&&te.transition?(s.setTransition(t),s.setTranslate(v),s.updateActiveIndex(r),s.updateSlidesClasses(),s.emit("beforeTransitionStart",t,i),s.transitionStart(a,h),s.animating||(s.animating=!0,s.onSlideToWrapperTransitionEnd||(s.onSlideToWrapperTransitionEnd=function(e){s&&!s.destroyed&&e.target===this&&(s.$wrapperEl[0].removeEventListener("transitionend",s.onSlideToWrapperTransitionEnd),s.$wrapperEl[0].removeEventListener("webkitTransitionEnd",s.onSlideToWrapperTransitionEnd),s.onSlideToWrapperTransitionEnd=null,delete s.onSlideToWrapperTransitionEnd,s.transitionEnd(a,h))}),s.$wrapperEl[0].addEventListener("transitionend",s.onSlideToWrapperTransitionEnd),s.$wrapperEl[0].addEventListener("webkitTransitionEnd",s.onSlideToWrapperTransitionEnd))):(s.setTransition(0),s.setTranslate(v),s.updateActiveIndex(r),s.updateSlidesClasses(),s.emit("beforeTransitionStart",t,i),s.transitionStart(a,h),s.transitionEnd(a,h)),!0)},slideToLoop:function(e,t,a,i){void 0===e&&(e=0),void 0===t&&(t=this.params.speed),void 0===a&&(a=!0);var s=e;return this.params.loop&&(s+=this.loopedSlides),this.slideTo(s,t,a,i)},slideNext:function(e,t,a){void 0===e&&(e=this.params.speed),void 0===t&&(t=!0);var i=this,s=i.params,r=i.animating;return s.loop?!r&&(i.loopFix(),i._clientLeft=i.$wrapperEl[0].clientLeft,i.slideTo(i.activeIndex+s.slidesPerGroup,e,t,a)):i.slideTo(i.activeIndex+s.slidesPerGroup,e,t,a)},slidePrev:function(e,t,a){void 0===e&&(e=this.params.speed),void 0===t&&(t=!0);var i=this,s=i.params,r=i.animating,n=i.snapGrid,o=i.slidesGrid,l=i.rtlTranslate;if(s.loop){if(r)return!1;i.loopFix(),i._clientLeft=i.$wrapperEl[0].clientLeft}function d(e){return e<0?-Math.floor(Math.abs(e)):Math.floor(e)}var p,c=d(l?i.translate:-i.translate),u=n.map(function(e){return d(e)}),h=(o.map(function(e){return d(e)}),n[u.indexOf(c)],n[u.indexOf(c)-1]);return void 0!==h&&(p=o.indexOf(h))<0&&(p=i.activeIndex-1),i.slideTo(p,e,t,a)},slideReset:function(e,t,a){return void 0===e&&(e=this.params.speed),void 0===t&&(t=!0),this.slideTo(this.activeIndex,e,t,a)},slideToClosest:function(e,t,a){void 0===e&&(e=this.params.speed),void 0===t&&(t=!0);var i=this,s=i.activeIndex,r=Math.floor(s/i.params.slidesPerGroup);if(r<i.snapGrid.length-1){var n=i.rtlTranslate?i.translate:-i.translate,o=i.snapGrid[r];(i.snapGrid[r+1]-o)/2<n-o&&(s=i.params.slidesPerGroup)}return i.slideTo(s,e,t,a)},slideToClickedSlide:function(){var e,t=this,a=t.params,i=t.$wrapperEl,s="auto"===a.slidesPerView?t.slidesPerViewDynamic():a.slidesPerView,r=t.clickedIndex;if(a.loop){if(t.animating)return;e=parseInt(L(t.clickedSlide).attr("data-swiper-slide-index"),10),a.centeredSlides?r<t.loopedSlides-s/2||r>t.slides.length-t.loopedSlides+s/2?(t.loopFix(),r=i.children("."+a.slideClass+'[data-swiper-slide-index="'+e+'"]:not(.'+a.slideDuplicateClass+")").eq(0).index(),ee.nextTick(function(){t.slideTo(r)})):t.slideTo(r):r>t.slides.length-s?(t.loopFix(),r=i.children("."+a.slideClass+'[data-swiper-slide-index="'+e+'"]:not(.'+a.slideDuplicateClass+")").eq(0).index(),ee.nextTick(function(){t.slideTo(r)})):t.slideTo(r)}else t.slideTo(r)}};var h={loopCreate:function(){var i=this,e=i.params,t=i.$wrapperEl;t.children("."+e.slideClass+"."+e.slideDuplicateClass).remove();var s=t.children("."+e.slideClass);if(e.loopFillGroupWithBlank){var a=e.slidesPerGroup-s.length%e.slidesPerGroup;if(a!==e.slidesPerGroup){for(var r=0;r<a;r+=1){var n=L(f.createElement("div")).addClass(e.slideClass+" "+e.slideBlankClass);t.append(n)}s=t.children("."+e.slideClass)}}"auto"!==e.slidesPerView||e.loopedSlides||(e.loopedSlides=s.length),i.loopedSlides=parseInt(e.loopedSlides||e.slidesPerView,10),i.loopedSlides+=e.loopAdditionalSlides,i.loopedSlides>s.length&&(i.loopedSlides=s.length);var o=[],l=[];s.each(function(e,t){var a=L(t);e<i.loopedSlides&&l.push(t),e<s.length&&e>=s.length-i.loopedSlides&&o.push(t),a.attr("data-swiper-slide-index",e)});for(var d=0;d<l.length;d+=1)t.append(L(l[d].cloneNode(!0)).addClass(e.slideDuplicateClass));for(var p=o.length-1;0<=p;p-=1)t.prepend(L(o[p].cloneNode(!0)).addClass(e.slideDuplicateClass))},loopFix:function(){var e,t=this,a=t.params,i=t.activeIndex,s=t.slides,r=t.loopedSlides,n=t.allowSlidePrev,o=t.allowSlideNext,l=t.snapGrid,d=t.rtlTranslate;t.allowSlidePrev=!0,t.allowSlideNext=!0;var p=-l[i]-t.getTranslate();i<r?(e=s.length-3*r+i,e+=r,t.slideTo(e,0,!1,!0)&&0!==p&&t.setTranslate((d?-t.translate:t.translate)-p)):("auto"===a.slidesPerView&&2*r<=i||i>=s.length-r)&&(e=-s.length+i+r,e+=r,t.slideTo(e,0,!1,!0)&&0!==p&&t.setTranslate((d?-t.translate:t.translate)-p));t.allowSlidePrev=n,t.allowSlideNext=o},loopDestroy:function(){var e=this.$wrapperEl,t=this.params,a=this.slides;e.children("."+t.slideClass+"."+t.slideDuplicateClass+",."+t.slideClass+"."+t.slideBlankClass).remove(),a.removeAttr("data-swiper-slide-index")}};var v={setGrabCursor:function(e){if(!(te.touch||!this.params.simulateTouch||this.params.watchOverflow&&this.isLocked)){var t=this.el;t.style.cursor="move",t.style.cursor=e?"-webkit-grabbing":"-webkit-grab",t.style.cursor=e?"-moz-grabbin":"-moz-grab",t.style.cursor=e?"grabbing":"grab"}},unsetGrabCursor:function(){te.touch||this.params.watchOverflow&&this.isLocked||(this.el.style.cursor="")}};var m={appendSlide:function(e){var t=this,a=t.$wrapperEl,i=t.params;if(i.loop&&t.loopDestroy(),"object"==typeof e&&"length"in e)for(var s=0;s<e.length;s+=1)e[s]&&a.append(e[s]);else a.append(e);i.loop&&t.loopCreate(),i.observer&&te.observer||t.update()},prependSlide:function(e){var t=this,a=t.params,i=t.$wrapperEl,s=t.activeIndex;a.loop&&t.loopDestroy();var r=s+1;if("object"==typeof e&&"length"in e){for(var n=0;n<e.length;n+=1)e[n]&&i.prepend(e[n]);r=s+e.length}else i.prepend(e);a.loop&&t.loopCreate(),a.observer&&te.observer||t.update(),t.slideTo(r,0,!1)},addSlide:function(e,t){var a=this,i=a.$wrapperEl,s=a.params,r=a.activeIndex;s.loop&&(r-=a.loopedSlides,a.loopDestroy(),a.slides=i.children("."+s.slideClass));var n=a.slides.length;if(e<=0)a.prependSlide(t);else if(n<=e)a.appendSlide(t);else{for(var o=e<r?r+1:r,l=[],d=n-1;e<=d;d-=1){var p=a.slides.eq(d);p.remove(),l.unshift(p)}if("object"==typeof t&&"length"in t){for(var c=0;c<t.length;c+=1)t[c]&&i.append(t[c]);o=e<r?r+t.length:r}else i.append(t);for(var u=0;u<l.length;u+=1)i.append(l[u]);s.loop&&a.loopCreate(),s.observer&&te.observer||a.update(),s.loop?a.slideTo(o+a.loopedSlides,0,!1):a.slideTo(o,0,!1)}},removeSlide:function(e){var t=this,a=t.params,i=t.$wrapperEl,s=t.activeIndex;a.loop&&(s-=t.loopedSlides,t.loopDestroy(),t.slides=i.children("."+a.slideClass));var r,n=s;if("object"==typeof e&&"length"in e){for(var o=0;o<e.length;o+=1)r=e[o],t.slides[r]&&t.slides.eq(r).remove(),r<n&&(n-=1);n=Math.max(n,0)}else r=e,t.slides[r]&&t.slides.eq(r).remove(),r<n&&(n-=1),n=Math.max(n,0);a.loop&&t.loopCreate(),a.observer&&te.observer||t.update(),a.loop?t.slideTo(n+t.loopedSlides,0,!1):t.slideTo(n,0,!1)},removeAllSlides:function(){for(var e=[],t=0;t<this.slides.length;t+=1)e.push(t);this.removeSlide(e)}},g=function(){var e=J.navigator.userAgent,t={ios:!1,android:!1,androidChrome:!1,desktop:!1,windows:!1,iphone:!1,ipod:!1,ipad:!1,cordova:J.cordova||J.phonegap,phonegap:J.cordova||J.phonegap},a=e.match(/(Windows Phone);?[\s\/]+([\d.]+)?/),i=e.match(/(Android);?[\s\/]+([\d.]+)?/),s=e.match(/(iPad).*OS\s([\d_]+)/),r=e.match(/(iPod)(.*OS\s([\d_]+))?/),n=!s&&e.match(/(iPhone\sOS|iOS)\s([\d_]+)/);if(a&&(t.os="windows",t.osVersion=a[2],t.windows=!0),i&&!a&&(t.os="android",t.osVersion=i[2],t.android=!0,t.androidChrome=0<=e.toLowerCase().indexOf("chrome")),(s||n||r)&&(t.os="ios",t.ios=!0),n&&!r&&(t.osVersion=n[2].replace(/_/g,"."),t.iphone=!0),s&&(t.osVersion=s[2].replace(/_/g,"."),t.ipad=!0),r&&(t.osVersion=r[3]?r[3].replace(/_/g,"."):null,t.iphone=!0),t.ios&&t.osVersion&&0<=e.indexOf("Version/")&&"10"===t.osVersion.split(".")[0]&&(t.osVersion=e.toLowerCase().split("version/")[1].split(" ")[0]),t.desktop=!(t.os||t.android||t.webView),t.webView=(n||s||r)&&e.match(/.*AppleWebKit(?!.*Safari)/i),t.os&&"ios"===t.os){var o=t.osVersion.split("."),l=f.querySelector('meta[name="viewport"]');t.minimalUi=!t.webView&&(r||n)&&(1*o[0]==7?1<=1*o[1]:7<1*o[0])&&l&&0<=l.getAttribute("content").indexOf("minimal-ui")}return t.pixelRatio=J.devicePixelRatio||1,t}();function b(){var e=this,t=e.params,a=e.el;if(!a||0!==a.offsetWidth){t.breakpoints&&e.setBreakpoint();var i=e.allowSlideNext,s=e.allowSlidePrev,r=e.snapGrid;if(e.allowSlideNext=!0,e.allowSlidePrev=!0,e.updateSize(),e.updateSlides(),t.freeMode){var n=Math.min(Math.max(e.translate,e.maxTranslate()),e.minTranslate());e.setTranslate(n),e.updateActiveIndex(),e.updateSlidesClasses(),t.autoHeight&&e.updateAutoHeight()}else e.updateSlidesClasses(),("auto"===t.slidesPerView||1<t.slidesPerView)&&e.isEnd&&!e.params.centeredSlides?e.slideTo(e.slides.length-1,0,!1,!0):e.slideTo(e.activeIndex,0,!1,!0);e.allowSlidePrev=s,e.allowSlideNext=i,e.params.watchOverflow&&r!==e.snapGrid&&e.checkOverflow()}}var w={init:!0,direction:"horizontal",touchEventsTarget:"container",initialSlide:0,speed:300,preventInteractionOnTransition:!1,edgeSwipeDetection:!1,edgeSwipeThreshold:20,freeMode:!1,freeModeMomentum:!0,freeModeMomentumRatio:1,freeModeMomentumBounce:!0,freeModeMomentumBounceRatio:1,freeModeMomentumVelocityRatio:1,freeModeSticky:!1,freeModeMinimumVelocity:.02,autoHeight:!1,setWrapperSize:!1,virtualTranslate:!1,effect:"slide",breakpoints:void 0,breakpointsInverse:!1,spaceBetween:0,slidesPerView:1,slidesPerColumn:1,slidesPerColumnFill:"column",slidesPerGroup:1,centeredSlides:!1,slidesOffsetBefore:0,slidesOffsetAfter:0,normalizeSlideIndex:!0,centerInsufficientSlides:!1,watchOverflow:!1,roundLengths:!1,touchRatio:1,touchAngle:45,simulateTouch:!0,shortSwipes:!0,longSwipes:!0,longSwipesRatio:.5,longSwipesMs:300,followFinger:!0,allowTouchMove:!0,threshold:0,touchMoveStopPropagation:!0,touchStartPreventDefault:!0,touchStartForcePreventDefault:!1,touchReleaseOnEdges:!1,uniqueNavElements:!0,resistance:!0,resistanceRatio:.85,watchSlidesProgress:!1,watchSlidesVisibility:!1,grabCursor:!1,preventClicks:!0,preventClicksPropagation:!0,slideToClickedSlide:!1,preloadImages:!0,updateOnImagesReady:!0,loop:!1,loopAdditionalSlides:0,loopedSlides:null,loopFillGroupWithBlank:!1,allowSlidePrev:!0,allowSlideNext:!0,swipeHandler:null,noSwiping:!0,noSwipingClass:"swiper-no-swiping",noSwipingSelector:null,passiveListeners:!0,containerModifierClass:"swiper-container-",slideClass:"swiper-slide",slideBlankClass:"swiper-slide-invisible-blank",slideActiveClass:"swiper-slide-active",slideDuplicateActiveClass:"swiper-slide-duplicate-active",slideVisibleClass:"swiper-slide-visible",slideDuplicateClass:"swiper-slide-duplicate",slideNextClass:"swiper-slide-next",slideDuplicateNextClass:"swiper-slide-duplicate-next",slidePrevClass:"swiper-slide-prev",slideDuplicatePrevClass:"swiper-slide-duplicate-prev",wrapperClass:"swiper-wrapper",runCallbacksOnInit:!0},y={update:d,translate:p,transition:c,slide:u,loop:h,grabCursor:v,manipulation:m,events:{attachEvents:function(){var e=this,t=e.params,a=e.touchEvents,i=e.el,s=e.wrapperEl;e.onTouchStart=function(e){var t=this,a=t.touchEventsData,i=t.params,s=t.touches;if(!t.animating||!i.preventInteractionOnTransition){var r=e;if(r.originalEvent&&(r=r.originalEvent),a.isTouchEvent="touchstart"===r.type,(a.isTouchEvent||!("which"in r)||3!==r.which)&&!(!a.isTouchEvent&&"button"in r&&0<r.button||a.isTouched&&a.isMoved))if(i.noSwiping&&L(r.target).closest(i.noSwipingSelector?i.noSwipingSelector:"."+i.noSwipingClass)[0])t.allowClick=!0;else if(!i.swipeHandler||L(r).closest(i.swipeHandler)[0]){s.currentX="touchstart"===r.type?r.targetTouches[0].pageX:r.pageX,s.currentY="touchstart"===r.type?r.targetTouches[0].pageY:r.pageY;var n=s.currentX,o=s.currentY,l=i.edgeSwipeDetection||i.iOSEdgeSwipeDetection,d=i.edgeSwipeThreshold||i.iOSEdgeSwipeThreshold;if(!l||!(n<=d||n>=J.screen.width-d)){if(ee.extend(a,{isTouched:!0,isMoved:!1,allowTouchCallbacks:!0,isScrolling:void 0,startMoving:void 0}),s.startX=n,s.startY=o,a.touchStartTime=ee.now(),t.allowClick=!0,t.updateSize(),t.swipeDirection=void 0,0<i.threshold&&(a.allowThresholdMove=!1),"touchstart"!==r.type){var p=!0;L(r.target).is(a.formElements)&&(p=!1),f.activeElement&&L(f.activeElement).is(a.formElements)&&f.activeElement!==r.target&&f.activeElement.blur();var c=p&&t.allowTouchMove&&i.touchStartPreventDefault;(i.touchStartForcePreventDefault||c)&&r.preventDefault()}t.emit("touchStart",r)}}}}.bind(e),e.onTouchMove=function(e){var t=this,a=t.touchEventsData,i=t.params,s=t.touches,r=t.rtlTranslate,n=e;if(n.originalEvent&&(n=n.originalEvent),a.isTouched){if(!a.isTouchEvent||"mousemove"!==n.type){var o="touchmove"===n.type?n.targetTouches[0].pageX:n.pageX,l="touchmove"===n.type?n.targetTouches[0].pageY:n.pageY;if(n.preventedByNestedSwiper)return s.startX=o,void(s.startY=l);if(!t.allowTouchMove)return t.allowClick=!1,void(a.isTouched&&(ee.extend(s,{startX:o,startY:l,currentX:o,currentY:l}),a.touchStartTime=ee.now()));if(a.isTouchEvent&&i.touchReleaseOnEdges&&!i.loop)if(t.isVertical()){if(l<s.startY&&t.translate<=t.maxTranslate()||l>s.startY&&t.translate>=t.minTranslate())return a.isTouched=!1,void(a.isMoved=!1)}else if(o<s.startX&&t.translate<=t.maxTranslate()||o>s.startX&&t.translate>=t.minTranslate())return;if(a.isTouchEvent&&f.activeElement&&n.target===f.activeElement&&L(n.target).is(a.formElements))return a.isMoved=!0,void(t.allowClick=!1);if(a.allowTouchCallbacks&&t.emit("touchMove",n),!(n.targetTouches&&1<n.targetTouches.length)){s.currentX=o,s.currentY=l;var d,p=s.currentX-s.startX,c=s.currentY-s.startY;if(!(t.params.threshold&&Math.sqrt(Math.pow(p,2)+Math.pow(c,2))<t.params.threshold))if(void 0===a.isScrolling&&(t.isHorizontal()&&s.currentY===s.startY||t.isVertical()&&s.currentX===s.startX?a.isScrolling=!1:25<=p*p+c*c&&(d=180*Math.atan2(Math.abs(c),Math.abs(p))/Math.PI,a.isScrolling=t.isHorizontal()?d>i.touchAngle:90-d>i.touchAngle)),a.isScrolling&&t.emit("touchMoveOpposite",n),void 0===a.startMoving&&(s.currentX===s.startX&&s.currentY===s.startY||(a.startMoving=!0)),a.isScrolling)a.isTouched=!1;else if(a.startMoving){t.allowClick=!1,n.preventDefault(),i.touchMoveStopPropagation&&!i.nested&&n.stopPropagation(),a.isMoved||(i.loop&&t.loopFix(),a.startTranslate=t.getTranslate(),t.setTransition(0),t.animating&&t.$wrapperEl.trigger("webkitTransitionEnd transitionend"),a.allowMomentumBounce=!1,!i.grabCursor||!0!==t.allowSlideNext&&!0!==t.allowSlidePrev||t.setGrabCursor(!0),t.emit("sliderFirstMove",n)),t.emit("sliderMove",n),a.isMoved=!0;var u=t.isHorizontal()?p:c;s.diff=u,u*=i.touchRatio,r&&(u=-u),t.swipeDirection=0<u?"prev":"next",a.currentTranslate=u+a.startTranslate;var h=!0,v=i.resistanceRatio;if(i.touchReleaseOnEdges&&(v=0),0<u&&a.currentTranslate>t.minTranslate()?(h=!1,i.resistance&&(a.currentTranslate=t.minTranslate()-1+Math.pow(-t.minTranslate()+a.startTranslate+u,v))):u<0&&a.currentTranslate<t.maxTranslate()&&(h=!1,i.resistance&&(a.currentTranslate=t.maxTranslate()+1-Math.pow(t.maxTranslate()-a.startTranslate-u,v))),h&&(n.preventedByNestedSwiper=!0),!t.allowSlideNext&&"next"===t.swipeDirection&&a.currentTranslate<a.startTranslate&&(a.currentTranslate=a.startTranslate),!t.allowSlidePrev&&"prev"===t.swipeDirection&&a.currentTranslate>a.startTranslate&&(a.currentTranslate=a.startTranslate),0<i.threshold){if(!(Math.abs(u)>i.threshold||a.allowThresholdMove))return void(a.currentTranslate=a.startTranslate);if(!a.allowThresholdMove)return a.allowThresholdMove=!0,s.startX=s.currentX,s.startY=s.currentY,a.currentTranslate=a.startTranslate,void(s.diff=t.isHorizontal()?s.currentX-s.startX:s.currentY-s.startY)}i.followFinger&&((i.freeMode||i.watchSlidesProgress||i.watchSlidesVisibility)&&(t.updateActiveIndex(),t.updateSlidesClasses()),i.freeMode&&(0===a.velocities.length&&a.velocities.push({position:s[t.isHorizontal()?"startX":"startY"],time:a.touchStartTime}),a.velocities.push({position:s[t.isHorizontal()?"currentX":"currentY"],time:ee.now()})),t.updateProgress(a.currentTranslate),t.setTranslate(a.currentTranslate))}}}}else a.startMoving&&a.isScrolling&&t.emit("touchMoveOpposite",n)}.bind(e),e.onTouchEnd=function(e){var t=this,a=t.touchEventsData,i=t.params,s=t.touches,r=t.rtlTranslate,n=t.$wrapperEl,o=t.slidesGrid,l=t.snapGrid,d=e;if(d.originalEvent&&(d=d.originalEvent),a.allowTouchCallbacks&&t.emit("touchEnd",d),a.allowTouchCallbacks=!1,!a.isTouched)return a.isMoved&&i.grabCursor&&t.setGrabCursor(!1),a.isMoved=!1,void(a.startMoving=!1);i.grabCursor&&a.isMoved&&a.isTouched&&(!0===t.allowSlideNext||!0===t.allowSlidePrev)&&t.setGrabCursor(!1);var p,c=ee.now(),u=c-a.touchStartTime;if(t.allowClick&&(t.updateClickedSlide(d),t.emit("tap",d),u<300&&300<c-a.lastClickTime&&(a.clickTimeout&&clearTimeout(a.clickTimeout),a.clickTimeout=ee.nextTick(function(){t&&!t.destroyed&&t.emit("click",d)},300)),u<300&&c-a.lastClickTime<300&&(a.clickTimeout&&clearTimeout(a.clickTimeout),t.emit("doubleTap",d))),a.lastClickTime=ee.now(),ee.nextTick(function(){t.destroyed||(t.allowClick=!0)}),!a.isTouched||!a.isMoved||!t.swipeDirection||0===s.diff||a.currentTranslate===a.startTranslate)return a.isTouched=!1,a.isMoved=!1,void(a.startMoving=!1);if(a.isTouched=!1,a.isMoved=!1,a.startMoving=!1,p=i.followFinger?r?t.translate:-t.translate:-a.currentTranslate,i.freeMode){if(p<-t.minTranslate())return void t.slideTo(t.activeIndex);if(p>-t.maxTranslate())return void(t.slides.length<l.length?t.slideTo(l.length-1):t.slideTo(t.slides.length-1));if(i.freeModeMomentum){if(1<a.velocities.length){var h=a.velocities.pop(),v=a.velocities.pop(),f=h.position-v.position,m=h.time-v.time;t.velocity=f/m,t.velocity/=2,Math.abs(t.velocity)<i.freeModeMinimumVelocity&&(t.velocity=0),(150<m||300<ee.now()-h.time)&&(t.velocity=0)}else t.velocity=0;t.velocity*=i.freeModeMomentumVelocityRatio,a.velocities.length=0;var g=1e3*i.freeModeMomentumRatio,b=t.velocity*g,w=t.translate+b;r&&(w=-w);var y,x,T=!1,E=20*Math.abs(t.velocity)*i.freeModeMomentumBounceRatio;if(w<t.maxTranslate())i.freeModeMomentumBounce?(w+t.maxTranslate()<-E&&(w=t.maxTranslate()-E),y=t.maxTranslate(),T=!0,a.allowMomentumBounce=!0):w=t.maxTranslate(),i.loop&&i.centeredSlides&&(x=!0);else if(w>t.minTranslate())i.freeModeMomentumBounce?(w-t.minTranslate()>E&&(w=t.minTranslate()+E),y=t.minTranslate(),T=!0,a.allowMomentumBounce=!0):w=t.minTranslate(),i.loop&&i.centeredSlides&&(x=!0);else if(i.freeModeSticky){for(var S,C=0;C<l.length;C+=1)if(l[C]>-w){S=C;break}w=-(w=Math.abs(l[S]-w)<Math.abs(l[S-1]-w)||"next"===t.swipeDirection?l[S]:l[S-1])}if(x&&t.once("transitionEnd",function(){t.loopFix()}),0!==t.velocity)g=r?Math.abs((-w-t.translate)/t.velocity):Math.abs((w-t.translate)/t.velocity);else if(i.freeModeSticky)return void t.slideToClosest();i.freeModeMomentumBounce&&T?(t.updateProgress(y),t.setTransition(g),t.setTranslate(w),t.transitionStart(!0,t.swipeDirection),t.animating=!0,n.transitionEnd(function(){t&&!t.destroyed&&a.allowMomentumBounce&&(t.emit("momentumBounce"),t.setTransition(i.speed),t.setTranslate(y),n.transitionEnd(function(){t&&!t.destroyed&&t.transitionEnd()}))})):t.velocity?(t.updateProgress(w),t.setTransition(g),t.setTranslate(w),t.transitionStart(!0,t.swipeDirection),t.animating||(t.animating=!0,n.transitionEnd(function(){t&&!t.destroyed&&t.transitionEnd()}))):t.updateProgress(w),t.updateActiveIndex(),t.updateSlidesClasses()}else if(i.freeModeSticky)return void t.slideToClosest();(!i.freeModeMomentum||u>=i.longSwipesMs)&&(t.updateProgress(),t.updateActiveIndex(),t.updateSlidesClasses())}else{for(var M=0,z=t.slidesSizesGrid[0],P=0;P<o.length;P+=i.slidesPerGroup)void 0!==o[P+i.slidesPerGroup]?p>=o[P]&&p<o[P+i.slidesPerGroup]&&(z=o[(M=P)+i.slidesPerGroup]-o[P]):p>=o[P]&&(M=P,z=o[o.length-1]-o[o.length-2]);var k=(p-o[M])/z;if(u>i.longSwipesMs){if(!i.longSwipes)return void t.slideTo(t.activeIndex);"next"===t.swipeDirection&&(k>=i.longSwipesRatio?t.slideTo(M+i.slidesPerGroup):t.slideTo(M)),"prev"===t.swipeDirection&&(k>1-i.longSwipesRatio?t.slideTo(M+i.slidesPerGroup):t.slideTo(M))}else{if(!i.shortSwipes)return void t.slideTo(t.activeIndex);"next"===t.swipeDirection&&t.slideTo(M+i.slidesPerGroup),"prev"===t.swipeDirection&&t.slideTo(M)}}}.bind(e),e.onClick=function(e){this.allowClick||(this.params.preventClicks&&e.preventDefault(),this.params.preventClicksPropagation&&this.animating&&(e.stopPropagation(),e.stopImmediatePropagation()))}.bind(e);var r="container"===t.touchEventsTarget?i:s,n=!!t.nested;if(te.touch||!te.pointerEvents&&!te.prefixedPointerEvents){if(te.touch){var o=!("touchstart"!==a.start||!te.passiveListener||!t.passiveListeners)&&{passive:!0,capture:!1};r.addEventListener(a.start,e.onTouchStart,o),r.addEventListener(a.move,e.onTouchMove,te.passiveListener?{passive:!1,capture:n}:n),r.addEventListener(a.end,e.onTouchEnd,o)}(t.simulateTouch&&!g.ios&&!g.android||t.simulateTouch&&!te.touch&&g.ios)&&(r.addEventListener("mousedown",e.onTouchStart,!1),f.addEventListener("mousemove",e.onTouchMove,n),f.addEventListener("mouseup",e.onTouchEnd,!1))}else r.addEventListener(a.start,e.onTouchStart,!1),f.addEventListener(a.move,e.onTouchMove,n),f.addEventListener(a.end,e.onTouchEnd,!1);(t.preventClicks||t.preventClicksPropagation)&&r.addEventListener("click",e.onClick,!0),e.on(g.ios||g.android?"resize orientationchange observerUpdate":"resize observerUpdate",b,!0)},detachEvents:function(){var e=this,t=e.params,a=e.touchEvents,i=e.el,s=e.wrapperEl,r="container"===t.touchEventsTarget?i:s,n=!!t.nested;if(te.touch||!te.pointerEvents&&!te.prefixedPointerEvents){if(te.touch){var o=!("onTouchStart"!==a.start||!te.passiveListener||!t.passiveListeners)&&{passive:!0,capture:!1};r.removeEventListener(a.start,e.onTouchStart,o),r.removeEventListener(a.move,e.onTouchMove,n),r.removeEventListener(a.end,e.onTouchEnd,o)}(t.simulateTouch&&!g.ios&&!g.android||t.simulateTouch&&!te.touch&&g.ios)&&(r.removeEventListener("mousedown",e.onTouchStart,!1),f.removeEventListener("mousemove",e.onTouchMove,n),f.removeEventListener("mouseup",e.onTouchEnd,!1))}else r.removeEventListener(a.start,e.onTouchStart,!1),f.removeEventListener(a.move,e.onTouchMove,n),f.removeEventListener(a.end,e.onTouchEnd,!1);(t.preventClicks||t.preventClicksPropagation)&&r.removeEventListener("click",e.onClick,!0),e.off(g.ios||g.android?"resize orientationchange observerUpdate":"resize observerUpdate",b)}},breakpoints:{setBreakpoint:function(){var e=this,t=e.activeIndex,a=e.initialized,i=e.loopedSlides;void 0===i&&(i=0);var s=e.params,r=s.breakpoints;if(r&&(!r||0!==Object.keys(r).length)){var n=e.getBreakpoint(r);if(n&&e.currentBreakpoint!==n){var o=n in r?r[n]:void 0;o&&["slidesPerView","spaceBetween","slidesPerGroup"].forEach(function(e){var t=o[e];void 0!==t&&(o[e]="slidesPerView"!==e||"AUTO"!==t&&"auto"!==t?"slidesPerView"===e?parseFloat(t):parseInt(t,10):"auto")});var l=o||e.originalParams,d=l.direction&&l.direction!==s.direction,p=s.loop&&(l.slidesPerView!==s.slidesPerView||d);d&&a&&e.changeDirection(),ee.extend(e.params,l),ee.extend(e,{allowTouchMove:e.params.allowTouchMove,allowSlideNext:e.params.allowSlideNext,allowSlidePrev:e.params.allowSlidePrev}),e.currentBreakpoint=n,p&&a&&(e.loopDestroy(),e.loopCreate(),e.updateSlides(),e.slideTo(t-i+e.loopedSlides,0,!1)),e.emit("breakpoint",l)}}},getBreakpoint:function(e){if(e){var t=!1,a=[];Object.keys(e).forEach(function(e){a.push(e)}),a.sort(function(e,t){return parseInt(e,10)-parseInt(t,10)});for(var i=0;i<a.length;i+=1){var s=a[i];this.params.breakpointsInverse?s<=J.innerWidth&&(t=s):s>=J.innerWidth&&!t&&(t=s)}return t||"max"}}},checkOverflow:{checkOverflow:function(){var e=this,t=e.isLocked;e.isLocked=1===e.snapGrid.length,e.allowSlideNext=!e.isLocked,e.allowSlidePrev=!e.isLocked,t!==e.isLocked&&e.emit(e.isLocked?"lock":"unlock"),t&&t!==e.isLocked&&(e.isEnd=!1,e.navigation.update())}},classes:{addClasses:function(){var t=this.classNames,a=this.params,e=this.rtl,i=this.$el,s=[];s.push("initialized"),s.push(a.direction),a.freeMode&&s.push("free-mode"),te.flexbox||s.push("no-flexbox"),a.autoHeight&&s.push("autoheight"),e&&s.push("rtl"),1<a.slidesPerColumn&&s.push("multirow"),g.android&&s.push("android"),g.ios&&s.push("ios"),(I.isIE||I.isEdge)&&(te.pointerEvents||te.prefixedPointerEvents)&&s.push("wp8-"+a.direction),s.forEach(function(e){t.push(a.containerModifierClass+e)}),i.addClass(t.join(" "))},removeClasses:function(){var e=this.$el,t=this.classNames;e.removeClass(t.join(" "))}},images:{loadImage:function(e,t,a,i,s,r){var n;function o(){r&&r()}e.complete&&s?o():t?((n=new J.Image).onload=o,n.onerror=o,i&&(n.sizes=i),a&&(n.srcset=a),t&&(n.src=t)):o()},preloadImages:function(){var e=this;function t(){null!=e&&e&&!e.destroyed&&(void 0!==e.imagesLoaded&&(e.imagesLoaded+=1),e.imagesLoaded===e.imagesToLoad.length&&(e.params.updateOnImagesReady&&e.update(),e.emit("imagesReady")))}e.imagesToLoad=e.$el.find("img");for(var a=0;a<e.imagesToLoad.length;a+=1){var i=e.imagesToLoad[a];e.loadImage(i,i.currentSrc||i.getAttribute("src"),i.srcset||i.getAttribute("srcset"),i.sizes||i.getAttribute("sizes"),!0,t)}}}},x={},T=function(u){function h(){for(var e,t,s,a=[],i=arguments.length;i--;)a[i]=arguments[i];1===a.length&&a[0].constructor&&a[0].constructor===Object?s=a[0]:(t=(e=a)[0],s=e[1]),s||(s={}),s=ee.extend({},s),t&&!s.el&&(s.el=t),u.call(this,s),Object.keys(y).forEach(function(t){Object.keys(y[t]).forEach(function(e){h.prototype[e]||(h.prototype[e]=y[t][e])})});var r=this;void 0===r.modules&&(r.modules={}),Object.keys(r.modules).forEach(function(e){var t=r.modules[e];if(t.params){var a=Object.keys(t.params)[0],i=t.params[a];if("object"!=typeof i||null===i)return;if(!(a in s&&"enabled"in i))return;!0===s[a]&&(s[a]={enabled:!0}),"object"!=typeof s[a]||"enabled"in s[a]||(s[a].enabled=!0),s[a]||(s[a]={enabled:!1})}});var n=ee.extend({},w);r.useModulesParams(n),r.params=ee.extend({},n,x,s),r.originalParams=ee.extend({},r.params),r.passedParams=ee.extend({},s);var o=(r.$=L)(r.params.el);if(t=o[0]){if(1<o.length){var l=[];return o.each(function(e,t){var a=ee.extend({},s,{el:t});l.push(new h(a))}),l}t.swiper=r,o.data("swiper",r);var d,p,c=o.children("."+r.params.wrapperClass);return ee.extend(r,{$el:o,el:t,$wrapperEl:c,wrapperEl:c[0],classNames:[],slides:L(),slidesGrid:[],snapGrid:[],slidesSizesGrid:[],isHorizontal:function(){return"horizontal"===r.params.direction},isVertical:function(){return"vertical"===r.params.direction},rtl:"rtl"===t.dir.toLowerCase()||"rtl"===o.css("direction"),rtlTranslate:"horizontal"===r.params.direction&&("rtl"===t.dir.toLowerCase()||"rtl"===o.css("direction")),wrongRTL:"-webkit-box"===c.css("display"),activeIndex:0,realIndex:0,isBeginning:!0,isEnd:!1,translate:0,previousTranslate:0,progress:0,velocity:0,animating:!1,allowSlideNext:r.params.allowSlideNext,allowSlidePrev:r.params.allowSlidePrev,touchEvents:(d=["touchstart","touchmove","touchend"],p=["mousedown","mousemove","mouseup"],te.pointerEvents?p=["pointerdown","pointermove","pointerup"]:te.prefixedPointerEvents&&(p=["MSPointerDown","MSPointerMove","MSPointerUp"]),r.touchEventsTouch={start:d[0],move:d[1],end:d[2]},r.touchEventsDesktop={start:p[0],move:p[1],end:p[2]},te.touch||!r.params.simulateTouch?r.touchEventsTouch:r.touchEventsDesktop),touchEventsData:{isTouched:void 0,isMoved:void 0,allowTouchCallbacks:void 0,touchStartTime:void 0,isScrolling:void 0,currentTranslate:void 0,startTranslate:void 0,allowThresholdMove:void 0,formElements:"input, select, option, textarea, button, video",lastClickTime:ee.now(),clickTimeout:void 0,velocities:[],allowMomentumBounce:void 0,isTouchEvent:void 0,startMoving:void 0},allowClick:!0,allowTouchMove:r.params.allowTouchMove,touches:{startX:0,startY:0,currentX:0,currentY:0,diff:0},imagesToLoad:[],imagesLoaded:0}),r.useModules(),r.params.init&&r.init(),r}}u&&(h.__proto__=u);var e={extendedDefaults:{configurable:!0},defaults:{configurable:!0},Class:{configurable:!0},$:{configurable:!0}};return((h.prototype=Object.create(u&&u.prototype)).constructor=h).prototype.slidesPerViewDynamic=function(){var e=this,t=e.params,a=e.slides,i=e.slidesGrid,s=e.size,r=e.activeIndex,n=1;if(t.centeredSlides){for(var o,l=a[r].swiperSlideSize,d=r+1;d<a.length;d+=1)a[d]&&!o&&(n+=1,s<(l+=a[d].swiperSlideSize)&&(o=!0));for(var p=r-1;0<=p;p-=1)a[p]&&!o&&(n+=1,s<(l+=a[p].swiperSlideSize)&&(o=!0))}else for(var c=r+1;c<a.length;c+=1)i[c]-i[r]<s&&(n+=1);return n},h.prototype.update=function(){var a=this;if(a&&!a.destroyed){var e=a.snapGrid,t=a.params;t.breakpoints&&a.setBreakpoint(),a.updateSize(),a.updateSlides(),a.updateProgress(),a.updateSlidesClasses(),a.params.freeMode?(i(),a.params.autoHeight&&a.updateAutoHeight()):(("auto"===a.params.slidesPerView||1<a.params.slidesPerView)&&a.isEnd&&!a.params.centeredSlides?a.slideTo(a.slides.length-1,0,!1,!0):a.slideTo(a.activeIndex,0,!1,!0))||i(),t.watchOverflow&&e!==a.snapGrid&&a.checkOverflow(),a.emit("update")}function i(){var e=a.rtlTranslate?-1*a.translate:a.translate,t=Math.min(Math.max(e,a.maxTranslate()),a.minTranslate());a.setTranslate(t),a.updateActiveIndex(),a.updateSlidesClasses()}},h.prototype.changeDirection=function(a,e){void 0===e&&(e=!0);var t=this,i=t.params.direction;return a||(a="horizontal"===i?"vertical":"horizontal"),a===i||"horizontal"!==a&&"vertical"!==a||("vertical"===i&&(t.$el.removeClass(t.params.containerModifierClass+"vertical wp8-vertical").addClass(""+t.params.containerModifierClass+a),(I.isIE||I.isEdge)&&(te.pointerEvents||te.prefixedPointerEvents)&&t.$el.addClass(t.params.containerModifierClass+"wp8-"+a)),"horizontal"===i&&(t.$el.removeClass(t.params.containerModifierClass+"horizontal wp8-horizontal").addClass(""+t.params.containerModifierClass+a),(I.isIE||I.isEdge)&&(te.pointerEvents||te.prefixedPointerEvents)&&t.$el.addClass(t.params.containerModifierClass+"wp8-"+a)),t.params.direction=a,t.slides.each(function(e,t){"vertical"===a?t.style.width="":t.style.height=""}),t.emit("changeDirection"),e&&t.update()),t},h.prototype.init=function(){var e=this;e.initialized||(e.emit("beforeInit"),e.params.breakpoints&&e.setBreakpoint(),e.addClasses(),e.params.loop&&e.loopCreate(),e.updateSize(),e.updateSlides(),e.params.watchOverflow&&e.checkOverflow(),e.params.grabCursor&&e.setGrabCursor(),e.params.preloadImages&&e.preloadImages(),e.params.loop?e.slideTo(e.params.initialSlide+e.loopedSlides,0,e.params.runCallbacksOnInit):e.slideTo(e.params.initialSlide,0,e.params.runCallbacksOnInit),e.attachEvents(),e.initialized=!0,e.emit("init"))},h.prototype.destroy=function(e,t){void 0===e&&(e=!0),void 0===t&&(t=!0);var a=this,i=a.params,s=a.$el,r=a.$wrapperEl,n=a.slides;return void 0===a.params||a.destroyed||(a.emit("beforeDestroy"),a.initialized=!1,a.detachEvents(),i.loop&&a.loopDestroy(),t&&(a.removeClasses(),s.removeAttr("style"),r.removeAttr("style"),n&&n.length&&n.removeClass([i.slideVisibleClass,i.slideActiveClass,i.slideNextClass,i.slidePrevClass].join(" ")).removeAttr("style").removeAttr("data-swiper-slide-index").removeAttr("data-swiper-column").removeAttr("data-swiper-row")),a.emit("destroy"),Object.keys(a.eventsListeners).forEach(function(e){a.off(e)}),!1!==e&&(a.$el[0].swiper=null,a.$el.data("swiper",null),ee.deleteProps(a)),a.destroyed=!0),null},h.extendDefaults=function(e){ee.extend(x,e)},e.extendedDefaults.get=function(){return x},e.defaults.get=function(){return w},e.Class.get=function(){return u},e.$.get=function(){return L},Object.defineProperties(h,e),h}(n),E={name:"device",proto:{device:g},static:{device:g}},S={name:"support",proto:{support:te},static:{support:te}},C={name:"browser",proto:{browser:I},static:{browser:I}},M={name:"resize",create:function(){var e=this;ee.extend(e,{resize:{resizeHandler:function(){e&&!e.destroyed&&e.initialized&&(e.emit("beforeResize"),e.emit("resize"))},orientationChangeHandler:function(){e&&!e.destroyed&&e.initialized&&e.emit("orientationchange")}}})},on:{init:function(){J.addEventListener("resize",this.resize.resizeHandler),J.addEventListener("orientationchange",this.resize.orientationChangeHandler)},destroy:function(){J.removeEventListener("resize",this.resize.resizeHandler),J.removeEventListener("orientationchange",this.resize.orientationChangeHandler)}}},z={func:J.MutationObserver||J.WebkitMutationObserver,attach:function(e,t){void 0===t&&(t={});var a=this,i=new z.func(function(e){if(1!==e.length){var t=function(){a.emit("observerUpdate",e[0])};J.requestAnimationFrame?J.requestAnimationFrame(t):J.setTimeout(t,0)}else a.emit("observerUpdate",e[0])});i.observe(e,{attributes:void 0===t.attributes||t.attributes,childList:void 0===t.childList||t.childList,characterData:void 0===t.characterData||t.characterData}),a.observer.observers.push(i)},init:function(){var e=this;if(te.observer&&e.params.observer){if(e.params.observeParents)for(var t=e.$el.parents(),a=0;a<t.length;a+=1)e.observer.attach(t[a]);e.observer.attach(e.$el[0],{childList:e.params.observeSlideChildren}),e.observer.attach(e.$wrapperEl[0],{attributes:!1})}},destroy:function(){this.observer.observers.forEach(function(e){e.disconnect()}),this.observer.observers=[]}},P={name:"observer",params:{observer:!1,observeParents:!1,observeSlideChildren:!1},create:function(){ee.extend(this,{observer:{init:z.init.bind(this),attach:z.attach.bind(this),destroy:z.destroy.bind(this),observers:[]}})},on:{init:function(){this.observer.init()},destroy:function(){this.observer.destroy()}}},k={update:function(e){var t=this,a=t.params,i=a.slidesPerView,s=a.slidesPerGroup,r=a.centeredSlides,n=t.params.virtual,o=n.addSlidesBefore,l=n.addSlidesAfter,d=t.virtual,p=d.from,c=d.to,u=d.slides,h=d.slidesGrid,v=d.renderSlide,f=d.offset;t.updateActiveIndex();var m,g,b,w=t.activeIndex||0;m=t.rtlTranslate?"right":t.isHorizontal()?"left":"top",r?(g=Math.floor(i/2)+s+o,b=Math.floor(i/2)+s+l):(g=i+(s-1)+o,b=s+l);var y=Math.max((w||0)-b,0),x=Math.min((w||0)+g,u.length-1),T=(t.slidesGrid[y]||0)-(t.slidesGrid[0]||0);function E(){t.updateSlides(),t.updateProgress(),t.updateSlidesClasses(),t.lazy&&t.params.lazy.enabled&&t.lazy.load()}if(ee.extend(t.virtual,{from:y,to:x,offset:T,slidesGrid:t.slidesGrid}),p===y&&c===x&&!e)return t.slidesGrid!==h&&T!==f&&t.slides.css(m,T+"px"),void t.updateProgress();if(t.params.virtual.renderExternal)return t.params.virtual.renderExternal.call(t,{offset:T,from:y,to:x,slides:function(){for(var e=[],t=y;t<=x;t+=1)e.push(u[t]);return e}()}),void E();var S=[],C=[];if(e)t.$wrapperEl.find("."+t.params.slideClass).remove();else for(var M=p;M<=c;M+=1)(M<y||x<M)&&t.$wrapperEl.find("."+t.params.slideClass+'[data-swiper-slide-index="'+M+'"]').remove();for(var z=0;z<u.length;z+=1)y<=z&&z<=x&&(void 0===c||e?C.push(z):(c<z&&C.push(z),z<p&&S.push(z)));C.forEach(function(e){t.$wrapperEl.append(v(u[e],e))}),S.sort(function(e,t){return t-e}).forEach(function(e){t.$wrapperEl.prepend(v(u[e],e))}),t.$wrapperEl.children(".swiper-slide").css(m,T+"px"),E()},renderSlide:function(e,t){var a=this,i=a.params.virtual;if(i.cache&&a.virtual.cache[t])return a.virtual.cache[t];var s=i.renderSlide?L(i.renderSlide.call(a,e,t)):L('<div class="'+a.params.slideClass+'" data-swiper-slide-index="'+t+'">'+e+"</div>");return s.attr("data-swiper-slide-index")||s.attr("data-swiper-slide-index",t),i.cache&&(a.virtual.cache[t]=s),s},appendSlide:function(e){if("object"==typeof e&&"length"in e)for(var t=0;t<e.length;t+=1)e[t]&&this.virtual.slides.push(e[t]);else this.virtual.slides.push(e);this.virtual.update(!0)},prependSlide:function(e){var t=this,a=t.activeIndex,i=a+1,s=1;if(Array.isArray(e)){for(var r=0;r<e.length;r+=1)e[r]&&t.virtual.slides.unshift(e[r]);i=a+e.length,s=e.length}else t.virtual.slides.unshift(e);if(t.params.virtual.cache){var n=t.virtual.cache,o={};Object.keys(n).forEach(function(e){o[parseInt(e,10)+s]=n[e]}),t.virtual.cache=o}t.virtual.update(!0),t.slideTo(i,0)},removeSlide:function(e){var t=this;if(null!=e){var a=t.activeIndex;if(Array.isArray(e))for(var i=e.length-1;0<=i;i-=1)t.virtual.slides.splice(e[i],1),t.params.virtual.cache&&delete t.virtual.cache[e[i]],e[i]<a&&(a-=1),a=Math.max(a,0);else t.virtual.slides.splice(e,1),t.params.virtual.cache&&delete t.virtual.cache[e],e<a&&(a-=1),a=Math.max(a,0);t.virtual.update(!0),t.slideTo(a,0)}},removeAllSlides:function(){var e=this;e.virtual.slides=[],e.params.virtual.cache&&(e.virtual.cache={}),e.virtual.update(!0),e.slideTo(0,0)}},$={name:"virtual",params:{virtual:{enabled:!1,slides:[],cache:!0,renderSlide:null,renderExternal:null,addSlidesBefore:0,addSlidesAfter:0}},create:function(){var e=this;ee.extend(e,{virtual:{update:k.update.bind(e),appendSlide:k.appendSlide.bind(e),prependSlide:k.prependSlide.bind(e),removeSlide:k.removeSlide.bind(e),removeAllSlides:k.removeAllSlides.bind(e),renderSlide:k.renderSlide.bind(e),slides:e.params.virtual.slides,cache:{}}})},on:{beforeInit:function(){var e=this;if(e.params.virtual.enabled){e.classNames.push(e.params.containerModifierClass+"virtual");var t={watchSlidesProgress:!0};ee.extend(e.params,t),ee.extend(e.originalParams,t),e.params.initialSlide||e.virtual.update()}},setTranslate:function(){this.params.virtual.enabled&&this.virtual.update()}}},D={handle:function(e){var t=this,a=t.rtlTranslate,i=e;i.originalEvent&&(i=i.originalEvent);var s=i.keyCode||i.charCode;if(!t.allowSlideNext&&(t.isHorizontal()&&39===s||t.isVertical()&&40===s))return!1;if(!t.allowSlidePrev&&(t.isHorizontal()&&37===s||t.isVertical()&&38===s))return!1;if(!(i.shiftKey||i.altKey||i.ctrlKey||i.metaKey||f.activeElement&&f.activeElement.nodeName&&("input"===f.activeElement.nodeName.toLowerCase()||"textarea"===f.activeElement.nodeName.toLowerCase()))){if(t.params.keyboard.onlyInViewport&&(37===s||39===s||38===s||40===s)){var r=!1;if(0<t.$el.parents("."+t.params.slideClass).length&&0===t.$el.parents("."+t.params.slideActiveClass).length)return;var n=J.innerWidth,o=J.innerHeight,l=t.$el.offset();a&&(l.left-=t.$el[0].scrollLeft);for(var d=[[l.left,l.top],[l.left+t.width,l.top],[l.left,l.top+t.height],[l.left+t.width,l.top+t.height]],p=0;p<d.length;p+=1){var c=d[p];0<=c[0]&&c[0]<=n&&0<=c[1]&&c[1]<=o&&(r=!0)}if(!r)return}t.isHorizontal()?(37!==s&&39!==s||(i.preventDefault?i.preventDefault():i.returnValue=!1),(39===s&&!a||37===s&&a)&&t.slideNext(),(37===s&&!a||39===s&&a)&&t.slidePrev()):(38!==s&&40!==s||(i.preventDefault?i.preventDefault():i.returnValue=!1),40===s&&t.slideNext(),38===s&&t.slidePrev()),t.emit("keyPress",s)}},enable:function(){this.keyboard.enabled||(L(f).on("keydown",this.keyboard.handle),this.keyboard.enabled=!0)},disable:function(){this.keyboard.enabled&&(L(f).off("keydown",this.keyboard.handle),this.keyboard.enabled=!1)}},O={name:"keyboard",params:{keyboard:{enabled:!1,onlyInViewport:!0}},create:function(){ee.extend(this,{keyboard:{enabled:!1,enable:D.enable.bind(this),disable:D.disable.bind(this),handle:D.handle.bind(this)}})},on:{init:function(){this.params.keyboard.enabled&&this.keyboard.enable()},destroy:function(){this.keyboard.enabled&&this.keyboard.disable()}}};var A={lastScrollTime:ee.now(),event:-1<J.navigator.userAgent.indexOf("firefox")?"DOMMouseScroll":function(){var e="onwheel",t=e in f;if(!t){var a=f.createElement("div");a.setAttribute(e,"return;"),t="function"==typeof a[e]}return!t&&f.implementation&&f.implementation.hasFeature&&!0!==f.implementation.hasFeature("","")&&(t=f.implementation.hasFeature("Events.wheel","3.0")),t}()?"wheel":"mousewheel",normalize:function(e){var t=0,a=0,i=0,s=0;return"detail"in e&&(a=e.detail),"wheelDelta"in e&&(a=-e.wheelDelta/120),"wheelDeltaY"in e&&(a=-e.wheelDeltaY/120),"wheelDeltaX"in e&&(t=-e.wheelDeltaX/120),"axis"in e&&e.axis===e.HORIZONTAL_AXIS&&(t=a,a=0),i=10*t,s=10*a,"deltaY"in e&&(s=e.deltaY),"deltaX"in e&&(i=e.deltaX),(i||s)&&e.deltaMode&&(1===e.deltaMode?(i*=40,s*=40):(i*=800,s*=800)),i&&!t&&(t=i<1?-1:1),s&&!a&&(a=s<1?-1:1),{spinX:t,spinY:a,pixelX:i,pixelY:s}},handleMouseEnter:function(){this.mouseEntered=!0},handleMouseLeave:function(){this.mouseEntered=!1},handle:function(e){var t=e,a=this,i=a.params.mousewheel;if(!a.mouseEntered&&!i.releaseOnEdges)return!0;t.originalEvent&&(t=t.originalEvent);var s=0,r=a.rtlTranslate?-1:1,n=A.normalize(t);if(i.forceToAxis)if(a.isHorizontal()){if(!(Math.abs(n.pixelX)>Math.abs(n.pixelY)))return!0;s=n.pixelX*r}else{if(!(Math.abs(n.pixelY)>Math.abs(n.pixelX)))return!0;s=n.pixelY}else s=Math.abs(n.pixelX)>Math.abs(n.pixelY)?-n.pixelX*r:-n.pixelY;if(0===s)return!0;if(i.invert&&(s=-s),a.params.freeMode){a.params.loop&&a.loopFix();var o=a.getTranslate()+s*i.sensitivity,l=a.isBeginning,d=a.isEnd;if(o>=a.minTranslate()&&(o=a.minTranslate()),o<=a.maxTranslate()&&(o=a.maxTranslate()),a.setTransition(0),a.setTranslate(o),a.updateProgress(),a.updateActiveIndex(),a.updateSlidesClasses(),(!l&&a.isBeginning||!d&&a.isEnd)&&a.updateSlidesClasses(),a.params.freeModeSticky&&(clearTimeout(a.mousewheel.timeout),a.mousewheel.timeout=ee.nextTick(function(){a.slideToClosest()},300)),a.emit("scroll",t),a.params.autoplay&&a.params.autoplayDisableOnInteraction&&a.autoplay.stop(),o===a.minTranslate()||o===a.maxTranslate())return!0}else{if(60<ee.now()-a.mousewheel.lastScrollTime)if(s<0)if(a.isEnd&&!a.params.loop||a.animating){if(i.releaseOnEdges)return!0}else a.slideNext(),a.emit("scroll",t);else if(a.isBeginning&&!a.params.loop||a.animating){if(i.releaseOnEdges)return!0}else a.slidePrev(),a.emit("scroll",t);a.mousewheel.lastScrollTime=(new J.Date).getTime()}return t.preventDefault?t.preventDefault():t.returnValue=!1,!1},enable:function(){var e=this;if(!A.event)return!1;if(e.mousewheel.enabled)return!1;var t=e.$el;return"container"!==e.params.mousewheel.eventsTarged&&(t=L(e.params.mousewheel.eventsTarged)),t.on("mouseenter",e.mousewheel.handleMouseEnter),t.on("mouseleave",e.mousewheel.handleMouseLeave),t.on(A.event,e.mousewheel.handle),e.mousewheel.enabled=!0},disable:function(){var e=this;if(!A.event)return!1;if(!e.mousewheel.enabled)return!1;var t=e.$el;return"container"!==e.params.mousewheel.eventsTarged&&(t=L(e.params.mousewheel.eventsTarged)),t.off(A.event,e.mousewheel.handle),!(e.mousewheel.enabled=!1)}},H={update:function(){var e=this,t=e.params.navigation;if(!e.params.loop){var a=e.navigation,i=a.$nextEl,s=a.$prevEl;s&&0<s.length&&(e.isBeginning?s.addClass(t.disabledClass):s.removeClass(t.disabledClass),s[e.params.watchOverflow&&e.isLocked?"addClass":"removeClass"](t.lockClass)),i&&0<i.length&&(e.isEnd?i.addClass(t.disabledClass):i.removeClass(t.disabledClass),i[e.params.watchOverflow&&e.isLocked?"addClass":"removeClass"](t.lockClass))}},onPrevClick:function(e){e.preventDefault(),this.isBeginning&&!this.params.loop||this.slidePrev()},onNextClick:function(e){e.preventDefault(),this.isEnd&&!this.params.loop||this.slideNext()},init:function(){var e,t,a=this,i=a.params.navigation;(i.nextEl||i.prevEl)&&(i.nextEl&&(e=L(i.nextEl),a.params.uniqueNavElements&&"string"==typeof i.nextEl&&1<e.length&&1===a.$el.find(i.nextEl).length&&(e=a.$el.find(i.nextEl))),i.prevEl&&(t=L(i.prevEl),a.params.uniqueNavElements&&"string"==typeof i.prevEl&&1<t.length&&1===a.$el.find(i.prevEl).length&&(t=a.$el.find(i.prevEl))),e&&0<e.length&&e.on("click",a.navigation.onNextClick),t&&0<t.length&&t.on("click",a.navigation.onPrevClick),ee.extend(a.navigation,{$nextEl:e,nextEl:e&&e[0],$prevEl:t,prevEl:t&&t[0]}))},destroy:function(){var e=this,t=e.navigation,a=t.$nextEl,i=t.$prevEl;a&&a.length&&(a.off("click",e.navigation.onNextClick),a.removeClass(e.params.navigation.disabledClass)),i&&i.length&&(i.off("click",e.navigation.onPrevClick),i.removeClass(e.params.navigation.disabledClass))}},N={update:function(){var e=this,t=e.rtl,s=e.params.pagination;if(s.el&&e.pagination.el&&e.pagination.$el&&0!==e.pagination.$el.length){var r,a=e.virtual&&e.params.virtual.enabled?e.virtual.slides.length:e.slides.length,i=e.pagination.$el,n=e.params.loop?Math.ceil((a-2*e.loopedSlides)/e.params.slidesPerGroup):e.snapGrid.length;if(e.params.loop?((r=Math.ceil((e.activeIndex-e.loopedSlides)/e.params.slidesPerGroup))>a-1-2*e.loopedSlides&&(r-=a-2*e.loopedSlides),n-1<r&&(r-=n),r<0&&"bullets"!==e.params.paginationType&&(r=n+r)):r=void 0!==e.snapIndex?e.snapIndex:e.activeIndex||0,"bullets"===s.type&&e.pagination.bullets&&0<e.pagination.bullets.length){var o,l,d,p=e.pagination.bullets;if(s.dynamicBullets&&(e.pagination.bulletSize=p.eq(0)[e.isHorizontal()?"outerWidth":"outerHeight"](!0),i.css(e.isHorizontal()?"width":"height",e.pagination.bulletSize*(s.dynamicMainBullets+4)+"px"),1<s.dynamicMainBullets&&void 0!==e.previousIndex&&(e.pagination.dynamicBulletIndex+=r-e.previousIndex,e.pagination.dynamicBulletIndex>s.dynamicMainBullets-1?e.pagination.dynamicBulletIndex=s.dynamicMainBullets-1:e.pagination.dynamicBulletIndex<0&&(e.pagination.dynamicBulletIndex=0)),o=r-e.pagination.dynamicBulletIndex,d=((l=o+(Math.min(p.length,s.dynamicMainBullets)-1))+o)/2),p.removeClass(s.bulletActiveClass+" "+s.bulletActiveClass+"-next "+s.bulletActiveClass+"-next-next "+s.bulletActiveClass+"-prev "+s.bulletActiveClass+"-prev-prev "+s.bulletActiveClass+"-main"),1<i.length)p.each(function(e,t){var a=L(t),i=a.index();i===r&&a.addClass(s.bulletActiveClass),s.dynamicBullets&&(o<=i&&i<=l&&a.addClass(s.bulletActiveClass+"-main"),i===o&&a.prev().addClass(s.bulletActiveClass+"-prev").prev().addClass(s.bulletActiveClass+"-prev-prev"),i===l&&a.next().addClass(s.bulletActiveClass+"-next").next().addClass(s.bulletActiveClass+"-next-next"))});else if(p.eq(r).addClass(s.bulletActiveClass),s.dynamicBullets){for(var c=p.eq(o),u=p.eq(l),h=o;h<=l;h+=1)p.eq(h).addClass(s.bulletActiveClass+"-main");c.prev().addClass(s.bulletActiveClass+"-prev").prev().addClass(s.bulletActiveClass+"-prev-prev"),u.next().addClass(s.bulletActiveClass+"-next").next().addClass(s.bulletActiveClass+"-next-next")}if(s.dynamicBullets){var v=Math.min(p.length,s.dynamicMainBullets+4),f=(e.pagination.bulletSize*v-e.pagination.bulletSize)/2-d*e.pagination.bulletSize,m=t?"right":"left";p.css(e.isHorizontal()?m:"top",f+"px")}}if("fraction"===s.type&&(i.find("."+s.currentClass).text(s.formatFractionCurrent(r+1)),i.find("."+s.totalClass).text(s.formatFractionTotal(n))),"progressbar"===s.type){var g;g=s.progressbarOpposite?e.isHorizontal()?"vertical":"horizontal":e.isHorizontal()?"horizontal":"vertical";var b=(r+1)/n,w=1,y=1;"horizontal"===g?w=b:y=b,i.find("."+s.progressbarFillClass).transform("translate3d(0,0,0) scaleX("+w+") scaleY("+y+")").transition(e.params.speed)}"custom"===s.type&&s.renderCustom?(i.html(s.renderCustom(e,r+1,n)),e.emit("paginationRender",e,i[0])):e.emit("paginationUpdate",e,i[0]),i[e.params.watchOverflow&&e.isLocked?"addClass":"removeClass"](s.lockClass)}},render:function(){var e=this,t=e.params.pagination;if(t.el&&e.pagination.el&&e.pagination.$el&&0!==e.pagination.$el.length){var a=e.virtual&&e.params.virtual.enabled?e.virtual.slides.length:e.slides.length,i=e.pagination.$el,s="";if("bullets"===t.type){for(var r=e.params.loop?Math.ceil((a-2*e.loopedSlides)/e.params.slidesPerGroup):e.snapGrid.length,n=0;n<r;n+=1)t.renderBullet?s+=t.renderBullet.call(e,n,t.bulletClass):s+="<"+t.bulletElement+' class="'+t.bulletClass+'"></'+t.bulletElement+">";i.html(s),e.pagination.bullets=i.find("."+t.bulletClass)}"fraction"===t.type&&(s=t.renderFraction?t.renderFraction.call(e,t.currentClass,t.totalClass):'<span class="'+t.currentClass+'"></span> / <span class="'+t.totalClass+'"></span>',i.html(s)),"progressbar"===t.type&&(s=t.renderProgressbar?t.renderProgressbar.call(e,t.progressbarFillClass):'<span class="'+t.progressbarFillClass+'"></span>',i.html(s)),"custom"!==t.type&&e.emit("paginationRender",e.pagination.$el[0])}},init:function(){var a=this,e=a.params.pagination;if(e.el){var t=L(e.el);0!==t.length&&(a.params.uniqueNavElements&&"string"==typeof e.el&&1<t.length&&1===a.$el.find(e.el).length&&(t=a.$el.find(e.el)),"bullets"===e.type&&e.clickable&&t.addClass(e.clickableClass),t.addClass(e.modifierClass+e.type),"bullets"===e.type&&e.dynamicBullets&&(t.addClass(""+e.modifierClass+e.type+"-dynamic"),a.pagination.dynamicBulletIndex=0,e.dynamicMainBullets<1&&(e.dynamicMainBullets=1)),"progressbar"===e.type&&e.progressbarOpposite&&t.addClass(e.progressbarOppositeClass),e.clickable&&t.on("click","."+e.bulletClass,function(e){e.preventDefault();var t=L(this).index()*a.params.slidesPerGroup;a.params.loop&&(t+=a.loopedSlides),a.slideTo(t)}),ee.extend(a.pagination,{$el:t,el:t[0]}))}},destroy:function(){var e=this,t=e.params.pagination;if(t.el&&e.pagination.el&&e.pagination.$el&&0!==e.pagination.$el.length){var a=e.pagination.$el;a.removeClass(t.hiddenClass),a.removeClass(t.modifierClass+t.type),e.pagination.bullets&&e.pagination.bullets.removeClass(t.bulletActiveClass),t.clickable&&a.off("click","."+t.bulletClass)}}},G={setTranslate:function(){var e=this;if(e.params.scrollbar.el&&e.scrollbar.el){var t=e.scrollbar,a=e.rtlTranslate,i=e.progress,s=t.dragSize,r=t.trackSize,n=t.$dragEl,o=t.$el,l=e.params.scrollbar,d=s,p=(r-s)*i;a?0<(p=-p)?(d=s-p,p=0):r<-p+s&&(d=r+p):p<0?(d=s+p,p=0):r<p+s&&(d=r-p),e.isHorizontal()?(te.transforms3d?n.transform("translate3d("+p+"px, 0, 0)"):n.transform("translateX("+p+"px)"),n[0].style.width=d+"px"):(te.transforms3d?n.transform("translate3d(0px, "+p+"px, 0)"):n.transform("translateY("+p+"px)"),n[0].style.height=d+"px"),l.hide&&(clearTimeout(e.scrollbar.timeout),o[0].style.opacity=1,e.scrollbar.timeout=setTimeout(function(){o[0].style.opacity=0,o.transition(400)},1e3))}},setTransition:function(e){this.params.scrollbar.el&&this.scrollbar.el&&this.scrollbar.$dragEl.transition(e)},updateSize:function(){var e=this;if(e.params.scrollbar.el&&e.scrollbar.el){var t=e.scrollbar,a=t.$dragEl,i=t.$el;a[0].style.width="",a[0].style.height="";var s,r=e.isHorizontal()?i[0].offsetWidth:i[0].offsetHeight,n=e.size/e.virtualSize,o=n*(r/e.size);s="auto"===e.params.scrollbar.dragSize?r*n:parseInt(e.params.scrollbar.dragSize,10),e.isHorizontal()?a[0].style.width=s+"px":a[0].style.height=s+"px",i[0].style.display=1<=n?"none":"",e.params.scrollbar.hide&&(i[0].style.opacity=0),ee.extend(t,{trackSize:r,divider:n,moveDivider:o,dragSize:s}),t.$el[e.params.watchOverflow&&e.isLocked?"addClass":"removeClass"](e.params.scrollbar.lockClass)}},setDragPosition:function(e){var t,a=this,i=a.scrollbar,s=a.rtlTranslate,r=i.$el,n=i.dragSize,o=i.trackSize;t=((a.isHorizontal()?"touchstart"===e.type||"touchmove"===e.type?e.targetTouches[0].pageX:e.pageX||e.clientX:"touchstart"===e.type||"touchmove"===e.type?e.targetTouches[0].pageY:e.pageY||e.clientY)-r.offset()[a.isHorizontal()?"left":"top"]-n/2)/(o-n),t=Math.max(Math.min(t,1),0),s&&(t=1-t);var l=a.minTranslate()+(a.maxTranslate()-a.minTranslate())*t;a.updateProgress(l),a.setTranslate(l),a.updateActiveIndex(),a.updateSlidesClasses()},onDragStart:function(e){var t=this,a=t.params.scrollbar,i=t.scrollbar,s=t.$wrapperEl,r=i.$el,n=i.$dragEl;t.scrollbar.isTouched=!0,e.preventDefault(),e.stopPropagation(),s.transition(100),n.transition(100),i.setDragPosition(e),clearTimeout(t.scrollbar.dragTimeout),r.transition(0),a.hide&&r.css("opacity",1),t.emit("scrollbarDragStart",e)},onDragMove:function(e){var t=this.scrollbar,a=this.$wrapperEl,i=t.$el,s=t.$dragEl;this.scrollbar.isTouched&&(e.preventDefault?e.preventDefault():e.returnValue=!1,t.setDragPosition(e),a.transition(0),i.transition(0),s.transition(0),this.emit("scrollbarDragMove",e))},onDragEnd:function(e){var t=this,a=t.params.scrollbar,i=t.scrollbar.$el;t.scrollbar.isTouched&&(t.scrollbar.isTouched=!1,a.hide&&(clearTimeout(t.scrollbar.dragTimeout),t.scrollbar.dragTimeout=ee.nextTick(function(){i.css("opacity",0),i.transition(400)},1e3)),t.emit("scrollbarDragEnd",e),a.snapOnRelease&&t.slideToClosest())},enableDraggable:function(){var e=this;if(e.params.scrollbar.el){var t=e.scrollbar,a=e.touchEventsTouch,i=e.touchEventsDesktop,s=e.params,r=t.$el[0],n=!(!te.passiveListener||!s.passiveListeners)&&{passive:!1,capture:!1},o=!(!te.passiveListener||!s.passiveListeners)&&{passive:!0,capture:!1};te.touch?(r.addEventListener(a.start,e.scrollbar.onDragStart,n),r.addEventListener(a.move,e.scrollbar.onDragMove,n),r.addEventListener(a.end,e.scrollbar.onDragEnd,o)):(r.addEventListener(i.start,e.scrollbar.onDragStart,n),f.addEventListener(i.move,e.scrollbar.onDragMove,n),f.addEventListener(i.end,e.scrollbar.onDragEnd,o))}},disableDraggable:function(){var e=this;if(e.params.scrollbar.el){var t=e.scrollbar,a=e.touchEventsTouch,i=e.touchEventsDesktop,s=e.params,r=t.$el[0],n=!(!te.passiveListener||!s.passiveListeners)&&{passive:!1,capture:!1},o=!(!te.passiveListener||!s.passiveListeners)&&{passive:!0,capture:!1};te.touch?(r.removeEventListener(a.start,e.scrollbar.onDragStart,n),r.removeEventListener(a.move,e.scrollbar.onDragMove,n),r.removeEventListener(a.end,e.scrollbar.onDragEnd,o)):(r.removeEventListener(i.start,e.scrollbar.onDragStart,n),f.removeEventListener(i.move,e.scrollbar.onDragMove,n),f.removeEventListener(i.end,e.scrollbar.onDragEnd,o))}},init:function(){var e=this;if(e.params.scrollbar.el){var t=e.scrollbar,a=e.$el,i=e.params.scrollbar,s=L(i.el);e.params.uniqueNavElements&&"string"==typeof i.el&&1<s.length&&1===a.find(i.el).length&&(s=a.find(i.el));var r=s.find("."+e.params.scrollbar.dragClass);0===r.length&&(r=L('<div class="'+e.params.scrollbar.dragClass+'"></div>'),s.append(r)),ee.extend(t,{$el:s,el:s[0],$dragEl:r,dragEl:r[0]}),i.draggable&&t.enableDraggable()}},destroy:function(){this.scrollbar.disableDraggable()}},B={setTransform:function(e,t){var a=this.rtl,i=L(e),s=a?-1:1,r=i.attr("data-swiper-parallax")||"0",n=i.attr("data-swiper-parallax-x"),o=i.attr("data-swiper-parallax-y"),l=i.attr("data-swiper-parallax-scale"),d=i.attr("data-swiper-parallax-opacity");if(n||o?(n=n||"0",o=o||"0"):this.isHorizontal()?(n=r,o="0"):(o=r,n="0"),n=0<=n.indexOf("%")?parseInt(n,10)*t*s+"%":n*t*s+"px",o=0<=o.indexOf("%")?parseInt(o,10)*t+"%":o*t+"px",null!=d){var p=d-(d-1)*(1-Math.abs(t));i[0].style.opacity=p}if(null==l)i.transform("translate3d("+n+", "+o+", 0px)");else{var c=l-(l-1)*(1-Math.abs(t));i.transform("translate3d("+n+", "+o+", 0px) scale("+c+")")}},setTranslate:function(){var i=this,e=i.$el,t=i.slides,s=i.progress,r=i.snapGrid;e.children("[data-swiper-parallax], [data-swiper-parallax-x], [data-swiper-parallax-y]").each(function(e,t){i.parallax.setTransform(t,s)}),t.each(function(e,t){var a=t.progress;1<i.params.slidesPerGroup&&"auto"!==i.params.slidesPerView&&(a+=Math.ceil(e/2)-s*(r.length-1)),a=Math.min(Math.max(a,-1),1),L(t).find("[data-swiper-parallax], [data-swiper-parallax-x], [data-swiper-parallax-y]").each(function(e,t){i.parallax.setTransform(t,a)})})},setTransition:function(s){void 0===s&&(s=this.params.speed);this.$el.find("[data-swiper-parallax], [data-swiper-parallax-x], [data-swiper-parallax-y]").each(function(e,t){var a=L(t),i=parseInt(a.attr("data-swiper-parallax-duration"),10)||s;0===s&&(i=0),a.transition(i)})}},X={getDistanceBetweenTouches:function(e){if(e.targetTouches.length<2)return 1;var t=e.targetTouches[0].pageX,a=e.targetTouches[0].pageY,i=e.targetTouches[1].pageX,s=e.targetTouches[1].pageY;return Math.sqrt(Math.pow(i-t,2)+Math.pow(s-a,2))},onGestureStart:function(e){var t=this,a=t.params.zoom,i=t.zoom,s=i.gesture;if(i.fakeGestureTouched=!1,i.fakeGestureMoved=!1,!te.gestures){if("touchstart"!==e.type||"touchstart"===e.type&&e.targetTouches.length<2)return;i.fakeGestureTouched=!0,s.scaleStart=X.getDistanceBetweenTouches(e)}s.$slideEl&&s.$slideEl.length||(s.$slideEl=L(e.target).closest(".swiper-slide"),0===s.$slideEl.length&&(s.$slideEl=t.slides.eq(t.activeIndex)),s.$imageEl=s.$slideEl.find("img, svg, canvas"),s.$imageWrapEl=s.$imageEl.parent("."+a.containerClass),s.maxRatio=s.$imageWrapEl.attr("data-swiper-zoom")||a.maxRatio,0!==s.$imageWrapEl.length)?(s.$imageEl.transition(0),t.zoom.isScaling=!0):s.$imageEl=void 0},onGestureChange:function(e){var t=this.params.zoom,a=this.zoom,i=a.gesture;if(!te.gestures){if("touchmove"!==e.type||"touchmove"===e.type&&e.targetTouches.length<2)return;a.fakeGestureMoved=!0,i.scaleMove=X.getDistanceBetweenTouches(e)}i.$imageEl&&0!==i.$imageEl.length&&(a.scale=te.gestures?e.scale*a.currentScale:i.scaleMove/i.scaleStart*a.currentScale,a.scale>i.maxRatio&&(a.scale=i.maxRatio-1+Math.pow(a.scale-i.maxRatio+1,.5)),a.scale<t.minRatio&&(a.scale=t.minRatio+1-Math.pow(t.minRatio-a.scale+1,.5)),i.$imageEl.transform("translate3d(0,0,0) scale("+a.scale+")"))},onGestureEnd:function(e){var t=this.params.zoom,a=this.zoom,i=a.gesture;if(!te.gestures){if(!a.fakeGestureTouched||!a.fakeGestureMoved)return;if("touchend"!==e.type||"touchend"===e.type&&e.changedTouches.length<2&&!g.android)return;a.fakeGestureTouched=!1,a.fakeGestureMoved=!1}i.$imageEl&&0!==i.$imageEl.length&&(a.scale=Math.max(Math.min(a.scale,i.maxRatio),t.minRatio),i.$imageEl.transition(this.params.speed).transform("translate3d(0,0,0) scale("+a.scale+")"),a.currentScale=a.scale,a.isScaling=!1,1===a.scale&&(i.$slideEl=void 0))},onTouchStart:function(e){var t=this.zoom,a=t.gesture,i=t.image;a.$imageEl&&0!==a.$imageEl.length&&(i.isTouched||(g.android&&e.preventDefault(),i.isTouched=!0,i.touchesStart.x="touchstart"===e.type?e.targetTouches[0].pageX:e.pageX,i.touchesStart.y="touchstart"===e.type?e.targetTouches[0].pageY:e.pageY))},onTouchMove:function(e){var t=this,a=t.zoom,i=a.gesture,s=a.image,r=a.velocity;if(i.$imageEl&&0!==i.$imageEl.length&&(t.allowClick=!1,s.isTouched&&i.$slideEl)){s.isMoved||(s.width=i.$imageEl[0].offsetWidth,s.height=i.$imageEl[0].offsetHeight,s.startX=ee.getTranslate(i.$imageWrapEl[0],"x")||0,s.startY=ee.getTranslate(i.$imageWrapEl[0],"y")||0,i.slideWidth=i.$slideEl[0].offsetWidth,i.slideHeight=i.$slideEl[0].offsetHeight,i.$imageWrapEl.transition(0),t.rtl&&(s.startX=-s.startX,s.startY=-s.startY));var n=s.width*a.scale,o=s.height*a.scale;if(!(n<i.slideWidth&&o<i.slideHeight)){if(s.minX=Math.min(i.slideWidth/2-n/2,0),s.maxX=-s.minX,s.minY=Math.min(i.slideHeight/2-o/2,0),s.maxY=-s.minY,s.touchesCurrent.x="touchmove"===e.type?e.targetTouches[0].pageX:e.pageX,s.touchesCurrent.y="touchmove"===e.type?e.targetTouches[0].pageY:e.pageY,!s.isMoved&&!a.isScaling){if(t.isHorizontal()&&(Math.floor(s.minX)===Math.floor(s.startX)&&s.touchesCurrent.x<s.touchesStart.x||Math.floor(s.maxX)===Math.floor(s.startX)&&s.touchesCurrent.x>s.touchesStart.x))return void(s.isTouched=!1);if(!t.isHorizontal()&&(Math.floor(s.minY)===Math.floor(s.startY)&&s.touchesCurrent.y<s.touchesStart.y||Math.floor(s.maxY)===Math.floor(s.startY)&&s.touchesCurrent.y>s.touchesStart.y))return void(s.isTouched=!1)}e.preventDefault(),e.stopPropagation(),s.isMoved=!0,s.currentX=s.touchesCurrent.x-s.touchesStart.x+s.startX,s.currentY=s.touchesCurrent.y-s.touchesStart.y+s.startY,s.currentX<s.minX&&(s.currentX=s.minX+1-Math.pow(s.minX-s.currentX+1,.8)),s.currentX>s.maxX&&(s.currentX=s.maxX-1+Math.pow(s.currentX-s.maxX+1,.8)),s.currentY<s.minY&&(s.currentY=s.minY+1-Math.pow(s.minY-s.currentY+1,.8)),s.currentY>s.maxY&&(s.currentY=s.maxY-1+Math.pow(s.currentY-s.maxY+1,.8)),r.prevPositionX||(r.prevPositionX=s.touchesCurrent.x),r.prevPositionY||(r.prevPositionY=s.touchesCurrent.y),r.prevTime||(r.prevTime=Date.now()),r.x=(s.touchesCurrent.x-r.prevPositionX)/(Date.now()-r.prevTime)/2,r.y=(s.touchesCurrent.y-r.prevPositionY)/(Date.now()-r.prevTime)/2,Math.abs(s.touchesCurrent.x-r.prevPositionX)<2&&(r.x=0),Math.abs(s.touchesCurrent.y-r.prevPositionY)<2&&(r.y=0),r.prevPositionX=s.touchesCurrent.x,r.prevPositionY=s.touchesCurrent.y,r.prevTime=Date.now(),i.$imageWrapEl.transform("translate3d("+s.currentX+"px, "+s.currentY+"px,0)")}}},onTouchEnd:function(){var e=this.zoom,t=e.gesture,a=e.image,i=e.velocity;if(t.$imageEl&&0!==t.$imageEl.length){if(!a.isTouched||!a.isMoved)return a.isTouched=!1,void(a.isMoved=!1);a.isTouched=!1,a.isMoved=!1;var s=300,r=300,n=i.x*s,o=a.currentX+n,l=i.y*r,d=a.currentY+l;0!==i.x&&(s=Math.abs((o-a.currentX)/i.x)),0!==i.y&&(r=Math.abs((d-a.currentY)/i.y));var p=Math.max(s,r);a.currentX=o,a.currentY=d;var c=a.width*e.scale,u=a.height*e.scale;a.minX=Math.min(t.slideWidth/2-c/2,0),a.maxX=-a.minX,a.minY=Math.min(t.slideHeight/2-u/2,0),a.maxY=-a.minY,a.currentX=Math.max(Math.min(a.currentX,a.maxX),a.minX),a.currentY=Math.max(Math.min(a.currentY,a.maxY),a.minY),t.$imageWrapEl.transition(p).transform("translate3d("+a.currentX+"px, "+a.currentY+"px,0)")}},onTransitionEnd:function(){var e=this.zoom,t=e.gesture;t.$slideEl&&this.previousIndex!==this.activeIndex&&(t.$imageEl.transform("translate3d(0,0,0) scale(1)"),t.$imageWrapEl.transform("translate3d(0,0,0)"),e.scale=1,e.currentScale=1,t.$slideEl=void 0,t.$imageEl=void 0,t.$imageWrapEl=void 0)},toggle:function(e){var t=this.zoom;t.scale&&1!==t.scale?t.out():t.in(e)},in:function(e){var t,a,i,s,r,n,o,l,d,p,c,u,h,v,f,m,g=this,b=g.zoom,w=g.params.zoom,y=b.gesture,x=b.image;(y.$slideEl||(y.$slideEl=g.clickedSlide?L(g.clickedSlide):g.slides.eq(g.activeIndex),y.$imageEl=y.$slideEl.find("img, svg, canvas"),y.$imageWrapEl=y.$imageEl.parent("."+w.containerClass)),y.$imageEl&&0!==y.$imageEl.length)&&(y.$slideEl.addClass(""+w.zoomedSlideClass),void 0===x.touchesStart.x&&e?(t="touchend"===e.type?e.changedTouches[0].pageX:e.pageX,a="touchend"===e.type?e.changedTouches[0].pageY:e.pageY):(t=x.touchesStart.x,a=x.touchesStart.y),b.scale=y.$imageWrapEl.attr("data-swiper-zoom")||w.maxRatio,b.currentScale=y.$imageWrapEl.attr("data-swiper-zoom")||w.maxRatio,e?(f=y.$slideEl[0].offsetWidth,m=y.$slideEl[0].offsetHeight,i=y.$slideEl.offset().left+f/2-t,s=y.$slideEl.offset().top+m/2-a,o=y.$imageEl[0].offsetWidth,l=y.$imageEl[0].offsetHeight,d=o*b.scale,p=l*b.scale,h=-(c=Math.min(f/2-d/2,0)),v=-(u=Math.min(m/2-p/2,0)),(r=i*b.scale)<c&&(r=c),h<r&&(r=h),(n=s*b.scale)<u&&(n=u),v<n&&(n=v)):n=r=0,y.$imageWrapEl.transition(300).transform("translate3d("+r+"px, "+n+"px,0)"),y.$imageEl.transition(300).transform("translate3d(0,0,0) scale("+b.scale+")"))},out:function(){var e=this,t=e.zoom,a=e.params.zoom,i=t.gesture;i.$slideEl||(i.$slideEl=e.clickedSlide?L(e.clickedSlide):e.slides.eq(e.activeIndex),i.$imageEl=i.$slideEl.find("img, svg, canvas"),i.$imageWrapEl=i.$imageEl.parent("."+a.containerClass)),i.$imageEl&&0!==i.$imageEl.length&&(t.scale=1,t.currentScale=1,i.$imageWrapEl.transition(300).transform("translate3d(0,0,0)"),i.$imageEl.transition(300).transform("translate3d(0,0,0) scale(1)"),i.$slideEl.removeClass(""+a.zoomedSlideClass),i.$slideEl=void 0)},enable:function(){var e=this,t=e.zoom;if(!t.enabled){t.enabled=!0;var a=!("touchstart"!==e.touchEvents.start||!te.passiveListener||!e.params.passiveListeners)&&{passive:!0,capture:!1};te.gestures?(e.$wrapperEl.on("gesturestart",".swiper-slide",t.onGestureStart,a),e.$wrapperEl.on("gesturechange",".swiper-slide",t.onGestureChange,a),e.$wrapperEl.on("gestureend",".swiper-slide",t.onGestureEnd,a)):"touchstart"===e.touchEvents.start&&(e.$wrapperEl.on(e.touchEvents.start,".swiper-slide",t.onGestureStart,a),e.$wrapperEl.on(e.touchEvents.move,".swiper-slide",t.onGestureChange,a),e.$wrapperEl.on(e.touchEvents.end,".swiper-slide",t.onGestureEnd,a)),e.$wrapperEl.on(e.touchEvents.move,"."+e.params.zoom.containerClass,t.onTouchMove)}},disable:function(){var e=this,t=e.zoom;if(t.enabled){e.zoom.enabled=!1;var a=!("touchstart"!==e.touchEvents.start||!te.passiveListener||!e.params.passiveListeners)&&{passive:!0,capture:!1};te.gestures?(e.$wrapperEl.off("gesturestart",".swiper-slide",t.onGestureStart,a),e.$wrapperEl.off("gesturechange",".swiper-slide",t.onGestureChange,a),e.$wrapperEl.off("gestureend",".swiper-slide",t.onGestureEnd,a)):"touchstart"===e.touchEvents.start&&(e.$wrapperEl.off(e.touchEvents.start,".swiper-slide",t.onGestureStart,a),e.$wrapperEl.off(e.touchEvents.move,".swiper-slide",t.onGestureChange,a),e.$wrapperEl.off(e.touchEvents.end,".swiper-slide",t.onGestureEnd,a)),e.$wrapperEl.off(e.touchEvents.move,"."+e.params.zoom.containerClass,t.onTouchMove)}}},Y={loadInSlide:function(e,l){void 0===l&&(l=!0);var d=this,p=d.params.lazy;if(void 0!==e&&0!==d.slides.length){var c=d.virtual&&d.params.virtual.enabled?d.$wrapperEl.children("."+d.params.slideClass+'[data-swiper-slide-index="'+e+'"]'):d.slides.eq(e),t=c.find("."+p.elementClass+":not(."+p.loadedClass+"):not(."+p.loadingClass+")");!c.hasClass(p.elementClass)||c.hasClass(p.loadedClass)||c.hasClass(p.loadingClass)||(t=t.add(c[0])),0!==t.length&&t.each(function(e,t){var i=L(t);i.addClass(p.loadingClass);var s=i.attr("data-background"),r=i.attr("data-src"),n=i.attr("data-srcset"),o=i.attr("data-sizes");d.loadImage(i[0],r||s,n,o,!1,function(){if(null!=d&&d&&(!d||d.params)&&!d.destroyed){if(s?(i.css("background-image",'url("'+s+'")'),i.removeAttr("data-background")):(n&&(i.attr("srcset",n),i.removeAttr("data-srcset")),o&&(i.attr("sizes",o),i.removeAttr("data-sizes")),r&&(i.attr("src",r),i.removeAttr("data-src"))),i.addClass(p.loadedClass).removeClass(p.loadingClass),c.find("."+p.preloaderClass).remove(),d.params.loop&&l){var e=c.attr("data-swiper-slide-index");if(c.hasClass(d.params.slideDuplicateClass)){var t=d.$wrapperEl.children('[data-swiper-slide-index="'+e+'"]:not(.'+d.params.slideDuplicateClass+")");d.lazy.loadInSlide(t.index(),!1)}else{var a=d.$wrapperEl.children("."+d.params.slideDuplicateClass+'[data-swiper-slide-index="'+e+'"]');d.lazy.loadInSlide(a.index(),!1)}}d.emit("lazyImageReady",c[0],i[0])}}),d.emit("lazyImageLoad",c[0],i[0])})}},load:function(){var i=this,t=i.$wrapperEl,a=i.params,s=i.slides,e=i.activeIndex,r=i.virtual&&a.virtual.enabled,n=a.lazy,o=a.slidesPerView;function l(e){if(r){if(t.children("."+a.slideClass+'[data-swiper-slide-index="'+e+'"]').length)return!0}else if(s[e])return!0;return!1}function d(e){return r?L(e).attr("data-swiper-slide-index"):L(e).index()}if("auto"===o&&(o=0),i.lazy.initialImageLoaded||(i.lazy.initialImageLoaded=!0),i.params.watchSlidesVisibility)t.children("."+a.slideVisibleClass).each(function(e,t){var a=r?L(t).attr("data-swiper-slide-index"):L(t).index();i.lazy.loadInSlide(a)});else if(1<o)for(var p=e;p<e+o;p+=1)l(p)&&i.lazy.loadInSlide(p);else i.lazy.loadInSlide(e);if(n.loadPrevNext)if(1<o||n.loadPrevNextAmount&&1<n.loadPrevNextAmount){for(var c=n.loadPrevNextAmount,u=o,h=Math.min(e+u+Math.max(c,u),s.length),v=Math.max(e-Math.max(u,c),0),f=e+o;f<h;f+=1)l(f)&&i.lazy.loadInSlide(f);for(var m=v;m<e;m+=1)l(m)&&i.lazy.loadInSlide(m)}else{var g=t.children("."+a.slideNextClass);0<g.length&&i.lazy.loadInSlide(d(g));var b=t.children("."+a.slidePrevClass);0<b.length&&i.lazy.loadInSlide(d(b))}}},V={LinearSpline:function(e,t){var a,i,s,r,n,o=function(e,t){for(i=-1,a=e.length;1<a-i;)e[s=a+i>>1]<=t?i=s:a=s;return a};return this.x=e,this.y=t,this.lastIndex=e.length-1,this.interpolate=function(e){return e?(n=o(this.x,e),r=n-1,(e-this.x[r])*(this.y[n]-this.y[r])/(this.x[n]-this.x[r])+this.y[r]):0},this},getInterpolateFunction:function(e){var t=this;t.controller.spline||(t.controller.spline=t.params.loop?new V.LinearSpline(t.slidesGrid,e.slidesGrid):new V.LinearSpline(t.snapGrid,e.snapGrid))},setTranslate:function(e,t){var a,i,s=this,r=s.controller.control;function n(e){var t=s.rtlTranslate?-s.translate:s.translate;"slide"===s.params.controller.by&&(s.controller.getInterpolateFunction(e),i=-s.controller.spline.interpolate(-t)),i&&"container"!==s.params.controller.by||(a=(e.maxTranslate()-e.minTranslate())/(s.maxTranslate()-s.minTranslate()),i=(t-s.minTranslate())*a+e.minTranslate()),s.params.controller.inverse&&(i=e.maxTranslate()-i),e.updateProgress(i),e.setTranslate(i,s),e.updateActiveIndex(),e.updateSlidesClasses()}if(Array.isArray(r))for(var o=0;o<r.length;o+=1)r[o]!==t&&r[o]instanceof T&&n(r[o]);else r instanceof T&&t!==r&&n(r)},setTransition:function(t,e){var a,i=this,s=i.controller.control;function r(e){e.setTransition(t,i),0!==t&&(e.transitionStart(),e.params.autoHeight&&ee.nextTick(function(){e.updateAutoHeight()}),e.$wrapperEl.transitionEnd(function(){s&&(e.params.loop&&"slide"===i.params.controller.by&&e.loopFix(),e.transitionEnd())}))}if(Array.isArray(s))for(a=0;a<s.length;a+=1)s[a]!==e&&s[a]instanceof T&&r(s[a]);else s instanceof T&&e!==s&&r(s)}},F={makeElFocusable:function(e){return e.attr("tabIndex","0"),e},addElRole:function(e,t){return e.attr("role",t),e},addElLabel:function(e,t){return e.attr("aria-label",t),e},disableEl:function(e){return e.attr("aria-disabled",!0),e},enableEl:function(e){return e.attr("aria-disabled",!1),e},onEnterKey:function(e){var t=this,a=t.params.a11y;if(13===e.keyCode){var i=L(e.target);t.navigation&&t.navigation.$nextEl&&i.is(t.navigation.$nextEl)&&(t.isEnd&&!t.params.loop||t.slideNext(),t.isEnd?t.a11y.notify(a.lastSlideMessage):t.a11y.notify(a.nextSlideMessage)),t.navigation&&t.navigation.$prevEl&&i.is(t.navigation.$prevEl)&&(t.isBeginning&&!t.params.loop||t.slidePrev(),t.isBeginning?t.a11y.notify(a.firstSlideMessage):t.a11y.notify(a.prevSlideMessage)),t.pagination&&i.is("."+t.params.pagination.bulletClass)&&i[0].click()}},notify:function(e){var t=this.a11y.liveRegion;0!==t.length&&(t.html(""),t.html(e))},updateNavigation:function(){var e=this;if(!e.params.loop){var t=e.navigation,a=t.$nextEl,i=t.$prevEl;i&&0<i.length&&(e.isBeginning?e.a11y.disableEl(i):e.a11y.enableEl(i)),a&&0<a.length&&(e.isEnd?e.a11y.disableEl(a):e.a11y.enableEl(a))}},updatePagination:function(){var i=this,s=i.params.a11y;i.pagination&&i.params.pagination.clickable&&i.pagination.bullets&&i.pagination.bullets.length&&i.pagination.bullets.each(function(e,t){var a=L(t);i.a11y.makeElFocusable(a),i.a11y.addElRole(a,"button"),i.a11y.addElLabel(a,s.paginationBulletMessage.replace(/{{index}}/,a.index()+1))})},init:function(){var e=this;e.$el.append(e.a11y.liveRegion);var t,a,i=e.params.a11y;e.navigation&&e.navigation.$nextEl&&(t=e.navigation.$nextEl),e.navigation&&e.navigation.$prevEl&&(a=e.navigation.$prevEl),t&&(e.a11y.makeElFocusable(t),e.a11y.addElRole(t,"button"),e.a11y.addElLabel(t,i.nextSlideMessage),t.on("keydown",e.a11y.onEnterKey)),a&&(e.a11y.makeElFocusable(a),e.a11y.addElRole(a,"button"),e.a11y.addElLabel(a,i.prevSlideMessage),a.on("keydown",e.a11y.onEnterKey)),e.pagination&&e.params.pagination.clickable&&e.pagination.bullets&&e.pagination.bullets.length&&e.pagination.$el.on("keydown","."+e.params.pagination.bulletClass,e.a11y.onEnterKey)},destroy:function(){var e,t,a=this;a.a11y.liveRegion&&0<a.a11y.liveRegion.length&&a.a11y.liveRegion.remove(),a.navigation&&a.navigation.$nextEl&&(e=a.navigation.$nextEl),a.navigation&&a.navigation.$prevEl&&(t=a.navigation.$prevEl),e&&e.off("keydown",a.a11y.onEnterKey),t&&t.off("keydown",a.a11y.onEnterKey),a.pagination&&a.params.pagination.clickable&&a.pagination.bullets&&a.pagination.bullets.length&&a.pagination.$el.off("keydown","."+a.params.pagination.bulletClass,a.a11y.onEnterKey)}},R={init:function(){var e=this;if(e.params.history){if(!J.history||!J.history.pushState)return e.params.history.enabled=!1,void(e.params.hashNavigation.enabled=!0);var t=e.history;t.initialized=!0,t.paths=R.getPathValues(),(t.paths.key||t.paths.value)&&(t.scrollToSlide(0,t.paths.value,e.params.runCallbacksOnInit),e.params.history.replaceState||J.addEventListener("popstate",e.history.setHistoryPopState))}},destroy:function(){this.params.history.replaceState||J.removeEventListener("popstate",this.history.setHistoryPopState)},setHistoryPopState:function(){this.history.paths=R.getPathValues(),this.history.scrollToSlide(this.params.speed,this.history.paths.value,!1)},getPathValues:function(){var e=J.location.pathname.slice(1).split("/").filter(function(e){return""!==e}),t=e.length;return{key:e[t-2],value:e[t-1]}},setHistory:function(e,t){if(this.history.initialized&&this.params.history.enabled){var a=this.slides.eq(t),i=R.slugify(a.attr("data-history"));J.location.pathname.includes(e)||(i=e+"/"+i);var s=J.history.state;s&&s.value===i||(this.params.history.replaceState?J.history.replaceState({value:i},null,i):J.history.pushState({value:i},null,i))}},slugify:function(e){return e.toString().replace(/\s+/g,"-").replace(/[^\w-]+/g,"").replace(/--+/g,"-").replace(/^-+/,"").replace(/-+$/,"")},scrollToSlide:function(e,t,a){var i=this;if(t)for(var s=0,r=i.slides.length;s<r;s+=1){var n=i.slides.eq(s);if(R.slugify(n.attr("data-history"))===t&&!n.hasClass(i.params.slideDuplicateClass)){var o=n.index();i.slideTo(o,e,a)}}else i.slideTo(0,e,a)}},q={onHashCange:function(){var e=this,t=f.location.hash.replace("#","");if(t!==e.slides.eq(e.activeIndex).attr("data-hash")){var a=e.$wrapperEl.children("."+e.params.slideClass+'[data-hash="'+t+'"]').index();if(void 0===a)return;e.slideTo(a)}},setHash:function(){var e=this;if(e.hashNavigation.initialized&&e.params.hashNavigation.enabled)if(e.params.hashNavigation.replaceState&&J.history&&J.history.replaceState)J.history.replaceState(null,null,"#"+e.slides.eq(e.activeIndex).attr("data-hash")||"");else{var t=e.slides.eq(e.activeIndex),a=t.attr("data-hash")||t.attr("data-history");f.location.hash=a||""}},init:function(){var e=this;if(!(!e.params.hashNavigation.enabled||e.params.history&&e.params.history.enabled)){e.hashNavigation.initialized=!0;var t=f.location.hash.replace("#","");if(t)for(var a=0,i=e.slides.length;a<i;a+=1){var s=e.slides.eq(a);if((s.attr("data-hash")||s.attr("data-history"))===t&&!s.hasClass(e.params.slideDuplicateClass)){var r=s.index();e.slideTo(r,0,e.params.runCallbacksOnInit,!0)}}e.params.hashNavigation.watchState&&L(J).on("hashchange",e.hashNavigation.onHashCange)}},destroy:function(){this.params.hashNavigation.watchState&&L(J).off("hashchange",this.hashNavigation.onHashCange)}},W={run:function(){var e=this,t=e.slides.eq(e.activeIndex),a=e.params.autoplay.delay;t.attr("data-swiper-autoplay")&&(a=t.attr("data-swiper-autoplay")||e.params.autoplay.delay),e.autoplay.timeout=ee.nextTick(function(){e.params.autoplay.reverseDirection?e.params.loop?(e.loopFix(),e.slidePrev(e.params.speed,!0,!0),e.emit("autoplay")):e.isBeginning?e.params.autoplay.stopOnLastSlide?e.autoplay.stop():(e.slideTo(e.slides.length-1,e.params.speed,!0,!0),e.emit("autoplay")):(e.slidePrev(e.params.speed,!0,!0),e.emit("autoplay")):e.params.loop?(e.loopFix(),e.slideNext(e.params.speed,!0,!0),e.emit("autoplay")):e.isEnd?e.params.autoplay.stopOnLastSlide?e.autoplay.stop():(e.slideTo(0,e.params.speed,!0,!0),e.emit("autoplay")):(e.slideNext(e.params.speed,!0,!0),e.emit("autoplay"))},a)},start:function(){var e=this;return void 0===e.autoplay.timeout&&(!e.autoplay.running&&(e.autoplay.running=!0,e.emit("autoplayStart"),e.autoplay.run(),!0))},stop:function(){var e=this;return!!e.autoplay.running&&(void 0!==e.autoplay.timeout&&(e.autoplay.timeout&&(clearTimeout(e.autoplay.timeout),e.autoplay.timeout=void 0),e.autoplay.running=!1,e.emit("autoplayStop"),!0))},pause:function(e){var t=this;t.autoplay.running&&(t.autoplay.paused||(t.autoplay.timeout&&clearTimeout(t.autoplay.timeout),t.autoplay.paused=!0,0!==e&&t.params.autoplay.waitForTransition?(t.$wrapperEl[0].addEventListener("transitionend",t.autoplay.onTransitionEnd),t.$wrapperEl[0].addEventListener("webkitTransitionEnd",t.autoplay.onTransitionEnd)):(t.autoplay.paused=!1,t.autoplay.run())))}},j={setTranslate:function(){for(var e=this,t=e.slides,a=0;a<t.length;a+=1){var i=e.slides.eq(a),s=-i[0].swiperSlideOffset;e.params.virtualTranslate||(s-=e.translate);var r=0;e.isHorizontal()||(r=s,s=0);var n=e.params.fadeEffect.crossFade?Math.max(1-Math.abs(i[0].progress),0):1+Math.min(Math.max(i[0].progress,-1),0);i.css({opacity:n}).transform("translate3d("+s+"px, "+r+"px, 0px)")}},setTransition:function(e){var a=this,t=a.slides,i=a.$wrapperEl;if(t.transition(e),a.params.virtualTranslate&&0!==e){var s=!1;t.transitionEnd(function(){if(!s&&a&&!a.destroyed){s=!0,a.animating=!1;for(var e=["webkitTransitionEnd","transitionend"],t=0;t<e.length;t+=1)i.trigger(e[t])}})}}},U={setTranslate:function(){var e,t=this,a=t.$el,i=t.$wrapperEl,s=t.slides,r=t.width,n=t.height,o=t.rtlTranslate,l=t.size,d=t.params.cubeEffect,p=t.isHorizontal(),c=t.virtual&&t.params.virtual.enabled,u=0;d.shadow&&(p?(0===(e=i.find(".swiper-cube-shadow")).length&&(e=L('<div class="swiper-cube-shadow"></div>'),i.append(e)),e.css({height:r+"px"})):0===(e=a.find(".swiper-cube-shadow")).length&&(e=L('<div class="swiper-cube-shadow"></div>'),a.append(e)));for(var h=0;h<s.length;h+=1){var v=s.eq(h),f=h;c&&(f=parseInt(v.attr("data-swiper-slide-index"),10));var m=90*f,g=Math.floor(m/360);o&&(m=-m,g=Math.floor(-m/360));var b=Math.max(Math.min(v[0].progress,1),-1),w=0,y=0,x=0;f%4==0?(w=4*-g*l,x=0):(f-1)%4==0?(w=0,x=4*-g*l):(f-2)%4==0?(w=l+4*g*l,x=l):(f-3)%4==0&&(w=-l,x=3*l+4*l*g),o&&(w=-w),p||(y=w,w=0);var T="rotateX("+(p?0:-m)+"deg) rotateY("+(p?m:0)+"deg) translate3d("+w+"px, "+y+"px, "+x+"px)";if(b<=1&&-1<b&&(u=90*f+90*b,o&&(u=90*-f-90*b)),v.transform(T),d.slideShadows){var E=p?v.find(".swiper-slide-shadow-left"):v.find(".swiper-slide-shadow-top"),S=p?v.find(".swiper-slide-shadow-right"):v.find(".swiper-slide-shadow-bottom");0===E.length&&(E=L('<div class="swiper-slide-shadow-'+(p?"left":"top")+'"></div>'),v.append(E)),0===S.length&&(S=L('<div class="swiper-slide-shadow-'+(p?"right":"bottom")+'"></div>'),v.append(S)),E.length&&(E[0].style.opacity=Math.max(-b,0)),S.length&&(S[0].style.opacity=Math.max(b,0))}}if(i.css({"-webkit-transform-origin":"50% 50% -"+l/2+"px","-moz-transform-origin":"50% 50% -"+l/2+"px","-ms-transform-origin":"50% 50% -"+l/2+"px","transform-origin":"50% 50% -"+l/2+"px"}),d.shadow)if(p)e.transform("translate3d(0px, "+(r/2+d.shadowOffset)+"px, "+-r/2+"px) rotateX(90deg) rotateZ(0deg) scale("+d.shadowScale+")");else{var C=Math.abs(u)-90*Math.floor(Math.abs(u)/90),M=1.5-(Math.sin(2*C*Math.PI/360)/2+Math.cos(2*C*Math.PI/360)/2),z=d.shadowScale,P=d.shadowScale/M,k=d.shadowOffset;e.transform("scale3d("+z+", 1, "+P+") translate3d(0px, "+(n/2+k)+"px, "+-n/2/P+"px) rotateX(-90deg)")}var $=I.isSafari||I.isUiWebView?-l/2:0;i.transform("translate3d(0px,0,"+$+"px) rotateX("+(t.isHorizontal()?0:u)+"deg) rotateY("+(t.isHorizontal()?-u:0)+"deg)")},setTransition:function(e){var t=this.$el;this.slides.transition(e).find(".swiper-slide-shadow-top, .swiper-slide-shadow-right, .swiper-slide-shadow-bottom, .swiper-slide-shadow-left").transition(e),this.params.cubeEffect.shadow&&!this.isHorizontal()&&t.find(".swiper-cube-shadow").transition(e)}},K={setTranslate:function(){for(var e=this,t=e.slides,a=e.rtlTranslate,i=0;i<t.length;i+=1){var s=t.eq(i),r=s[0].progress;e.params.flipEffect.limitRotation&&(r=Math.max(Math.min(s[0].progress,1),-1));var n=-180*r,o=0,l=-s[0].swiperSlideOffset,d=0;if(e.isHorizontal()?a&&(n=-n):(d=l,o=-n,n=l=0),s[0].style.zIndex=-Math.abs(Math.round(r))+t.length,e.params.flipEffect.slideShadows){var p=e.isHorizontal()?s.find(".swiper-slide-shadow-left"):s.find(".swiper-slide-shadow-top"),c=e.isHorizontal()?s.find(".swiper-slide-shadow-right"):s.find(".swiper-slide-shadow-bottom");0===p.length&&(p=L('<div class="swiper-slide-shadow-'+(e.isHorizontal()?"left":"top")+'"></div>'),s.append(p)),0===c.length&&(c=L('<div class="swiper-slide-shadow-'+(e.isHorizontal()?"right":"bottom")+'"></div>'),s.append(c)),p.length&&(p[0].style.opacity=Math.max(-r,0)),c.length&&(c[0].style.opacity=Math.max(r,0))}s.transform("translate3d("+l+"px, "+d+"px, 0px) rotateX("+o+"deg) rotateY("+n+"deg)")}},setTransition:function(e){var a=this,t=a.slides,i=a.activeIndex,s=a.$wrapperEl;if(t.transition(e).find(".swiper-slide-shadow-top, .swiper-slide-shadow-right, .swiper-slide-shadow-bottom, .swiper-slide-shadow-left").transition(e),a.params.virtualTranslate&&0!==e){var r=!1;t.eq(i).transitionEnd(function(){if(!r&&a&&!a.destroyed){r=!0,a.animating=!1;for(var e=["webkitTransitionEnd","transitionend"],t=0;t<e.length;t+=1)s.trigger(e[t])}})}}},_={setTranslate:function(){for(var e=this,t=e.width,a=e.height,i=e.slides,s=e.$wrapperEl,r=e.slidesSizesGrid,n=e.params.coverflowEffect,o=e.isHorizontal(),l=e.translate,d=o?t/2-l:a/2-l,p=o?n.rotate:-n.rotate,c=n.depth,u=0,h=i.length;u<h;u+=1){var v=i.eq(u),f=r[u],m=(d-v[0].swiperSlideOffset-f/2)/f*n.modifier,g=o?p*m:0,b=o?0:p*m,w=-c*Math.abs(m),y=o?0:n.stretch*m,x=o?n.stretch*m:0;Math.abs(x)<.001&&(x=0),Math.abs(y)<.001&&(y=0),Math.abs(w)<.001&&(w=0),Math.abs(g)<.001&&(g=0),Math.abs(b)<.001&&(b=0);var T="translate3d("+x+"px,"+y+"px,"+w+"px)  rotateX("+b+"deg) rotateY("+g+"deg)";if(v.transform(T),v[0].style.zIndex=1-Math.abs(Math.round(m)),n.slideShadows){var E=o?v.find(".swiper-slide-shadow-left"):v.find(".swiper-slide-shadow-top"),S=o?v.find(".swiper-slide-shadow-right"):v.find(".swiper-slide-shadow-bottom");0===E.length&&(E=L('<div class="swiper-slide-shadow-'+(o?"left":"top")+'"></div>'),v.append(E)),0===S.length&&(S=L('<div class="swiper-slide-shadow-'+(o?"right":"bottom")+'"></div>'),v.append(S)),E.length&&(E[0].style.opacity=0<m?m:0),S.length&&(S[0].style.opacity=0<-m?-m:0)}}(te.pointerEvents||te.prefixedPointerEvents)&&(s[0].style.perspectiveOrigin=d+"px 50%")},setTransition:function(e){this.slides.transition(e).find(".swiper-slide-shadow-top, .swiper-slide-shadow-right, .swiper-slide-shadow-bottom, .swiper-slide-shadow-left").transition(e)}},Z={init:function(){var e=this,t=e.params.thumbs,a=e.constructor;t.swiper instanceof a?(e.thumbs.swiper=t.swiper,ee.extend(e.thumbs.swiper.originalParams,{watchSlidesProgress:!0,slideToClickedSlide:!1}),ee.extend(e.thumbs.swiper.params,{watchSlidesProgress:!0,slideToClickedSlide:!1})):ee.isObject(t.swiper)&&(e.thumbs.swiper=new a(ee.extend({},t.swiper,{watchSlidesVisibility:!0,watchSlidesProgress:!0,slideToClickedSlide:!1})),e.thumbs.swiperCreated=!0),e.thumbs.swiper.$el.addClass(e.params.thumbs.thumbsContainerClass),e.thumbs.swiper.on("tap",e.thumbs.onThumbClick)},onThumbClick:function(){var e=this,t=e.thumbs.swiper;if(t){var a=t.clickedIndex,i=t.clickedSlide;if(!(i&&L(i).hasClass(e.params.thumbs.slideThumbActiveClass)||null==a)){var s;if(s=t.params.loop?parseInt(L(t.clickedSlide).attr("data-swiper-slide-index"),10):a,e.params.loop){var r=e.activeIndex;e.slides.eq(r).hasClass(e.params.slideDuplicateClass)&&(e.loopFix(),e._clientLeft=e.$wrapperEl[0].clientLeft,r=e.activeIndex);var n=e.slides.eq(r).prevAll('[data-swiper-slide-index="'+s+'"]').eq(0).index(),o=e.slides.eq(r).nextAll('[data-swiper-slide-index="'+s+'"]').eq(0).index();s=void 0===n?o:void 0===o?n:o-r<r-n?o:n}e.slideTo(s)}}},update:function(e){var t=this,a=t.thumbs.swiper;if(a){var i="auto"===a.params.slidesPerView?a.slidesPerViewDynamic():a.params.slidesPerView;if(t.realIndex!==a.realIndex){var s,r=a.activeIndex;if(a.params.loop){a.slides.eq(r).hasClass(a.params.slideDuplicateClass)&&(a.loopFix(),a._clientLeft=a.$wrapperEl[0].clientLeft,r=a.activeIndex);var n=a.slides.eq(r).prevAll('[data-swiper-slide-index="'+t.realIndex+'"]').eq(0).index(),o=a.slides.eq(r).nextAll('[data-swiper-slide-index="'+t.realIndex+'"]').eq(0).index();s=void 0===n?o:void 0===o?n:o-r==r-n?r:o-r<r-n?o:n}else s=t.realIndex;a.visibleSlidesIndexes.indexOf(s)<0&&(a.params.centeredSlides?s=r<s?s-Math.floor(i/2)+1:s+Math.floor(i/2)-1:r<s&&(s=s-i+1),a.slideTo(s,e?0:void 0))}var l=1,d=t.params.thumbs.slideThumbActiveClass;if(1<t.params.slidesPerView&&!t.params.centeredSlides&&(l=t.params.slidesPerView),a.slides.removeClass(d),a.params.loop)for(var p=0;p<l;p+=1)a.$wrapperEl.children('[data-swiper-slide-index="'+(t.realIndex+p)+'"]').addClass(d);else for(var c=0;c<l;c+=1)a.slides.eq(t.realIndex+c).addClass(d)}}},Q=[E,S,C,M,P,$,O,{name:"mousewheel",params:{mousewheel:{enabled:!1,releaseOnEdges:!1,invert:!1,forceToAxis:!1,sensitivity:1,eventsTarged:"container"}},create:function(){var e=this;ee.extend(e,{mousewheel:{enabled:!1,enable:A.enable.bind(e),disable:A.disable.bind(e),handle:A.handle.bind(e),handleMouseEnter:A.handleMouseEnter.bind(e),handleMouseLeave:A.handleMouseLeave.bind(e),lastScrollTime:ee.now()}})},on:{init:function(){this.params.mousewheel.enabled&&this.mousewheel.enable()},destroy:function(){this.mousewheel.enabled&&this.mousewheel.disable()}}},{name:"navigation",params:{navigation:{nextEl:null,prevEl:null,hideOnClick:!1,disabledClass:"swiper-button-disabled",hiddenClass:"swiper-button-hidden",lockClass:"swiper-button-lock"}},create:function(){var e=this;ee.extend(e,{navigation:{init:H.init.bind(e),update:H.update.bind(e),destroy:H.destroy.bind(e),onNextClick:H.onNextClick.bind(e),onPrevClick:H.onPrevClick.bind(e)}})},on:{init:function(){this.navigation.init(),this.navigation.update()},toEdge:function(){this.navigation.update()},fromEdge:function(){this.navigation.update()},destroy:function(){this.navigation.destroy()},click:function(e){var t,a=this,i=a.navigation,s=i.$nextEl,r=i.$prevEl;!a.params.navigation.hideOnClick||L(e.target).is(r)||L(e.target).is(s)||(s?t=s.hasClass(a.params.navigation.hiddenClass):r&&(t=r.hasClass(a.params.navigation.hiddenClass)),!0===t?a.emit("navigationShow",a):a.emit("navigationHide",a),s&&s.toggleClass(a.params.navigation.hiddenClass),r&&r.toggleClass(a.params.navigation.hiddenClass))}}},{name:"pagination",params:{pagination:{el:null,bulletElement:"span",clickable:!1,hideOnClick:!1,renderBullet:null,renderProgressbar:null,renderFraction:null,renderCustom:null,progressbarOpposite:!1,type:"bullets",dynamicBullets:!1,dynamicMainBullets:1,formatFractionCurrent:function(e){return e},formatFractionTotal:function(e){return e},bulletClass:"swiper-pagination-bullet",bulletActiveClass:"swiper-pagination-bullet-active",modifierClass:"swiper-pagination-",currentClass:"swiper-pagination-current",totalClass:"swiper-pagination-total",hiddenClass:"swiper-pagination-hidden",progressbarFillClass:"swiper-pagination-progressbar-fill",progressbarOppositeClass:"swiper-pagination-progressbar-opposite",clickableClass:"swiper-pagination-clickable",lockClass:"swiper-pagination-lock"}},create:function(){var e=this;ee.extend(e,{pagination:{init:N.init.bind(e),render:N.render.bind(e),update:N.update.bind(e),destroy:N.destroy.bind(e),dynamicBulletIndex:0}})},on:{init:function(){this.pagination.init(),this.pagination.render(),this.pagination.update()},activeIndexChange:function(){this.params.loop?this.pagination.update():void 0===this.snapIndex&&this.pagination.update()},snapIndexChange:function(){this.params.loop||this.pagination.update()},slidesLengthChange:function(){this.params.loop&&(this.pagination.render(),this.pagination.update())},snapGridLengthChange:function(){this.params.loop||(this.pagination.render(),this.pagination.update())},destroy:function(){this.pagination.destroy()},click:function(e){var t=this;t.params.pagination.el&&t.params.pagination.hideOnClick&&0<t.pagination.$el.length&&!L(e.target).hasClass(t.params.pagination.bulletClass)&&(!0===t.pagination.$el.hasClass(t.params.pagination.hiddenClass)?t.emit("paginationShow",t):t.emit("paginationHide",t),t.pagination.$el.toggleClass(t.params.pagination.hiddenClass))}}},{name:"scrollbar",params:{scrollbar:{el:null,dragSize:"auto",hide:!1,draggable:!1,snapOnRelease:!0,lockClass:"swiper-scrollbar-lock",dragClass:"swiper-scrollbar-drag"}},create:function(){var e=this;ee.extend(e,{scrollbar:{init:G.init.bind(e),destroy:G.destroy.bind(e),updateSize:G.updateSize.bind(e),setTranslate:G.setTranslate.bind(e),setTransition:G.setTransition.bind(e),enableDraggable:G.enableDraggable.bind(e),disableDraggable:G.disableDraggable.bind(e),setDragPosition:G.setDragPosition.bind(e),onDragStart:G.onDragStart.bind(e),onDragMove:G.onDragMove.bind(e),onDragEnd:G.onDragEnd.bind(e),isTouched:!1,timeout:null,dragTimeout:null}})},on:{init:function(){this.scrollbar.init(),this.scrollbar.updateSize(),this.scrollbar.setTranslate()},update:function(){this.scrollbar.updateSize()},resize:function(){this.scrollbar.updateSize()},observerUpdate:function(){this.scrollbar.updateSize()},setTranslate:function(){this.scrollbar.setTranslate()},setTransition:function(e){this.scrollbar.setTransition(e)},destroy:function(){this.scrollbar.destroy()}}},{name:"parallax",params:{parallax:{enabled:!1}},create:function(){ee.extend(this,{parallax:{setTransform:B.setTransform.bind(this),setTranslate:B.setTranslate.bind(this),setTransition:B.setTransition.bind(this)}})},on:{beforeInit:function(){this.params.parallax.enabled&&(this.params.watchSlidesProgress=!0,this.originalParams.watchSlidesProgress=!0)},init:function(){this.params.parallax.enabled&&this.parallax.setTranslate()},setTranslate:function(){this.params.parallax.enabled&&this.parallax.setTranslate()},setTransition:function(e){this.params.parallax.enabled&&this.parallax.setTransition(e)}}},{name:"zoom",params:{zoom:{enabled:!1,maxRatio:3,minRatio:1,toggle:!0,containerClass:"swiper-zoom-container",zoomedSlideClass:"swiper-slide-zoomed"}},create:function(){var i=this,t={enabled:!1,scale:1,currentScale:1,isScaling:!1,gesture:{$slideEl:void 0,slideWidth:void 0,slideHeight:void 0,$imageEl:void 0,$imageWrapEl:void 0,maxRatio:3},image:{isTouched:void 0,isMoved:void 0,currentX:void 0,currentY:void 0,minX:void 0,minY:void 0,maxX:void 0,maxY:void 0,width:void 0,height:void 0,startX:void 0,startY:void 0,touchesStart:{},touchesCurrent:{}},velocity:{x:void 0,y:void 0,prevPositionX:void 0,prevPositionY:void 0,prevTime:void 0}};"onGestureStart onGestureChange onGestureEnd onTouchStart onTouchMove onTouchEnd onTransitionEnd toggle enable disable in out".split(" ").forEach(function(e){t[e]=X[e].bind(i)}),ee.extend(i,{zoom:t});var s=1;Object.defineProperty(i.zoom,"scale",{get:function(){return s},set:function(e){if(s!==e){var t=i.zoom.gesture.$imageEl?i.zoom.gesture.$imageEl[0]:void 0,a=i.zoom.gesture.$slideEl?i.zoom.gesture.$slideEl[0]:void 0;i.emit("zoomChange",e,t,a)}s=e}})},on:{init:function(){this.params.zoom.enabled&&this.zoom.enable()},destroy:function(){this.zoom.disable()},touchStart:function(e){this.zoom.enabled&&this.zoom.onTouchStart(e)},touchEnd:function(e){this.zoom.enabled&&this.zoom.onTouchEnd(e)},doubleTap:function(e){this.params.zoom.enabled&&this.zoom.enabled&&this.params.zoom.toggle&&this.zoom.toggle(e)},transitionEnd:function(){this.zoom.enabled&&this.params.zoom.enabled&&this.zoom.onTransitionEnd()}}},{name:"lazy",params:{lazy:{enabled:!1,loadPrevNext:!1,loadPrevNextAmount:1,loadOnTransitionStart:!1,elementClass:"swiper-lazy",loadingClass:"swiper-lazy-loading",loadedClass:"swiper-lazy-loaded",preloaderClass:"swiper-lazy-preloader"}},create:function(){ee.extend(this,{lazy:{initialImageLoaded:!1,load:Y.load.bind(this),loadInSlide:Y.loadInSlide.bind(this)}})},on:{beforeInit:function(){this.params.lazy.enabled&&this.params.preloadImages&&(this.params.preloadImages=!1)},init:function(){this.params.lazy.enabled&&!this.params.loop&&0===this.params.initialSlide&&this.lazy.load()},scroll:function(){this.params.freeMode&&!this.params.freeModeSticky&&this.lazy.load()},resize:function(){this.params.lazy.enabled&&this.lazy.load()},scrollbarDragMove:function(){this.params.lazy.enabled&&this.lazy.load()},transitionStart:function(){var e=this;e.params.lazy.enabled&&(e.params.lazy.loadOnTransitionStart||!e.params.lazy.loadOnTransitionStart&&!e.lazy.initialImageLoaded)&&e.lazy.load()},transitionEnd:function(){this.params.lazy.enabled&&!this.params.lazy.loadOnTransitionStart&&this.lazy.load()}}},{name:"controller",params:{controller:{control:void 0,inverse:!1,by:"slide"}},create:function(){var e=this;ee.extend(e,{controller:{control:e.params.controller.control,getInterpolateFunction:V.getInterpolateFunction.bind(e),setTranslate:V.setTranslate.bind(e),setTransition:V.setTransition.bind(e)}})},on:{update:function(){this.controller.control&&this.controller.spline&&(this.controller.spline=void 0,delete this.controller.spline)},resize:function(){this.controller.control&&this.controller.spline&&(this.controller.spline=void 0,delete this.controller.spline)},observerUpdate:function(){this.controller.control&&this.controller.spline&&(this.controller.spline=void 0,delete this.controller.spline)},setTranslate:function(e,t){this.controller.control&&this.controller.setTranslate(e,t)},setTransition:function(e,t){this.controller.control&&this.controller.setTransition(e,t)}}},{name:"a11y",params:{a11y:{enabled:!0,notificationClass:"swiper-notification",prevSlideMessage:"Previous slide",nextSlideMessage:"Next slide",firstSlideMessage:"This is the first slide",lastSlideMessage:"This is the last slide",paginationBulletMessage:"Go to slide {{index}}"}},create:function(){var t=this;ee.extend(t,{a11y:{liveRegion:L('<span class="'+t.params.a11y.notificationClass+'" aria-live="assertive" aria-atomic="true"></span>')}}),Object.keys(F).forEach(function(e){t.a11y[e]=F[e].bind(t)})},on:{init:function(){this.params.a11y.enabled&&(this.a11y.init(),this.a11y.updateNavigation())},toEdge:function(){this.params.a11y.enabled&&this.a11y.updateNavigation()},fromEdge:function(){this.params.a11y.enabled&&this.a11y.updateNavigation()},paginationUpdate:function(){this.params.a11y.enabled&&this.a11y.updatePagination()},destroy:function(){this.params.a11y.enabled&&this.a11y.destroy()}}},{name:"history",params:{history:{enabled:!1,replaceState:!1,key:"slides"}},create:function(){var e=this;ee.extend(e,{history:{init:R.init.bind(e),setHistory:R.setHistory.bind(e),setHistoryPopState:R.setHistoryPopState.bind(e),scrollToSlide:R.scrollToSlide.bind(e),destroy:R.destroy.bind(e)}})},on:{init:function(){this.params.history.enabled&&this.history.init()},destroy:function(){this.params.history.enabled&&this.history.destroy()},transitionEnd:function(){this.history.initialized&&this.history.setHistory(this.params.history.key,this.activeIndex)}}},{name:"hash-navigation",params:{hashNavigation:{enabled:!1,replaceState:!1,watchState:!1}},create:function(){var e=this;ee.extend(e,{hashNavigation:{initialized:!1,init:q.init.bind(e),destroy:q.destroy.bind(e),setHash:q.setHash.bind(e),onHashCange:q.onHashCange.bind(e)}})},on:{init:function(){this.params.hashNavigation.enabled&&this.hashNavigation.init()},destroy:function(){this.params.hashNavigation.enabled&&this.hashNavigation.destroy()},transitionEnd:function(){this.hashNavigation.initialized&&this.hashNavigation.setHash()}}},{name:"autoplay",params:{autoplay:{enabled:!1,delay:3e3,waitForTransition:!0,disableOnInteraction:!0,stopOnLastSlide:!1,reverseDirection:!1}},create:function(){var t=this;ee.extend(t,{autoplay:{running:!1,paused:!1,run:W.run.bind(t),start:W.start.bind(t),stop:W.stop.bind(t),pause:W.pause.bind(t),onTransitionEnd:function(e){t&&!t.destroyed&&t.$wrapperEl&&e.target===this&&(t.$wrapperEl[0].removeEventListener("transitionend",t.autoplay.onTransitionEnd),t.$wrapperEl[0].removeEventListener("webkitTransitionEnd",t.autoplay.onTransitionEnd),t.autoplay.paused=!1,t.autoplay.running?t.autoplay.run():t.autoplay.stop())}}})},on:{init:function(){this.params.autoplay.enabled&&this.autoplay.start()},beforeTransitionStart:function(e,t){this.autoplay.running&&(t||!this.params.autoplay.disableOnInteraction?this.autoplay.pause(e):this.autoplay.stop())},sliderFirstMove:function(){this.autoplay.running&&(this.params.autoplay.disableOnInteraction?this.autoplay.stop():this.autoplay.pause())},destroy:function(){this.autoplay.running&&this.autoplay.stop()}}},{name:"effect-fade",params:{fadeEffect:{crossFade:!1}},create:function(){ee.extend(this,{fadeEffect:{setTranslate:j.setTranslate.bind(this),setTransition:j.setTransition.bind(this)}})},on:{beforeInit:function(){var e=this;if("fade"===e.params.effect){e.classNames.push(e.params.containerModifierClass+"fade");var t={slidesPerView:1,slidesPerColumn:1,slidesPerGroup:1,watchSlidesProgress:!0,spaceBetween:0,virtualTranslate:!0};ee.extend(e.params,t),ee.extend(e.originalParams,t)}},setTranslate:function(){"fade"===this.params.effect&&this.fadeEffect.setTranslate()},setTransition:function(e){"fade"===this.params.effect&&this.fadeEffect.setTransition(e)}}},{name:"effect-cube",params:{cubeEffect:{slideShadows:!0,shadow:!0,shadowOffset:20,shadowScale:.94}},create:function(){ee.extend(this,{cubeEffect:{setTranslate:U.setTranslate.bind(this),setTransition:U.setTransition.bind(this)}})},on:{beforeInit:function(){var e=this;if("cube"===e.params.effect){e.classNames.push(e.params.containerModifierClass+"cube"),e.classNames.push(e.params.containerModifierClass+"3d");var t={slidesPerView:1,slidesPerColumn:1,slidesPerGroup:1,watchSlidesProgress:!0,resistanceRatio:0,spaceBetween:0,centeredSlides:!1,virtualTranslate:!0};ee.extend(e.params,t),ee.extend(e.originalParams,t)}},setTranslate:function(){"cube"===this.params.effect&&this.cubeEffect.setTranslate()},setTransition:function(e){"cube"===this.params.effect&&this.cubeEffect.setTransition(e)}}},{name:"effect-flip",params:{flipEffect:{slideShadows:!0,limitRotation:!0}},create:function(){ee.extend(this,{flipEffect:{setTranslate:K.setTranslate.bind(this),setTransition:K.setTransition.bind(this)}})},on:{beforeInit:function(){var e=this;if("flip"===e.params.effect){e.classNames.push(e.params.containerModifierClass+"flip"),e.classNames.push(e.params.containerModifierClass+"3d");var t={slidesPerView:1,slidesPerColumn:1,slidesPerGroup:1,watchSlidesProgress:!0,spaceBetween:0,virtualTranslate:!0};ee.extend(e.params,t),ee.extend(e.originalParams,t)}},setTranslate:function(){"flip"===this.params.effect&&this.flipEffect.setTranslate()},setTransition:function(e){"flip"===this.params.effect&&this.flipEffect.setTransition(e)}}},{name:"effect-coverflow",params:{coverflowEffect:{rotate:50,stretch:0,depth:100,modifier:1,slideShadows:!0}},create:function(){ee.extend(this,{coverflowEffect:{setTranslate:_.setTranslate.bind(this),setTransition:_.setTransition.bind(this)}})},on:{beforeInit:function(){var e=this;"coverflow"===e.params.effect&&(e.classNames.push(e.params.containerModifierClass+"coverflow"),e.classNames.push(e.params.containerModifierClass+"3d"),e.params.watchSlidesProgress=!0,e.originalParams.watchSlidesProgress=!0)},setTranslate:function(){"coverflow"===this.params.effect&&this.coverflowEffect.setTranslate()},setTransition:function(e){"coverflow"===this.params.effect&&this.coverflowEffect.setTransition(e)}}},{name:"thumbs",params:{thumbs:{swiper:null,slideThumbActiveClass:"swiper-slide-thumb-active",thumbsContainerClass:"swiper-container-thumbs"}},create:function(){ee.extend(this,{thumbs:{swiper:null,init:Z.init.bind(this),update:Z.update.bind(this),onThumbClick:Z.onThumbClick.bind(this)}})},on:{beforeInit:function(){var e=this.params.thumbs;e&&e.swiper&&(this.thumbs.init(),this.thumbs.update(!0))},slideChange:function(){this.thumbs.swiper&&this.thumbs.update()},update:function(){this.thumbs.swiper&&this.thumbs.update()},resize:function(){this.thumbs.swiper&&this.thumbs.update()},observerUpdate:function(){this.thumbs.swiper&&this.thumbs.update()},setTransition:function(e){var t=this.thumbs.swiper;t&&t.setTransition(e)},beforeDestroy:function(){var e=this.thumbs.swiper;e&&this.thumbs.swiperCreated&&e&&e.destroy()}}}];return void 0===T.use&&(T.use=T.Class.use,T.installModule=T.Class.installModule),T.use(Q),T});
//# sourceMappingURL=swiper.min.js.map


// main.js
var main = new Vue({
	el: '#main',
	data: {
		intrShow: 0,
		intrHight: 0,
		intrBut: '了解更多'
	},
	methods: {
		learnMore() {
			if (!this.intrShow) {
				this.$refs.intr.style.height = 'auto';
				this.intrHight = this.$refs.intr.clientHeight;
				this.$refs.intr.style.height = '0px';
				var that = this;
				setTimeout(function() {
					that.$refs.intr.style.height = that.intrHight + 'px';
					that.$refs.intr.style.border = 'solid 1px #c3c3c3';
					that.intrBut = '收起';
					that.intrShow = 1;
				}, 20)
			} else {
				this.$refs.intr.style.height = 0;
				this.$refs.intr.style.border = 'solid 0px #c3c3c3';
				this.intrBut = '了解更多';
				this.intrShow = 0;
			}
		}
	},
	mounted() {
		var FW = this.$el.clientWidth;

		this.$refs.firstPage.style.height = FW * 0.6 + 'px';
		this.$refs.firstPage.style.fontSize = FW * 0.03 + 'px';

		this.$refs.rightimg.style.width = FW * 0.52 + 'px';
		this.$refs.leftimg.style.width = FW * 0.5910 + 'px';
		this.$refs.schoolLogo.style.width = FW * 0.26 + 'px';

		this.$refs.learnMore.style.fontSize = FW * 0.03 + 'px';
		this.$refs.intr.style.fontSize = FW * 0.04 + 'px';


		this.$refs.intr.style.height = 0;
	}
});

// news.js
var news = new Vue({
	el: '#news',
	data: {
		newsList: []
	},
	methods: {
		goToNewsDetails(id) {
			window.open('newsDetails.html?id=' + id, '_self');
		}
	},
	mounted() {
		this.$el.children[0].style.fontSize = this.$el.clientWidth * 0.056 + 'px';
		this.$el.children[1].style.height = this.$el.clientWidth * 0.012 + 'px';
		this.$el.children[2].style.height = this.$el.clientWidth * 1.5 + 'px';
		this.$el.style.paddingLeft = this.$el.clientWidth * 0.07 + 'px';
		this.$el.style.paddingRight = this.$el.clientWidth * 0.07 + 'px';
		this.$el.children[2].style.fontSize = this.$el.clientWidth * 0.045 + 'px';
		this.$http.get('http://www.newxstudio.com/admin/login/returnnews').then(res => {
			if (res.data.code == 0) {
				this.newsList = res.data.data;
				this.$nextTick(function() {
					if (this.$refs.newsContent) {
						for (var i = 0; i < this.$refs.newsContent.length; i++) {
							this.$el.children[2].children[0].children[i].style.fontSize = this.$el.clientWidth * 0.045 + 'px';
							this.$refs.newsTitle[i].style.fontSize = this.$el.clientWidth * 0.045 + 'px';
							this.$refs.newsContent[i].style.fontSize = this.$el.clientWidth * 0.035 + 'px';
						}
					}
				});
				setTimeout(function() {
					new Swiper('.swiper-container-n', {
						direction: 'horizontal',
						mousewheelControl: true,
						autoplay: true,
						autoplay: {
							disableOnInteraction: false,
							delay: 3000
						},
						centeredSlides: true,
						longSwipesRatio: 0.05,
						pagination: {
							el: '.swiper-pagination',
							clickable: true,
						},
						navigation: {
							nextEl: '.swiper-button-next',
							prevEl: '.swiper-button-prev',
						},
					})
				}, 500)
			}
		});

	}
});

// details.js
var details = new Vue({
	el: '#details',
	data: {
		liHei: null,
		dHei: null,
		fHei: null,
		Hei: null,
	},
	methods: {
		change() {
			var FW = this.$el.clientWidth;
			this.$el.style.height = FW * 0.88 + 'px';
			this.$el.children[0].style.fontSize = FW * 0.056 + 'px';
			this.$el.children[0].children[1].style.height = FW * 0.009 + 'px';
			this.$el.children[0].children[1].style.marginTop = FW * 0.0115 + 'px';
			this.$el.children[1].style.height = this.$el.children[1].clientWidth * 0.2 + 'px';
			this.liHei = this.$el.children[1].children[0].children[0].clientHeight;
			this.dHei = this.$el.children[1].children[0].children[0].children[0].clientHeight;
			this.fHei = this.$el.children[1].children[0].children[0].children[0].children[0].clientHeight;
			this.Hei = this.$el.children[1].children[0].children[0].children[0].children[0].children[0].clientHeight;
			for (var i = 0; i < 6; i++) {
				this.$el.children[1].children[0].children[i].children[0].children[0].children[0].style.backgroundPositionY = -(
					this.Hei * i) * 0.986 + 'px';
				this.$el.children[1].children[0].children[i].children[0].children[0].style.marginTop = (this.fHei - this.Hei) / 2 +
					'px';
				this.$el.children[1].children[0].children[i].children[0].children[0].children[0].style.marginTop = (this.fHei -
						this.Hei) *
					0.4 + 'px';
			};
			this.$el.children[2].style.height = FW * 0.18 + 'px';
			this.$el.children[2].style.fontSize = FW * 0.051 + 'px';
			this.$el.children[3].style.fontSize = FW * 0.046 + 'px';
			this.$el.children[3].style.borderWidth=FW*0.01+'px';
			this.$el.children[3].style.borderRadius=FW*0.05+'px';
			this.$el.children[3].style.left=(FW-this.$el.children[3].clientWidth)/2+'px';
			this.$el.children[3].style.lineHeight=this.$el.children[3].clientHeight-5+'px';
		},
		deMoreA(){
			var index = mySwiperDe.activeIndex;
			if (index < 5) {
				index += 6;
			};
			// console.log(index);
			var aLink=['office','graphics','collect','edit','video','web'];
			window.open('department.html?department='+aLink[index%6],'_self');
		},
		goToDepartment(type){
			window.open('department.html?department='+type,'_self');
		}
	},
	mounted() {
		this.change();
	}
})

var mySwiperDe = new Swiper('.swiper-container-d', {
	// direction: 'vertical', // 垂直切换选项
	loop: true, // 循环模式选项
	autoplay: true,
	autoplay: {
		disableOnInteraction: false,
		delay: 3000
	},
	freeMode: false,
	// // grabCursor:true,
	// // disableOnInteraction:false,
	speed: 800,
	// effect: 'coverflow',
	// // effect : 'flip',
	longSwipesRatio: 0.05,
	// freeMode: true,
	// freeModeMomentum: false,
	// freeModeMomentumBounce: false,
	// speed: 800,
	slidesPerView: 5,
	centeredSlides: true,
	freeModeMomentumBounce: false,
	centeredSlides: false,

	on: {
		slideChangeTransitionStart: function() {
			// console.log(this.activeIndex)
			var index = this.activeIndex;
			if (index < 5) {
				index += 6;
			};
			for (var i = 0; i < 16; i++) {
				details.$el.children[1].children[0].children[i].children[0].style.width = "60%";
				details.$el.children[1].children[0].children[i].children[0].style.height = "60%";
				details.$el.children[1].children[0].children[i].children[0].style.marginTop = (details.liHei - details.dHei) / 2 +
					'px';
				details.$el.children[1].children[0].children[i].children[0].children[0].children[0].style.backgroundPositionY = -
					(details.Hei * (i % 6)) * 0.986 + 'px';
				details.$el.children[1].children[0].children[i].children[0].children[0].style.marginTop = (details.fHei -
						details.Hei) / 2 +
					'px';
				details.$el.children[1].children[0].children[i].children[0].children[0].children[0].style.marginTop = (details.fHei -
					details.Hei) * 0.4 + 'px';
				details.$el.children[2].children[i % 6].style.width = "0%";
				details.$el.children[2].children[i % 6].style.height = "0%";
			};
			details.$el.children[1].children[0].children[this.activeIndex + 2].children[0].style.width = "100%";
			details.$el.children[1].children[0].children[this.activeIndex + 2].children[0].style.height = "100%";
			details.$el.children[1].children[0].children[this.activeIndex + 2].children[0].children[0].style.marginTop = (
				details.fHei - details.Hei) * 0.7 + 'px';
			details.$el.children[1].children[0].children[this.activeIndex + 2].children[0].children[0].children[0].style.backgroundPositionY = -
				((details.Hei / 0.6) * ((index - 4) % 6)) * 0.986 + 'px';
			details.$el.children[1].children[0].children[this.activeIndex + 2].children[0].style.marginTop = '0px';
			details.$el.children[1].children[0].children[this.activeIndex + 2].children[0].children[0].children[0].style.marginTop=(details.fHei-details.Hei)+'px';
			details.$el.children[2].children[(index - 5) % 6].style.width = "100%";
			details.$el.children[2].children[(index - 5) % 6].style.height = "100%";
			var color=['rgb(255, 196, 0)','#e8e87e','#778899','#2afd9d','#f29090','#53b7e0'];
			details.$el.children[3].style.borderColor = color[(index - 5) % 6];
		},
	},
});

// joinUs.js
var joinUs = new Vue({
	el: '#joinUs',
	data: {},
	methods: {
		goToJoin() {
			this.$el.firstChild.style.backgroundColor = "yellow";
			alert("暂未开放报名");
			this.$el.firstChild.style.backgroundColor = "";
		}
	},
	mounted() {
		var FW = this.$el.clientWidth;
		this.$el.style.marginTop = FW * 0.2 + 'px';
		this.$el.style.height = FW * 1.0 + 'px';
		this.$el.children[0].style.fontSize = FW * 0.056 + 'px';
		this.$el.children[2].style.fontSize = FW * 0.04 + 'px';
		this.$el.children[2].style.borderRadius = FW * 0.205 + 'px';
		this.$el.children[2].children[0].style.borderWidth = FW * 0.008 + 'px';
		this.$el.children[2].children[1].style.borderWidth = FW * 0.008 + 'px';
		this.$el.children[0].children[2].style.height = FW * 0.01 + 'px';
		this.$el.children[0].children[5].style.height = FW * 0.005 + 'px';
		this.$el.children[0].children[2].style.marginTop = FW * 0.0115 + 'px';
		this.$el.children[0].children[2].style.marginBottom = FW * 0.03 + 'px';
		// this.$el.children[0].children[2].style.fontSize = FW * 0.04 + 'px';
		// this.$el.children[0].children[3].style.fontSize = FW * 0.04 + 'px';
	}
});

// contact.js
var QQTem = {
	template: '<img class="QRcodes" src="http://img.wh241.cn/blog/20190905/SJn5mUzi2XTw.png?imageslim" />',
};
var wechatTem = {
	template: '<img class="QRcodes" src="http://img.wh241.cn/blog/20190905/bM2gLcvUXdgc.png?imageslim" />',
};

var QRcodeRou = new VueRouter({
	routes: [{
		path: '/',
		redirect: '/qq',
	}, {
		path: '/contact',
		redirect: '/qq',
	},{
		path: '/details',
		redirect: '/qq',
	}, {
		path: '/qq',
		component: QQTem,
	}, {
		path: '/wechat',
		component: wechatTem,
	}],
})

var contact = new Vue({
	el: '#contact',
	data(){
		return {
			flag:0,
		}
	},
	methods: {
		coButMore() {
			window.open("openPage1.html", "_self");
		},
		GR(min, max) {
			return min + Math.floor(Math.random() * (max - min));
		},
		changeCilcle() {
			var cilcle = this.$el.children[5].children;
			var color = ['#98c6de', '#9da9b2', '#e4e59f', '#eeb6ba', '#65f2b5', '#ff981f']
			for (var i = 0; i < 6; i++) {
				cilcle[i].style.width = this.GR(10, 40) + '%';
				cilcle[i].style.height = cilcle[i].clientWidth + 'px';
				cilcle[i].style.top = this.GR(30, 70) + '%';
				cilcle[i].style.left = this.GR(5, 60) + '%';
				cilcle[i].style.backgroundColor = color[i];
			}
		}
	},
	mounted() {
		var FW = this.$el.clientWidth;
		this.$el.style.height = FW * 1.3806 + 'px';
		this.$el.children[0].style.fontSize = FW * 0.056 + 'px';
		this.$el.children[1].style.fontSize = FW * 0.11 + 'px';
		this.$el.children[0].children[1].style.height = FW * 0.009 + 'px';
		this.$el.children[0].children[1].style.marginTop = FW * 0.0115 + 'px';
		this.$el.children[2].style.borderRadius = FW * 0.1020408 + 'px';
		this.$el.children[2].style.fontSize = FW * 0.04 + 'px';
		this.$el.children[2].style.lineHeight = this.$el.children[2].clientHeight + 'px';
		this.$el.children[4].style.borderWidth = FW * 0.008 + 'px';
		this.$el.children[4].style.borderRadius = FW * 0.205 + 'px';
		this.$el.children[4].style.fontSize = FW * 0.05 + 'px';
		this.$el.children[4].style.lineHeight = this.$el.children[4].clientHeight + 'px';
		if (this.$route.path == '/wechat') {
			this.flag=1;
			this.$el.children[2].children[0].style.left = "45%";
			this.$el.children[1].children[1].style.color = "#343233"
			this.$el.children[1].children[0].style.color = "#6b6b6b"
		} else {
			this.flag=0;
			this.$el.children[2].children[0].style.left = "0";
			this.$el.children[1].children[0].style.color = "#343233"
			this.$el.children[1].children[1].style.color = "#6b6b6b"
		}
		var cilcle = this.$el.children[5].children;
		var color = ['#98c6de', '#9da9b2', '#e4e59f', '#eeb6ba', '#65f2b5', '#ff981f']
		for (var i = 0; i < 6; i++) {
			cilcle[i].style.width = this.GR(10, 40) + '%';
			cilcle[i].style.height = cilcle[i].clientWidth + 'px';
			cilcle[i].style.top = this.GR(30, 70) + '%';
			cilcle[i].style.left = this.GR(5, 60) + '%';
			cilcle[i].style.backgroundColor = color[i];
		};
		this.changeCilcle();
	},
	router: QRcodeRou,
	watch: {
		'$route.path': function(newVal) {
			var me = this;
			var cilcle = this.$el.children[5].children;
			for (var i = 0; i < 6; i++) {
				cilcle[i].style.transition = "all 0.2s ease";
				cilcle[i].style.width = '0'
				cilcle[i].style.height = '0'
				cilcle[i].style.top = 800+cilcle[i].clientHeight+'px';
				cilcle[i].style.left = 10000+cilcle[i].clientwidth+'px';
			}
			setTimeout(function() {
				var cilcle = me.$el.children[5].children;
				for (var i = 0; i < 6; i++) {
					cilcle[i].style.transition = "";
				}
				me.changeCilcle();
			}, 200);
			if (newVal == '/wechat') {
				this.flag=1;
				this.$el.children[2].children[0].style.left = "45%";
				this.$el.children[1].children[1].style.color = "#343233"
				this.$el.children[1].children[0].style.color = "#6b6b6b"
			} else {
				this.flag=0;
				this.$el.children[2].children[0].style.left = "0%";
				this.$el.children[1].children[0].style.color = "#343233"
				this.$el.children[1].children[1].style.color = "#6b6b6b"
			}
		}
	}
});

// bottom.js
var bottom= new Vue({
	el:'#bottom',
	mounted() {
		var FW = this.$el.clientWidth;
		this.$el.style.height = FW * 0.78469 + 'px';
		this.$el.style.fontSize = FW * 0.04 + 'px';
	}
});