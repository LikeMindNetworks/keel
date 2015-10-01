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

	mkSubnet = (clusterName, az, subnetIndex, cidrPrefix) => JSON.parse(
		getTemplate('./cf-subnet.json')(
			{
				clusterName: clusterName,
				cidrBlock: cidrPrefix + (255 - subnetIndex) + '.0/24',
				availabilityZone: az
			}
		)
	),

	mkSubnetRTAssoc = (clusterName, subnetName) => JSON.parse(
		getTemplate('./cf-subnet-rt-assoc.json')(
			{
				clusterName: clusterName,
				subnetName: subnetName
			}
		)
	);

exports.parseArgs = (yargs) => require('./args')(yargs)
	.option(
		'ecs-config-s3-path',
		{
			describe: 's3 path to the ecs config file',
			demand: true
		}
	)
	.argv;

exports.execute = (argv) => {
	AWS.config.credentials = new AWS.SharedIniFileCredentials({
		profile: argv.profile
	});

	let ec2 = rx.Observable.fromNodeCallbackAll(new AWS.EC2(
		{
			apiVersion: '2015-04-15',
			region: argv.region
		}
	));

	if (argv.cidrPrefix[argv.cidrPrefix.length - 1] !== '.') {
		argv.cidrPrefix += '.';
	}

	argv.cidrBlock = argv.cidrPrefix + '0.0/16';

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
						res[argv.clusterName + 'Subnet' + idx] = mkSubnet(
							argv.clusterName, z, idx, argv.cidrPrefix
						);

						return res
					},
					{}
				),

				subnetRTAssocResources = _.reduce(
					_(subnetResources).keys().value(),
					(res, subnetName) => {
						res[subnetName + 'RTAssoc'] = mkSubnetRTAssoc(
							argv.clusterName, subnetName
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
