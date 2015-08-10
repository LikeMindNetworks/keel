'use strict';

var
	fs = require('fs'),
	path = require('path'),
	config = require('config'),
	spawn = require('child_process').spawn,
	execSync = require('child_process').execSync;

var
	k8sConfig = config.get('kubernetes');

module.exports = () => {
	let
		binDir = path.join(__dirname, '../../../bin'),
		kubectlPath = path.join(binDir, 'kubectl');

	// simply hand off the kubectl
	if (!fs.existsSync(kubectlPath)) {
		execSync(
			'mkdir -p ' + binDir,
			{
				stdio: 'ignore'
			}
		);

		execSync(
			'wget -N -P ' + binDir + ' ' + k8sConfig.kubectlUrl,
			{
				stdio: 'ignore'
			}
		);

		execSync(
			'chmod +x ' + kubectlPath,
			{
				stdio: 'ignore'
			}
		);
	}
};
