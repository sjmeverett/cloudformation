import { Resource } from './createResource';
import { Parameter } from './createParameter';
import { Asset } from './createAsset';
import { flatMap } from 'lodash';
import { safeFromPairs } from './util/safeFromPairs';
import { Module } from './createModule';

export type StackComponent = Resource | Parameter | Asset | Module;

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

export function createStack(
  name: string,
  description: string,
  components: StackComponent[],
): Stack {
  components = flatMap(components, x =>
    x.type === 'module' ? x.components : x,
  );

  const assets = components.filter(x => x.type === 'asset') as Asset[];

  const parameters = [
    ...(components.filter(x => x.type === 'parameter') as Parameter[]),
    ...flatMap(assets, x => x.parameters),
  ];

  const resources = components.filter(x => x.type === 'resource') as Resource[];

  const stack = {
    AWSTemplateFormatVersion: '2010-09-09',
    Description: description || '',
    Resources: safeFromPairs(
      resources.map(resource => [resource.name, resource.definition]),
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
