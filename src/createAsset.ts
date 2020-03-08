import { ParameterDef, createParameter } from './createParameter';

export interface Asset {
  name: string;
  source: string | ((destinationDir: string) => Promise<string>);
  bucket: string;
  key: string;
  parameters: ParameterDef[];
}

export function createAsset(
  name: string,
  source: string | ((destinationDir: string) => Promise<string>),
): Asset {
  return {
    name,
    source,
    bucket: { Ref: name + 'Bucket' } as any,
    key: { Ref: name + 'Key' } as any,
    parameters: [
      createParameter(
        name + 'Bucket',
        'string',
        `The bucket containing the ${name} asset`,
      ),
      createParameter(
        name + 'Key',
        'string',
        `The S3 key for the ${name} asset`,
      ),
    ],
  };
}
