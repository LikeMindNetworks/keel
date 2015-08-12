'use strict';

var
	_ = require('lodash'),
	rx = require('rx');

rx.Observable.fromNodeCallbackAll = (obj) => _
	.keysIn(obj)
	.reduce(
		(res, key) => {
			if (_.isFunction(obj[key])) {
				res[key] = rx.Observable.fromNodeCallback(obj[key], obj);
			} else {
				res[key] = obj[key];
			}

			return res;
		},
		{}
	);
