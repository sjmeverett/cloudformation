import {
  IAMRolePolicy,
  createIAMRole,
  createLambdaFunction,
  LambdaFunctionVpcConfig,
} from './generated';
import { createModule } from './createModule';
import { createZipAsset } from './createZipAsset';
import { getPackagePaths } from './util/getPackagePaths';
import { fnSub } from './fnSub';
import { statSync } from 'fs';
import { basename, join } from 'path';

export interface StandardLambdaOptions {
  /**
   * The folder/file containing the source code for the lambda
   */
  Source: string;
  /**
   * The lambda handler (path/to/file.exportedFunction)
   */
  Handler: string;
  /**
   * The runtime to use, e.g. 'nodejs10.x'
   */
  Runtime: string;
  /**
   * Extra polices to attach to the Lambda role
   */
  Policies?: IAMRolePolicy[];
  /**
   * Key/value pairs representing environment variables to pass to Lambda function
   */
  Environment?: Record<string, string>;
  /**
   * Optional node modules to include in the zip (along with their dependencies)
   */
  NodeModules?: string[];
  /**
   * Optional map of package path to replacement source path.
   */
  DistributionExtras?: Record<string, string>;
  /**
   * Timeout in seconds
   */
  Timeout?: number;
  /**
   * Optional VPC config
   */
  VpcConfig?: LambdaFunctionVpcConfig;
}

export function createStandardLambda(
  name: string,
  options: StandardLambdaOptions,
) {
  // create the execution role
  const role = createIAMRole(name + 'Role', {
    AssumeRolePolicyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'sts:AssumeRole',
          Principal: {
            Service: 'lambda.amazonaws.com',
          },
          Effect: 'Allow',
          Sid: '',
        },
      ],
    },
    Policies: [
      {
        PolicyName: name + 'LogPolicy',
        PolicyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Action: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              Resource: 'arn:aws:logs:*:*:*',
              Effect: 'Allow',
            },
          ],
        },
      },
      ...(options.Policies || []),
    ],
  });

  const distributionExtras = options.DistributionExtras || {};

  // create the lambda source zip
  const source = createZipAsset(name + 'Source', archive => {
    if (statSync(options.Source).isDirectory()) {
      archive.directory(options.Source, false, data =>
        distributionExtras[data.name] ? false : data,
      );
    } else {
      archive.file(options.Source, { name: basename(options.Source) });
    }

    if (options.NodeModules) {
      const packages = getPackagePaths(options.Source, options.NodeModules);

      packages.forEach(pkg => {
        archive.directory(pkg.path, `node_modules/${pkg.name}`, data => {
          const packagePath = join('node_modules', pkg.name, data.name);
          return distributionExtras[packagePath] ? false : data;
        });
      });
    }

    for (const destPath in distributionExtras) {
      archive.file(distributionExtras[destPath], { name: destPath });
    }
  });

  // create the lambda itself
  const lambda = createLambdaFunction(name + 'Function', {
    FunctionName: fnSub('${AWS::StackName}-' + name),
    Runtime: options.Runtime,
    Role: role.attributes.Arn,
    Code: {
      S3Bucket: source.bucket,
      S3Key: source.key,
    },
    Handler: options.Handler,
    Environment: {
      Variables: options.Environment,
    },
    Timeout: options.Timeout,
    VpcConfig: options.VpcConfig,
  });

  return createModule(name, { role, source, lambda }, lambda.attributes);
}
