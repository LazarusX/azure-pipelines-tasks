import * as tl from 'azure-pipelines-task-lib/task';
import { IExecOptions } from 'azure-pipelines-task-lib/toolrunner';
import * as fs from 'fs';
import * as path from 'path';
import * as stream from 'stream';
import { Constants } from './constant';
import { EchoStream } from './echostream';
import { Util } from './util';

export async function run() {
  const templateFilePath: string = tl.getPathInput('templateFilePath', true);
  tl.debug(`The template file path is ${templateFilePath}`);
  if (!fs.existsSync(templateFilePath)) {
    throw Error(tl.loc('TemplateFileInvalid', templateFilePath));
  }
  Util.setTaskRootPath(path.dirname(templateFilePath));

  Util.setupIotedgedev();

  const envList = {
    [Constants.iotedgedevEnv.deploymentFileOutputFolder]: tl.getVariable(Constants.outputFileFolder)
  };

  // Pass task variable to sub process
  const tlVariables = tl.getVariables();
  for (const v of tlVariables) {
    // The variables in VSTS build contains dot, need to convert to underscore.
    const name = v.name.replace('.', '_').toUpperCase();
    if (!envList[name]) {
      envList[name] = v.value;
    }
  }

  tl.debug(`Following variables will be passed to the iotedgedev command: ${JSON.stringify(envList)}`);

  const outputStream: EchoStream = new EchoStream();

  const execOptions: IExecOptions = {
    cwd: tl.cwd(),
    env: envList,
    outStream: outputStream as stream.Writable
  } as IExecOptions;
  const defaultPlatform = tl.getInput('defaultPlatform', true);
  const command = `build --file ${templateFilePath} --platform ${defaultPlatform}`;
  await tl.exec(`${Constants.iotedgedev}`, command, execOptions);

  const outLog: string = outputStream.content;
  const filterReg: RegExp = /Expanding '[^']*' to '([^']*)'/g;
  const matches: RegExpMatchArray = filterReg.exec(outLog);
  if (matches && matches[1]) {
    tl.setVariable(Constants.outputVariableDeploymentPathKey, matches[1]);
    tl.setVariable('_' + Constants.outputVariableDeploymentPathKey, matches[1]);
    tl.debug(`Set ${Constants.outputVariableDeploymentPathKey} to ${matches[1]}`);
  }
}
