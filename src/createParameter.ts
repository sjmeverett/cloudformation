export interface ParameterDef {
  name: string;
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
): ParameterDef {
  return {
    name,
    definition: {
      Type: type,
      Description: description,
      DefaultValue: defaultValue,
    },
    ref: { Ref: name },
  };
}
