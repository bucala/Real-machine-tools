import { serializeMachineModel } from './machineModelFormats';
self.onmessage = async ({ data }) => {
  try {
    self.postMessage({ blob: await serializeMachineModel(data) });
  } catch (error) {
    self.postMessage({ error: error.message || 'Model export failed.' });
  }
};
