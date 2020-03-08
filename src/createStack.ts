import { Resource } from './resources';
import { ParameterDef } from './createParameter';
import { Asset } from './createAsset';
import { flatMap } from 'lodash';
import { safeFromPairs } from './util/safeFromPairs';

export interface StackOptions {
  resources: Resource<any>[];
  parameters?: ParameterDef[];
  assets?: Asset[];
  description?: string;
}

export interface Stack {
  name: string;
  definition: {
    AWSTemplateFormatVersion: string;
    Description: string;
    Resources: Record<string, any>;
    Parameters: Record<
      string,
      { Type: string; Description: String; DefaultValue?: any }
    >;
  };
  assets: Asset[];
}

export function createStack(name: string, options: StackOptions): Stack {
  const assets = options.assets || [];

  const parameters = [
    ...(options.parameters || []),
    ...flatMap(assets, x => x.parameters),
  ];

  const stack = {
    AWSTemplateFormatVersion: '2010-09-09',
    Description: options.description || '',
    Resources: safeFromPairs(
      options.resources.map(resource => [resource.name, resource.definition]),
    ),
    Parameters: safeFromPairs(
      parameters.map(param => [param.name, param.definition]),
    ),
  };

  return {
    name,
    assets,
    definition: stack,
  };
}
