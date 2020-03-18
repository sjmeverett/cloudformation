import {
  IAMRolePolicy,
  createIAMRole,
  createLambdaFunction,
} from './generated';
import { createModule } from './createModule';
import { createZipAsset } from './createZipAsset';
import { getPackagePaths } from './util/getPackagePaths';
import { basename } from 'path';
import { fnSub } from './fnSub';

export interface StandardLambdaOptions {
  /**
   * The folder containing the source code for the lambda
   */
  SourceDir: string;
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
   * Timeout in seconds
   */
  Timeout?: number;
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

  // create the lambda source zip
  const source = createZipAsset(name + 'Source', archive => {
    archive.directory(options.SourceDir, false);

    if (options.NodeModules) {
      const paths: string[] = [];
      getPackagePaths(options.SourceDir, options.NodeModules, paths);

      paths.forEach(path => {
        archive.directory(path, `node_modules/${basename(path)}`);
      });
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
  });

  return createModule(name, { role, source, lambda }, lambda.attributes);
}
