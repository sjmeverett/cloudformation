import { createCloudFormationCustomResource } from './generated';
import { StackComponent } from './createStack';
import { BaseResource } from './createResource';
import { fromPairsDeep } from './util/fromPairsDeep';

export function createCustomResource<TProperties, TAttributes = {}>(
  serviceToken: string,
  components: StackComponent[],
  attributes: (keyof TAttributes)[] = [],
) {
  return (
    name: string,
    options: TProperties,
  ): BaseResource<
    'AWS::CustomResource',
    TProperties & { ServiceToken: string },
    TAttributes
  > => {
    const resource = createCloudFormationCustomResource(name, {
      ServiceToken: serviceToken,
      ...options,
    });

    return {
      ...resource,
      sharedComponents: components,
      attributes: fromPairsDeep(
        attributes.map((attribute: any) => [
          attribute,
          { 'Fn::GetAtt': [name, attribute] },
        ]),
      ),
    } as any;
  };
}
