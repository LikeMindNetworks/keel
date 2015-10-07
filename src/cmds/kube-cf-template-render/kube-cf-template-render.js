'use strict';

var
	debug = require('debug')('keel:kube-cf-template-render'),
	_ = require('lodash'),
	fs = require('fs'),
	path = require('path'),
	rx = require('rx'),
	AWS = require('aws-sdk');

var
	getTemplateFile = (fileName) => fs.readFileSync(
		path.join(__dirname, './templates', fileName)
	),

	getTemplate = (templateName) => _.template(getTemplateFile(templateName)),

	mkSubnet = (clusterName, az, subnetIndex, cidrPrefix) => JSON.parse(
		getTemplate('subnet.json')(
			{
				clusterName: clusterName,
				cidrBlock: cidrPrefix + (subnetIndex << 4) + '.0/20',
				availabilityZone: az
			}
		)
	),

	mkSubnetRTAssoc = (clusterName, subnetName) => JSON.parse(
		getTemplate('subnet-rt-assoc.json')(
			{
				clusterName: clusterName,
				subnetName: subnetName
			}
		)
	);

exports.parseArgs = (yargs) => require('./args')(yargs).argv;

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
				cfTmplt = JSON.parse(getTemplate('template.json')(argv)),

				masterYamlTmplt = getTemplateFile('master.yaml').toString(),
				nodeYamlTmplt = getTemplateFile('node.yaml').toString(),

				subnetResources = _.reduce(
					zones,
					(res, z, idx) => {
						res[argv.clusterName + 'Subnet' + idx] = mkSubnet(
							argv.clusterName, z, idx, argv.cidrPrefix
						);

						debug(
							'rendering template subnet %j',
							res[argv.clusterName + 'Subnet' + idx]
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

						debug(
							'rendering template subnet %j',
							res[subnetName + 'RTAssoc']
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

			// insert user data for master
			cfTmplt
				.Resources[argv.clusterName + 'MasterInstance']
				.Properties
				.UserData = {
					'Fn::Base64': masterYamlTmplt
				};

			// insert user data for nodes
			cfTmplt.Resources.InstanceLC.Properties.UserData = {
				'Fn::Base64': nodeYamlTmplt
			};

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
