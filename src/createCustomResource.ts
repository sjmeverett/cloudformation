import { createCloudFormationCustomResource } from './generated';
import { StackComponent } from './createStack';

export function createCustomResource<T>(
  serviceToken: string,
  components: StackComponent[],
) {
  return (name: string, options: T) => {
    const resource = createCloudFormationCustomResource(name, {
      ServiceToken: serviceToken,
      ...options,
    });

    resource.sharedComponents = components;
    return resource;
  };
}
