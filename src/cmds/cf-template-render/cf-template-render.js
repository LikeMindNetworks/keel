'use strict';

var
	_ = require('lodash'),
	fs = require('fs'),
	path = require('path'),
	rx = require('rx'),
	AWS = require('aws-sdk');

var
	getTemplate = (templateName) => _.template(fs.readFileSync(
		path.join(__dirname, './templates', templateName)
	)),

	mkSubnet = (stackName, az, subnetIndex) => JSON.parse(
		getTemplate('./cf-subnet.json')(
			{
				stackName: stackName,
				cidrBlock: '200.0.' + (255 - subnetIndex) + '.0/24',
				availabilityZone: az
			}
		)
	),

	mkSubnetRTAssoc = (stackName, subnetName) => JSON.parse(
		getTemplate('./cf-subnet-rt-assoc.json')(
			{
				stackName: stackName,
				subnetName: subnetName
			}
		)
	);

exports.parseArgs = require('./args-parser');

exports.execute = (argv) => {
	AWS.config.credentials = new AWS.SharedIniFileCredentials({
		profile: argv.profile
	});

	AWS.config.region = argv.region;

	let ec2 = rx.Observable.fromNodeCallbackAll(new AWS.EC2());

	argv.ecsConfigS3Path = '/';
	argv.cidrBlock = '200.0.0.0/16';

	if (!argv.clusterMaxSize) {
		argv.clusterMaxSize = argv.clusterSize;
	}

	return ec2
		.describeAvailabilityZones()
		.pluck('AvailabilityZones')
		.concatMap(rx.Observable.from)
		.pluck('ZoneName')
		.toArray()
		.map((zones) => {
			let
				cfTmplt = JSON.parse(getTemplate('./cf-template.json')(argv)),

				subnetResources = _.reduce(
					zones,
					(res, z, idx) => {
						res[argv.stackName + 'Subnet' + idx] = mkSubnet(
							argv.stackName, z, idx
						);

						return res
					},
					{}
				),

				subnetRTAssocResources = _.reduce(
					_(subnetResources).keys().value(),
					(res, subnetName) => {
						res[subnetName + 'RTAssoc'] = mkSubnetRTAssoc(
							argv.stackName, subnetName
						);

						return res
					},
					{}
				),

				// attach subnet to resources
				resources
					= cfTmplt.Resources
					= _.assign(
						cfTmplt.Resources, subnetResources, subnetRTAssocResources
					),

				asgProps = resources['ASG'].Properties;

			// generate auto scaling settings
			asgProps.AvailabilityZones = zones;
			asgProps.VPCZoneIdentifier = _(subnetResources).keys()
				.map((key) => {
					return {
						"Ref": key
					};
				})
				.value();

			return cfTmplt;
		});
};