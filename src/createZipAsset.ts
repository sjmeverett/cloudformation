import { createAsset } from './createAsset';
import { zipFolder } from './util/zipFolder';

export function createZipAsset(name: string, sourcePath: string) {
  return createAsset(name, destinationDir =>
    zipFolder(name, sourcePath, destinationDir),
  );
}
