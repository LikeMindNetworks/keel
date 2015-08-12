'use strict';

var
	_ = require('lodash'),
	fs = require('fs'),
	path = require('path'),
	rx = require('rx'),
	config = require('config');

var
	k8sConfig = config.get('kubernetes'),
	kubeRegConfig = config.get('kube-register');

var
	GET_MASTER_PRIVATE_IP_TMPLT = _.template(
		'{"Fn::GetAtt": ["${ STACK_NAME }MasterInstance" , "PrivateIp"]}'
	);

var
	getTemplateString = (templateName) => fs.readFileSync(
		path.join(__dirname, './templates', templateName)
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
		'k8s-port',
		{

			describe: 'port of the kubernetes server',
			demand: false,
			default: 8080
		}
	)
	.argv;

exports.execute = (argv) => rx.Observable.create((observer) => {
	let
		stackName = argv.stackName,
		k8sPort = argv.k8sPort,

		// main cloud formation config object
		cf = JSON.parse(
			_.template(getTemplateString('cf.json'))(
				{
					STACK_NAME: stackName,
					K8S_PORT: k8sPort
				}
			)
		),

		// generate the object:
		// 	{"Fn::GetAtt": ["MasterInstance", "PrivateIp"] }
		getMasterPrivateIpObj = JSON.parse(
			GET_MASTER_PRIVATE_IP_TMPLT({
				STACK_NAME: stackName
			})
		),

		k8NodeDataChunks = getTemplateString('k8s-node-user-data.yml')
			.toString()
			.split('${ GET_MASTER_PRIVATE_IP }');

	// User Data for the kubernete master
	cf
		.Resources[stackName + 'MasterInstance']
		.Properties
		.UserData = {
			'Fn::Base64': _.template(
				getTemplateString('k8s-master-user-data.yml')
			)(
				{
					K8S_VERSION: k8sConfig.version,
					KUBE_REG_VERSION: kubeRegConfig.version,
					K8S_PORT: k8sPort
				}
			)
		};

	// User Data for the kubernete minimions
	cf
		.Resources[stackName + 'NodeLaunchConfig']
		.Properties
		.UserData = {
			'Fn::Base64': {
				"Fn::Join": [
					'',
					_(
						_.zip(
							k8NodeDataChunks.map(
								(chunk) => _.template(chunk)(
									{
										K8S_VERSION: k8sConfig.version,
										KUBE_REG_VERSION: kubeRegConfig.version,
										K8S_PORT: k8sPort
									}
								)
							),
							_.range(k8NodeDataChunks.length - 1).map(
								() => getMasterPrivateIpObj
							)
						)
					)
					.flatten()
					.filter()
					.value()
				]
			}
		};

	// output the cf
	observer.onNext(JSON.stringify(cf, ' ', 2));

	observer.onCompleted();
});
