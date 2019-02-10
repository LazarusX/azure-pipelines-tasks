import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Constants } from './constant';
import { TelemetryEvent } from './telemetry';
import { Util } from './util';

class AzureCliTask {
  private static isLoggedIn: boolean = false;
  public static checkIfAzurePythonSdkIsInstalled() {
    return !!tl.which('az', false);
  }

  public static async runMain(deploymentJson: any, telemetryEvent: TelemetryEvent) {
    let toolExecutionError = null;
    try {
      const iothub: string = tl.getInput('iothubname', true);
      let configId: string = tl.getInput('deploymentid', true);
      const priorityInput: string = tl.getInput('priority', true);
      const deviceOption: string = tl.getInput('deviceOption', true);
      let targetCondition: string;

      if (deviceOption === 'Single Device') {
        const deviceId: string = tl.getInput('deviceId', true);
        targetCondition = `deviceId='${deviceId}'`;
      } else {
        targetCondition = tl.getInput('targetcondition', true);
      }

      const deploymentJsonPath: string = path.resolve(os.tmpdir(), `deployment_${new Date().getTime()}.json`);
      fs.writeFileSync(deploymentJsonPath, JSON.stringify({ content: deploymentJson }, null, 2));

      let priority: number = parseInt(priorityInput);
      priority = isNaN(priority) ? 0 : priority;

      configId = Util.normalizeDeploymentId(configId);
      console.log(tl.loc('NomralizedDeployementId', configId));

      const script1 = `iot edge deployment delete --hub-name ${iothub} --config-id ${configId}`;
      const script2 = `iot edge deployment create --config-id ${configId} --hub-name ${iothub} --content ${deploymentJsonPath} --target-condition ${targetCondition} --priority ${priority}`;

      this.loginAzure();

      tl.debug('OS release:' + os.release());

      // WORK AROUND
      // In Linux environment, sometimes when install az extension, libffi.so.5 file is missing. Here is a quick fix.
      const addResult = tl.execSync('az', 'extension add --name azure-cli-iot-ext --debug', Constants.execSyncSilentOption);
      tl.debug(JSON.stringify(addResult));
      if (addResult.code === 1) {
        if (addResult.stderr.includes('ImportError: libffi.so.5')) {
          const azRepo = tl.execSync('lsb_release', '-cs', Constants.execSyncSilentOption).stdout.trim();
          console.log(`\n--------------------Error--------------------.\n Something wrong with built-in Azure CLI in agent, can't install az-cli-iot-ext.\nTry to fix with reinstall the ${azRepo} version of Azure CLI.\n\n`);
          tl.debug(JSON.stringify(tl.execSync('sudo', 'rm /etc/apt/sources.list.d/azure-cli.list', Constants.execSyncSilentOption)));
          // fs.writeFileSync('sudo', `/etc/apt/sources.list.d/azure-cli.list deb [arch=amd64] https://packages.microsoft.com/repos/azure-cli/ ${azRepo} main`, Constants.execSyncSilentOption));
          tl.debug(JSON.stringify(tl.execSync('sudo', 'cat /etc/apt/sources.list.d/azure-cli.list', Constants.execSyncSilentOption)));
          tl.debug(JSON.stringify(tl.execSync('sudo', 'apt-key adv --keyserver packages.microsoft.com --recv-keys 52E16F86FEE04B979B07E28DB02C46DF417A0893', Constants.execSyncSilentOption)));
          tl.debug(JSON.stringify(tl.execSync('sudo', 'apt-get install apt-transport-https', Constants.execSyncSilentOption)));
          tl.debug(JSON.stringify(tl.execSync('sudo', 'apt-get update', Constants.execSyncSilentOption)));
          tl.debug(JSON.stringify(tl.execSync('sudo', 'apt-get --assume-yes remove azure-cli', Constants.execSyncSilentOption)));
          tl.debug(JSON.stringify(tl.execSync('sudo', 'apt-get --assume-yes install azure-cli', Constants.execSyncSilentOption)));
          const r = tl.execSync('az', 'extension add --name azure-cli-iot-ext --debug', Constants.execSyncSilentOption);
          tl.debug(JSON.stringify(r));
          if (r.code === 1) {
            throw new Error(r.stderr);
          }
        } else if (addResult.stderr.includes('The extension azure-cli-iot-ext already exists')) {
          // The job contains multiple deploy tasks
          // do nothing
        } else {
          throw new Error(addResult.stderr);
        }
      }

      try {
        const iotHubInfo = JSON.parse(tl.execSync('az', `iot hub show -n ${iothub}`, Constants.execSyncSilentOption).stdout);
        tl.debug(`The host name of iot hub is ${iotHubInfo.properties.hostName}`);
        telemetryEvent.iotHubHostNameHash = Util.sha256(iotHubInfo.properties.hostName);
        const reg = new RegExp(iothub + '\.(.*)');
        const m = reg.exec(iotHubInfo.properties.hostName);
        if (m && m[1]) {
          telemetryEvent.iotHubDomain = m[1];
        }
      } catch (e) {
        // If error when get iot hub information, ignore.
      }

      const result1 = tl.execSync('az', script1, Constants.execSyncSilentOption);
      const result2 = await tl.exec('az', script2);
      if (result2 !== 0) {
        throw new Error(`Error for deployment`);
      }
    } catch (err) {
      if (err.stderr) {
        toolExecutionError = err.stderr;
      } else {
        toolExecutionError = err;
      }

      throw new Error(toolExecutionError);
    }
    finally {
      //Logout of Azure if logged in
      if (this.isLoggedIn) {
        this.logoutAzure();
      }
    }
  }

