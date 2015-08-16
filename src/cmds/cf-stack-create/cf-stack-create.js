'use strict';

var
	_ = require('lodash'),
	AWS = require('aws-sdk'),
	fs = require('fs'),
	path = require('path'),
	temp = require('temp'),
	rx = require('rx'),
	config = require('config');

var
	keelConfig = config.get('keel'),
	cmdRenderCFTmplt = require('../cf-template-render/cf-template-render'),
	cmdS3Upload = require('../s3-upload/s3-upload');

exports.parseArgs = (yargs) => require(
	'../cf-template-render/args'
)(yargs).argv;

exports.execute = (argv) => rx
	.Observable
	.zip(
		// render template
		cmdRenderCFTmplt.execute(argv),

		// open temporary file
		rx.Observable.fromNodeCallback(temp.open)('keel-create-stack-cf'),

		(cfTemplate, tempFileInfo) => {

			// write to a temporary file
			fs.writeFileSync(tempFileInfo.path, JSON.stringify(cfTemplate));

			return tempFileInfo.path;
		}
	)
	.concatMap((tempFilePath) => cmdS3Upload.execute({
		bucket: path.join(keelConfig.s3root, 'stack-templates'),
		file: tempFilePath,
		profile: argv.profile
	}))
	.concatMap((uploadRes) => {
		AWS.config.credentials = new AWS.SharedIniFileCredentials({
			profile: argv.profile
		});

		let
			cloudformation = new AWS.CloudFormation({
				apiVersion: '2010-05-15',
				region: argv.region
			}),
			params = {
				StackName: argv.clusterName + 'Stack',
				Capabilities: [
					'CAPABILITY_IAM',
				],
				TemplateURL: uploadRes.Location
			};

		return rx
			.Observable
			.fromNodeCallback(cloudformation.createStack, cloudformation)(params);
	});
