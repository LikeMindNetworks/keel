'use strict';

var
	_ = require('lodash'),
	path = require('path'),
	fs = require('fs'),
	AWS = require('aws-sdk'),
	rx = require('rx');

exports.parseArgs = (yargs) => yargs
	.option(
		'bucket',
		{
			describe: 's3 bucket path',
			demand: true
		}
	)
	.option(
		'file',
		{
			describe: 'path to the file to be uploaded. This will overwrite --data'
		}
	)
	.option(
		'data',
		{
			describe: 'data to be uploaded'
		}
	)
	.implies('data', 'key')
	.option(
		'profile',
		{
			describe: 'profile for aws',
			default: 'default'
		}
	)
	.option(
		'encryption',
		{
			describe: 'server side encryption mechanism',
			choices: ['aes', 'kms']
		}
	)
	.argv;

exports.execute = (argv) => {
	AWS.config.credentials = new AWS.SharedIniFileCredentials({
		profile: argv.profile
	});

	if (!argv.file && !argv.data) {
		throw new Error('Must supply either file or data to upload');
	}

	let
		s3 = rx.Observable.fromNodeCallbackAll(new AWS.S3(
			{
				apiVersion: '2006-03-01'
			}
		)),

		rootBucket = _.head(argv.bucket.split(path.sep)),

		uploadParam = {
			Bucket: argv.bucket,
			Key: argv.file ? path.basename(argv.file) : argv.key,
			Body: argv.file ? fs.createReadStream(argv.file) : argv.data
		};

	switch (argv.encryption) {
		case 'aes':
			uploadParam.ServerSideEncryption = 'AES256';
			break;
		case 'kms':
			uploadParam.ServerSideEncryption = 'aws:kms';
			break;
	}

	return rx
		.Observable
		.catch(
			s3.headBucket({
				Bucket: rootBucket
			}),
			s3.createBucket({
				Bucket: rootBucket
			})
		)
		.concatMap(() => s3.upload(uploadParam));
};
