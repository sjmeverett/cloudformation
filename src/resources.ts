import { fromPairsDeep } from './util/fromPairsDeep';

export interface ResourceDefinitions {}

export interface ResourceTypeDef<Properties, Attributes> {
  properties: string[];
  attributes: string[];
}

export const resources: ResourceDefinitions = {} as any;

export type ResourceType = keyof ResourceDefinitions;

export interface Resource<Type extends ResourceType> {
  readonly name: string;
  readonly ref: any;
  readonly attributes: Readonly<ResourceAttributes<Type>>;

  definition: {
    readonly Type: Type;
    Properties: ResourceProperties<Type>;
  };
}

export type ResourceProperties<
  Type extends ResourceType
> = ResourceDefinitions[Type] extends ResourceTypeDef<infer Properties, any>
  ? Properties
  : never;

export type ResourceAttributes<
  Type extends ResourceType
> = ResourceDefinitions[Type] extends ResourceTypeDef<any, infer Attributes>
  ? Attributes
  : never;

export function createResource<Type extends ResourceType>(
  type: Type,
  name: string,
  properties: ResourceProperties<Type>,
): Resource<Type> {
  return {
    name,
    definition: {
      Type: type,
      Properties: properties,
    },
    ref: { Ref: name },
    attributes: fromPairsDeep(
      (resources[type] as any).attributes.map((attribute: any) => [
        attribute,
        { 'Fn::GetAtt': [name, attribute] },
      ]),
    ) as any,
  };
}
