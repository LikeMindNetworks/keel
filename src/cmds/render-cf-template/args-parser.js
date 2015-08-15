'use strict';

module.exports = (yargs) => yargs
	.option(
		'profile',
		{

			describe: 'aws profile',
			demand: false,
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
	.option(
		'cluster-name',
		{

			describe: 'name of the cluster',
			demand: true
		}
	)
	.option(
		'key-name',
		{

			describe: 'key pair name to be used for esc instance',
			demand: true
		}
	)
	.option(
		'ecs-ami-id',
		{

			describe: 'AMI ID of instances launched into the cluster',
			demand: false,
			default: 'ami-c5fa5aae'
		}
	)
	.option(
		'ecs-instance-type',
		{

			describe: 'instance type launched into the cluster',
			demand: false,
			default: 't2.micro'
		}
	)
	.option(
		'cluster-size',
		{

			describe: 'desired size of the cluster',
			demand: false,
			default: 2
		}
	)
	.argv;
