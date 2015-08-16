'use strict';

var
	_ = require('lodash'),
	AWS = require('aws-sdk'),
	rx = require('rx'),
	path = require('path'),
	config = require('config'),
	shortid = require('shortid'),
	url = require('url'),
	readlineSync = require('readline-sync');

var
	keelConfig = config.get('keel'),
	cmdCfStackCreate = require('../cf-stack-create/cf-stack-create'),
	cmdS3Upload = require('../s3-upload/s3-upload');

exports.parseArgs = (yargs) => require(
	'../cf-template-render/args'
)(yargs)
	.option(
		'docker-login',
		{
			describe: 'docker login'
		}
	)
	.option(
		'docker-password',
		{
			describe: 'docker password'
		}
	)
	.option(
		'docker-email',
		{
			describe: 'docker email'
		}
	)
	.argv;

exports.execute = (argv) => {
	AWS.config.credentials = new AWS.SharedIniFileCredentials({
		profile: argv.profile
	});

	let
		ecs = new AWS.ECS({
			apiVersion: '2014-11-13',
			region: argv.region
		}),

		s3 = new AWS.S3({
			apiVersion: '2010-05-15'
		}),

		dockerLogin = argv.dockerLogin || readlineSync.question(
			'docker account: '
		),

		dockerPassword = argv.dockerPassword || readlineSync.question(
			'Password for docker account [' + dockerLogin + ']: ',
			{
				hideEchoBack: true
			}
		),

		dockerEmail = argv.dockerEmail || readlineSync.question(
			'Email of your docker account [' + dockerLogin + ']: '
		);

	// create and upload configure file to s3
	return cmdS3Upload
		.execute({
			bucket: path.join(keelConfig.s3root, 'ecs.config'),
			key: argv.clusterName + '.' + shortid.generate() +'.ecs.config',
			data: [
				'ECS_CLUSTER=' + argv.clusterName,
				'ECS_ENGINE_AUTH_TYPE=dockercfg',
				'ECS_ENGINE_AUTH_DATA={'
					+ '"https://index.docker.io/v1/":{'
						+ '"auth": "'
							+ new Buffer(
								dockerLogin + ':' + dockerPassword
							).toString('base64')
						+ '",'
						+ '"email": "' + dockerEmail + '"'
					+ '}'
				+ '}'
			].join('\n'),
			profile: argv.profile,
			encryption: 'aes'
		})
		.concatMap(
			(resp) => rx.Observable.merge(
				// create ecs cluster
				rx
					.Observable
					.fromNodeCallback(ecs.createCluster, ecs)({
						clusterName: argv.clusterName
					}),
				// create cf stack
				cmdCfStackCreate.execute(_.assign(
					argv,
					{
						ecsConfigS3Path: url
							.parse(decodeURIComponent(resp.Location))
							.pathname
							.substring(1)
					}
				))
			)
		)
		.take(2);
};
