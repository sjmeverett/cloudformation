export interface Parameter {
  name: string;
  type: 'parameter';
  ref: any;
  definition: {
    Type: string;
    Description?: string;
    DefaultValue?: any;
  };
  value?: any;
}

export function createParameter(
  name: string,
  type = 'string',
  description = '',
  defaultValue?: any,
): Parameter {
  return {
    name,
    type: 'parameter',
    definition: {
      Type: type,
      Description: description,
      DefaultValue: defaultValue,
    },
    ref: { Ref: name },
  };
}