  public static loginAzure() {
    const connectedService: string = tl.getInput('connectedServiceNameARM', true);
    this.loginAzureRM(connectedService);
  }

  public static loginAzureRM(connectedService: string) {
    const servicePrincipalId = tl.getEndpointAuthorizationParameter(connectedService, 'serviceprincipalid', false);
    const servicePrincipalKey = tl.getEndpointAuthorizationParameter(connectedService, 'serviceprincipalkey', false);
    const tenantId = tl.getEndpointAuthorizationParameter(connectedService, 'tenantid', false);
    const subscriptionName = tl.getEndpointDataParameter(connectedService, 'SubscriptionName', true);
    const environment = tl.getEndpointDataParameter(connectedService, 'environment', true);
    // Work around for build agent az command will exit with non-zero code since configuration files are missing.
    tl.debug(tl.execSync('az', '--version', Constants.execSyncSilentOption).stdout);

    // Set environment if it is not AzureCloud (global Azure)
    if (environment && environment !== 'AzureCloud') {
      const result = tl.execSync('az', `cloud set --name ${environment}`, Constants.execSyncSilentOption);
      tl.debug(JSON.stringify(result));
    }

    //login using svn
    let result = tl.execSync('az', 'login --service-principal -u "' + servicePrincipalId + '" -p "' + servicePrincipalKey + '" --tenant "' + tenantId + '"', Constants.execSyncSilentOption);
    tl.debug(JSON.stringify(result));
    this.throwIfError(result);
    this.isLoggedIn = true;
    //set the subscription imported to the current subscription
    result = tl.execSync('az', 'account set --subscription "' + subscriptionName + '"', Constants.execSyncSilentOption);
    tl.debug(JSON.stringify(result));
    this.throwIfError(result);
  }

  public static logoutAzure() {
    try {
      tl.debug(tl.execSync('az', ' account clear', Constants.execSyncSilentOption).stdout);
    } catch (err) {
      // task should not fail if logout doesn`t occur
      tl.warning(tl.loc('FailedToLogout'));
    }
  }

  public static throwIfError(resultOfToolExecution) {
    if (resultOfToolExecution.stderr) {
      throw resultOfToolExecution;
    }
  }
}

export async function run(telemetryEvent: TelemetryEvent) {
  const inBuildPipeline: boolean = Util.checkSelfInBuildPipeline();
  console.log(tl.loc('DeployTaskRunningInBuild', inBuildPipeline));
  const deploymentFilePath: string = tl.getPathInput('deploymentFilePath', true);

  // Find the deployment.json file
  const findPaths: string[] = Util.findFiles(deploymentFilePath);
  tl.debug(`Found ${findPaths.length} result for deployment file: ${deploymentFilePath}`);
  if (!findPaths || findPaths.length === 0) {
    throw new Error(tl.loc('DeploymentFileNotFound'));
  }

  for (const path of findPaths) {
    console.log(path);
  }

  let deploymentJson: any = null;
  for (const path of findPaths) {
    console.log(tl.loc('CheckValidJson', path));
    try {
      deploymentJson = JSON.parse(fs.readFileSync(path, Constants.UTF8));
    } catch (e) {
      console.log(tl.loc('Invalid'));
      continue;
    }
    console.log(tl.loc('Valid'));
    break;
  }

  if (deploymentJson == null) {
    throw new Error(tl.loc('ValidDeploymentFileNotFound'));
  }

  if (!AzureCliTask.checkIfAzurePythonSdkIsInstalled()) {
    throw new Error(tl.loc('AzureSdkNotFound'));
  }
  await AzureCliTask.runMain(deploymentJson, telemetryEvent);
}
