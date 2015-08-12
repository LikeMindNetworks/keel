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
	cmdRenderCFTmplt = require(
		'../../cmds/render-cf-template/render-cf-template'
	),
	cmdS3Upload = require(
		'../../cmds/s3-upload/s3-upload'
	);

exports.parseArgs = (yargs) => yargs
	.option(
		'stack-name',
		{
			describe: 'name of the kubernetes stack',
			demand: true
		}
	)
	.option(
		'subnet-az',
		{
			describe: 'subnet availability zone for the VPC of the stack',
			demand: true
		}
	)
	.option(
		'key-pair',
		{
			describe: 'key pair used to connect to aws',
			demand: true
		}
	)
	.option(
		'profile',
		{
			describe: 'profile for aws',
			default: 'default'
		}
	)
	.option(
		'k8s-port',
		{
			describe: 'port of the kubernetes server',
			default: 8080
		}
	)
	.option(
		'cluster-size',
		{
			describe: 'number of minion nodes in the kubernetes stack',
			default: 2
		}
	)
	.option(
		'instance-type',
		{
			describe: 'instance type to be launched into the stack',
			default: 't2.micro'
		}
	)
	.argv;

exports.execute = (argv) => rx
	.Observable
	.zip(
		// render template
		cmdRenderCFTmplt.execute(argv),

		// open temporary file
		rx.Observable.fromNodeCallback(temp.open)('keel-create-stack-cf'),

		(cfTemplate, tempFileInfo) => {

			// write to a temporary file
			fs.writeFileSync(tempFileInfo.path, cfTemplate);

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

		AWS.config.region = argv.subnetAz.substring(
			0, argv.subnetAz.length - 1
		);

		let
			cloudformation = new AWS.CloudFormation(),
			params = {
				StackName: argv['stack-name'],
				Capabilities: [
					'CAPABILITY_IAM',
				],
				Parameters: [
					{
						ParameterKey: 'KeyPair',
						ParameterValue: argv.keyPair
					},
					{
						ParameterKey: 'ClusterSize',
						ParameterValue: argv.clusterSize + ''
					},
					{
						ParameterKey: 'SubnetAZ',
						ParameterValue: argv.subnetAz
					}
				],
				TemplateURL: uploadRes.Location
			};

		return rx
			.Observable
			.fromNodeCallback(cloudformation.createStack, cloudformation)(params);
	});
