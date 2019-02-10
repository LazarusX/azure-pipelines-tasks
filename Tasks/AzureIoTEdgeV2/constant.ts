import { IExecSyncOptions } from 'azure-pipelines-task-lib/toolrunner';

export class Constants {
  public static exceptStr: string[] = ['$edgeHub', '$edgeAgent', '$upstream'];
  public static fileNameDeploymentJson: string = 'deployment.json';
  public static fileNameModuleJson: string = 'module.json';
  public static fileNameDockerCredential: string = 'VSTS_EXTENSION_EDGE_DOCKER_CREDENTIAL';
  public static folderNameModules: string = 'modules';
  public static folderNameConfig: string = 'config';
  public static iotedgedev: string = 'iotedgedev';
  public static iotedgedevLockVersionKey: string = 'IOTEDGEDEV_VERSION';
  public static iotedgedevDefaultVersion: string = '1.1.0';
  public static iotedgedevEnv: any = {
    registryServer: 'CONTAINER_REGISTRY_SERVER',
    registryUsername: 'CONTAINER_REGISTRY_USERNAME',
    registryPassword: 'CONTAINER_REGISTRY_PASSWORD',
    bypassModules: 'BYPASS_MODULES',
    deploymentFileOutputPath: 'DEPLOYMENT_CONFIG_FILE',
    deploymentFileOutputFolder: 'CONFIG_OUTPUT_DIR'
  };
  public static outputFileFolder: string = 'Build.ArtifactStagingDirectory';
  public static osTypeLinux: string = 'Linux';
  public static osTypeWindows: string = 'Windows_NT';
  public static osTypeMac: string = 'Darwin';
  public static defaultDockerHubHostname: string = 'docker.io';
  public static variableKeyDisableTelemetry: string = 'DISABLE_TELEMETRY';
  public static execSyncSilentOption: IExecSyncOptions = { silent: true } as IExecSyncOptions;
  public static UTF8: string = 'utf8';
  public static outputVariableDeploymentPathKey: string = 'DEPLOYMENT_FILE_PATH';
}
