import { createAsset } from './createAsset';
import { ZipCallback, createZip } from './util/createZip';

export function createZipAsset(
  name: string,
  sourceOrCallback: string | ZipCallback,
) {
  return createAsset(name, destinationDir =>
    createZip(
      name,
      destinationDir,
      typeof sourceOrCallback === 'string'
        ? archive => {
            archive.directory(sourceOrCallback, false);
          }
        : sourceOrCallback,
    ),
  );
}
