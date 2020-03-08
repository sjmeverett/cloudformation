import { map, flattenDeep, flatMap } from 'lodash';
import { writeFileSync } from 'fs';
import { fromPairsDeep } from './util/fromPairsDeep';

function generateTypes(spec: any) {
  return flattenDeep<any>([
    `import { createResource, resources } from './resources';`,
    '',
    // interfaces for all the property types
    getInterfaces(spec.PropertyTypes, 'The `%` property type'),
    // interfaces for all the resource properties
    getInterfaces(
      spec.ResourceTypes,
      'Properties for the `%` resource type',
      spec.PropertyTypes,
      'Properties',
    ),
    // interfaces for all the resource attributes
    getInterfaces(
      spec.ResourceTypes,
      'Attributes (outputs) for the `%` resource type',
      spec.PropertyTypes,
      'Attributes',
      'Attributes',
    ),
    // save a description of each resource
    map(spec.ResourceTypes, (spec, type) => {
      return [
        `resources["${type}"] = ${JSON.stringify(
          {
            properties: Object.keys(spec.Properties || {}),
            attributes: Object.keys(spec.Attributes || {}),
          },
          null,
          2,
        )} as any;`,
        ``,
      ];
    }),
    // merge the ResourceTypes interface declaration with all the resource types
    `declare module './resources' {`,
    `  export interface ResourceDefinitions {`,
    map(spec.ResourceTypes, (_, type) => {
      const sanitisedName = sanitiseName(type);
      return `  "${type}": ResourceTypeDef<${sanitisedName}Properties, ${sanitisedName}Attributes>;`;
    }),
    `  }`,
    `}`,
    ``,
    // "create" functions for every resource type
    map(spec.ResourceTypes, (resourceSpec, type) => {
      const sanitisedName = sanitiseName(type);
      return [
        `/**`,
        ` * Creates a \`${type}\` resource`,
        ` * ` +
          (resourceSpec.Documentation
            ? `@see ${resourceSpec.Documentation}`
            : ''),
        ` */`,
        `export function create${sanitisedName}(name: string, properties: ${sanitisedName}Properties) {`,
        `  return createResource("${type}", name, properties);`,
        `}`,
        ``,
      ];
    }),
    // export the other non-generated code
    `export * from './resources';`,
  ]).join('\n');
}

function getInterfaces(
  specs: any,
  docTemplate: string,
  propertyTypes = specs,
  suffix = '',
  key = 'Properties',
) {
  return map(specs, (resourceSpec, resourceName) => {
    return [
      `/**`,
      ` * ${docTemplate.replace('%', resourceName)}`,
      ` * ` +
        (resourceSpec.Documentation
          ? `@see ${resourceSpec.Documentation}`
          : ''),
      ` */`,
      `export interface ${sanitiseName(resourceName)}${suffix} {`,
      mapToInterface(resourceSpec[key], (propertySpec, propertyName) => {
        return [
          propertyName + (propertySpec.Required === false ? '?' : ''),
          getType(propertySpec, propertyTypes, getNamespace(resourceName)),
        ];
      }),
      '}',
      '',
    ];
  });
}

function mapToInterface(
  spec: Record<string, any>,
  mapFn: (spec: any, name: string) => [string, string],
) {
  const result = fromPairsDeep(map(spec, mapFn));
  return objToInterface(result);
}

function objToInterface(spec: any): string[] {
  return flatMap(spec, (type, name) => {
    if (typeof type === 'string') {
      return `  ${name}: ${type};`;
    } else {
      return [
        `  ${name}: {`,
        ...objToInterface(type).map((line: string) => '  ' + line),
        `  };`,
      ];
    }
  });
}

function getNamespace(name: string) {
  const index = name.lastIndexOf('.');
  return index > -1 ? name.substring(0, index) : name;
}

function sanitiseName(name: string) {
  if (name.startsWith('AWS::')) {
    name = name.substring('AWS::'.length);
  }
  return name.replace(/[:.]/g, '');
}

function getType(spec: any, propertyTypes: any, namespace: string) {
  if (spec.Type === 'List') {
    return (
      getSpecificType(
        spec.PrimitiveItemType,
        spec.ItemType,
        propertyTypes,
        namespace,
      ) + '[]'
    );
  } else if (spec.Type === 'Map') {
    const type = getSpecificType(
      spec.PrimitiveItemType,
      spec.ItemType,
      propertyTypes,
      namespace,
    );
    return `Record<string, ${type}>`;
  } else {
    return getSpecificType(
      spec.PrimitiveType,
      spec.Type,
      propertyTypes,
      namespace,
    );
  }
}

function getSpecificType(
  primitive: string,
  type: string,
  propertyTypes: any,
  namespace: string,
) {
  if (primitive) {
    switch (primitive) {
      case 'Boolean':
        return 'boolean';
      case 'Double':
      case 'Integer':
      case 'Long':
        return 'number';
      case 'Json':
        return 'object';
      case 'Timestamp':
      case 'String':
        return 'string';
      default:
        throw new Error(`Unknown primitive type ${primitive}`);
    }
  } else {
    if (namespace && propertyTypes[`${namespace}.${type}`]) {
      return sanitiseName(`${namespace}.${type}`);
    } else if (propertyTypes[type]) {
      return sanitiseName(type);
    } else {
      return `unknown /* (${namespace}) ${type} */`;
    }
  }
}

const out = generateTypes(require('./spec.json'));
writeFileSync('src/generated.ts', out);
