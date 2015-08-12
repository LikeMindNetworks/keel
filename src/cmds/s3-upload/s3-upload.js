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
			describe: 'path to the file',
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
	.argv;

exports.execute = (argv) => {
	AWS.config.credentials = new AWS.SharedIniFileCredentials({
		profile: argv.profile
	});

	let
		s3 = rx.Observable.fromNodeCallbackAll(new AWS.S3()),
		rootBucket = _.head(argv.bucket.split(path.sep));

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
		.concatMap(
			(resp) => s3.upload({
				Bucket: argv.bucket,
				Key: path.basename(argv.file),
				Body: fs.createReadStream(argv.file)
			})
		);
};
