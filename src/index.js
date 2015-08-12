'use strict';

var
	_ = require('lodash'),
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
				},
				(error) => {
					throw error;
				},
				() => {
					process.stdout.write('\n');
				}
			);
	} catch(ex) {
		// catch the failure during the creation of the command observable
		// yargs has this nasty habbit of not showing stack trace for errors
		console.error(ex.stack);
	}
}

yargs
	.version(packageJson.version)
	.command(
		'render-cf-template',
		'render aws cloud formation template for cloud formation stack creation',
		(yargs) => exec(
			require('./cmds/render-cf-template/render-cf-template'),
			yargs
		)
	)
	.command(
		'create-stack',
		'create an aws stack for kubernetes',
		(yargs) => exec(
			require('./cmds/create-stack/create-stack'),
			yargs
		)
	)
	.command(
		's3-upload',
		'upload file to s3',
		(yargs) => exec(
			require('./cmds/s3-upload/s3-upload'),
			yargs
		)
	)
	.help('help')
	.demand(1) // must pick a command
	.argv;
