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
  components = flattenModules(components);
  const sharedComponents = new Set<StackComponent>();

  components.forEach(component => {
    if (component.type === 'resource' && component.sharedComponents) {
      component.sharedComponents.forEach(component =>
        sharedComponents.add(component),
      );
    }
  });

  components.push(...sharedComponents.values());

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

function flattenModules(components: StackComponent[]): StackComponent[] {
  return flatMap(components, component => {
    return component.type === 'module'
      ? flattenModules(Object.values(component.components))
      : component;
  });
}
