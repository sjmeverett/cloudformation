import { set } from 'lodash';

export function fromPairsDeep(pairs: [string, any][]): Record<string, any> {
  const result = {};

  pairs.forEach(([key, value]) => {
    set(result, key, value);
  });

  return result;
}
