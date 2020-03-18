import { createStandardLambda } from '../createStandardLambda';
import { join } from 'path';
import { createCustomResource } from '../createCustomResource';
import { S3ZipDeploymentOptions } from './s3-zip-deployment/S3ZipDeploymentOptions';
import { createModule } from '../createModule';
import { createIAMPolicy } from '../generated';
import { fnSub } from '../fnSub';

const s3DeployZipLambda = createStandardLambda('S3DeployZipResource', {
  SourceDir: join(__dirname, 's3-zip-deployment'),
  Handler: 'index.handler',
  Runtime: 'nodejs12.x',
  NodeModules: ['unzipper', 'cfn-response', 'mime-types'],
  Timeout: 120,
});

const _createS3ZipDeployment = createCustomResource<S3ZipDeploymentOptions>(
  s3DeployZipLambda.attributes.Arn,
  Object.values(s3DeployZipLambda.components),
);

export function createS3ZipDeployment(
  name: string,
  options: S3ZipDeploymentOptions & { BucketResourceName: string },
) {
  const resource = _createS3ZipDeployment(name, options);

  const policy = createIAMPolicy(name + 'S3Policy', {
    Roles: [s3DeployZipLambda.components.role.ref],
    PolicyName: name + 'S3Policy',
    PolicyDocument: {
      Statement: [
        {
          Action: ['s3:PutObject', 's3:GetObject', 's3:DeleteObject'],
          Effect: 'Allow',
          Sid: 'AddPerm',
          Resource: [
            fnSub('arn:aws:s3:::${Bucket}/*', {
              Bucket: options.SourceBucket,
            }),
            fnSub('arn:aws:s3:::${Bucket}/*', {
              Bucket: options.DestinationBucket,
            }),
          ],
        },
      ],
    },
  });

  resource.definition.DependsOn = [policy.name, options.BucketResourceName];

  return createModule(
    name,
    {
      resource,
      policy,
    },
    {},
  );
}
