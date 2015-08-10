'use strict';

var
	_ = require('lodash'),
	through2 = require('through2'),
	minimist = require('minimist');

var
	argv = minimist(process.argv.slice(2)),
	cmd = _.head(argv._);

// commands
var
	cmdRenderCFTmplt = require('./cmds/render-cf-template/render-cf-template'),
	cmdRunKubectl = require('./cmds/run-kubectl/run-kubectl');

// output streams
var
	streamOut = new through2((data, enc, cb) => {
		this.push(data + '\n');
		cb();
	});

streamOut.pipe(process.stdout);

switch(cmd) {
	case 'render-cf-template':
		cmdRenderCFTmplt(argv, streamOut);
		break;

	case 'kubectl':
		cmdRunKubectl(argv, streamOut);
		break;
}
