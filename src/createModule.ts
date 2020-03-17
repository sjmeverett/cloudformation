import { StackComponent } from './createStack';

export interface Module<T = {}> {
  name: string;
  type: 'module';
  components: StackComponent[];
  attributes: T;
}

export function createModule<T = {}>(
  name: string,
  components: StackComponent[],
  attributes: T,
) {
  return {
    name,
    type: 'module',
    components,
    attributes,
  } as Module<T>;
}
