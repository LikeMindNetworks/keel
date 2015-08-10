'use strict';

var
	_ = require('lodash'),
	through2 = require('through2'),
	fs = require('fs'),
	path = require('path'),
	config = require('config'),
	joi = require('joi');

var
	argvSchema = joi
		.object()
		.keys({
			'stack-name': joi.string().min(1).required()
		}),
	k8sConfig = config.get('kubernetes'),
	kubeRegConfig = config.get('kube-register');

var
	GET_MASTER_PRIVATE_IP_TMPLT = _.template(
		'{"Fn::GetAtt": ["${ STACK_NAME }MasterInstance" , "PrivateIp"]}'
	);

var
	getTemplateString = (templateName) => fs.readFileSync(
		path.join(__dirname, "../../../templates", templateName)
	),

	render = (argv, streamOut) => {
		let
			stackName = argv['stack-name'],

			// main cloud formation config object
			cf = JSON.parse(
				_.template(getTemplateString('cf.json'))(
					{
						STACK_NAME: stackName
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
						KUBE_REG_VERSION: kubeRegConfig.version
					}
				)
			};

		// User Data for the kubernete minimions
		cf
			.Resources[stackName + 'NodeLaunchConfig']
			.Properties
			.UserData = {
				'Fn::Base64': _(
					_
						.zip(
							k8NodeDataChunks.map(
								(chunk) => _.template(chunk)(
									{
										K8S_VERSION: k8sConfig.version,
										KUBE_REG_VERSION: kubeRegConfig.version
									}
								)
							),
							_
								.range(k8NodeDataChunks.length - 1)
								.map(
									() => getMasterPrivateIpObj
								)
						)
					)
					.flatten()
					.filter()
					.value()
			};

		// output the cf
		streamOut.write(JSON.stringify(cf, ' ', 2));
	};

module.exports = (argv, streamOut) => {
	joi.validate(
		argv,
		argvSchema,
		{
			allowUnknown: true
		},
		(err, value) => {
			if (err) {
				throw err;
			} else {
				render(value, streamOut);
			}
		}
	);
};
