import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import * as commonTelemetry from 'utility-common/telemetry';
import * as BuildImage from './buildimage';
import { Constants } from './constant';
import * as DeployImage from './deployimage';
import * as PushImage from './pushimage';
import { TelemetryEvent, traceEvent } from './telemetry';
import { Util } from './util';

tl.setResourcePath(path.join(__dirname, 'task.json'));

Util.debugOsType();

const startTime: Date = new Date();

const action: string = tl.getInput('action', true);

const telemetryEvent = {
  hashTeamProjectId: Util.sha256(tl.getVariable('system.teamProjectId')),
  taskType: action,
  osType: tl.osType(),
  buildId: tl.getVariable('build.buildId'),
  isSuccess: null,
  taskTime: null,
  serverType: tl.getVariable('System.ServerType')
} as TelemetryEvent;

let telemetryEnabled = (tl.getVariable(Constants.variableKeyDisableTelemetry) !== 'true');
if (!Util.checkSelfInHostedServer()) {
  telemetryEnabled = false;
}

async function run() {
  try {
    if (action === 'Build module images') {
      console.log(tl.loc('BuildingModules'));
      await BuildImage.run();
      console.log(tl.loc('BuildingModulesFinished'));
    } else if (action === 'Push module images') {
      console.log(tl.loc('PushingModules'));
      telemetryEvent.isACR = tl.getInput('containerregistrytype', true) === 'Azure Container Registry';
      await PushImage.run();
      console.log(tl.loc('PushingModulesFinished'));
    } else if (action === 'Deploy to IoT Edge devices') {
      console.log(tl.loc('StartDeploy'));
      telemetryEvent.hashIoTHub = Util.sha256(tl.getInput('iothubname', true));
      await DeployImage.run(telemetryEvent);
      console.log(tl.loc('FinishDeploy'));
    }
    telemetryEvent.isSuccess = true;
    tl.setResult(tl.TaskResult.Succeeded, '');
  } catch (e) {
    telemetryEvent.isSuccess = false;
    tl.setResult(tl.TaskResult.Failed, e);
  } finally {
    telemetryEvent.taskTime = (+new Date() - (+startTime)) / 1000;
    if (telemetryEnabled) {
      traceEvent(action, telemetryEvent);
    }
    commonTelemetry.emitTelemetry('TaskEndpointId', 'AzureIoTEdgeV2', telemetryEvent);
  }
}

run();
