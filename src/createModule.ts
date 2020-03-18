import { StackComponent } from './createStack';

export interface Module<
  TComponents extends Record<string, StackComponent> = {},
  TAttributes extends Record<string, any> = {}
> {
  name: string;
  type: 'module';
  components: TComponents;
  attributes: TAttributes;
}

export function createModule<
  TComponents extends Record<string, StackComponent> = {},
  TAttributes extends Record<string, any> = {}
>(name: string, components: TComponents, attributes: TAttributes) {
  return {
    name,
    type: 'module',
    components,
    attributes,
  } as Module<TComponents, TAttributes>;
}
