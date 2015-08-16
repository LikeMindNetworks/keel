'use strict';

var
	_ = require('lodash'),
	path = require('path'),
	fs = require('fs'),
	AWS = require('aws-sdk'),
	rx = require('rx');

var
	SERVICE_DEF_FILE_NAME = 'keel.service.json';

exports.parseArgs = (yargs) => yargs
	.option(
		'profile',
		{
			describe: 'profile for aws',
			default: 'default'
		}
	)
	.option(
		'region',
		{

			describe: 'aws region',
			demand: true
		}
	)
	.argv;

exports.execute = (argv) => {
	AWS.config.credentials = new AWS.SharedIniFileCredentials({
		profile: argv.profile
	});

	let
		cwd = path.resolve(process.cwd(), argv._[1] || '.'),

		ecs = rx.Observable.fromNodeCallbackAll(new AWS.ECS({
			apiVersion: '2014-11-13',
			region: argv.region
		}));

	if (!fs.lstatSync(cwd).isDirectory()) {
		throw new Error(cwd + ' is not a directory');
	}

	return rx
		.Observable
		.fromNodeCallback(fs.readFile, fs)(
			path.resolve(cwd, SERVICE_DEF_FILE_NAME)
		)
		.map(
			(buffer) => JSON.parse(buffer.toString())
		)
		.concatMap(
			(taskDefn) => ecs.updateService({
				service: taskDefn.serviceName,
				cluster: taskDefn.cluster,
				desiredCount: taskDefn.desiredCount,
				taskDefinition: taskDefn.taskDefinition
			})
		);
};
