'use strict';

var
	_ = require('lodash'),
	fs = require('fs'),
	path = require('path'),
	yargs = require('yargs'),
	temp = require('temp'),
	packageJson = require(path.join(__dirname, '..', 'package.json'));

require('./utils/rx-util');

temp.track();

// output streams
var exec = (cmd, yargs) => {
	try {
		cmd
			.execute(cmd.parseArgs(yargs))
			.subscribe(
				(result) => {
					if (_.isObject(result)) {
						process.stdout.write(JSON.stringify(result, ' ', 2));
					} else {
						process.stdout.write(result);
					}

					process.stdout.write('\n');
				},
				(error) => {
					throw error;
				},
				() => {}
			);
	} catch(ex) {
		// catch the failure during the creation of the command observable
		// yargs has this nasty habbit of not showing stack trace for errors
		console.error(ex.stack);
	}
};

var args = yargs.version(packageJson.version);

fs
	.readdirSync(path.join(__dirname, 'cmds'))
	.forEach(
		(name) => args.command(
			name,
			'Command: ' + name,
			(yargs) => exec(require('./cmds/' + name + '/' + name), yargs)
		)
	);

args
	.help('help')
	.demand(1) // must pick a command
	.strict()
	.argv;
