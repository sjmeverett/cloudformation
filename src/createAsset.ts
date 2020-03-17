import { Parameter, createParameter } from './createParameter';

export interface Asset {
  name: string;
  type: 'asset';
  source: string | ((destinationDir: string) => Promise<string>);
  bucket: string;
  key: string;
  parameters: Parameter[];
}

export function createAsset(
  name: string,
  source: string | ((destinationDir: string) => Promise<string>),
): Asset {
  return {
    name,
    type: 'asset',
    source,
    bucket: { Ref: name + 'Bucket' } as any,
    key: { Ref: name + 'Key' } as any,
    parameters: [
      createParameter(
        name + 'Bucket',
        'String',
        `The bucket containing the ${name} asset`,
      ),
      createParameter(
        name + 'Key',
        'String',
        `The S3 key for the ${name} asset`,
      ),
    ],
  };
}
