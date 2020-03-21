import { createStandardLambda } from '../createStandardLambda';
import { join } from 'path';
import { createCustomResource } from '../createCustomResource';
import { S3BucketWithContentsOptions } from './s3BucketWithContentsOptions';

const s3BucketWithContentsLambda = createStandardLambda(
  'S3BucketWithContentsResource',
  {
    Source: join(__dirname, 's3BucketWithContentsLambda.js'),
    Handler: 's3BucketWithContentsLambda.handler',
    Runtime: 'nodejs12.x',
    NodeModules: ['unzipper', 'node-fetch', 'mime-types'],
    Timeout: 120,
    Policies: [
      {
        PolicyName: 'S3BucketWithContentsResoureS3Policy',
        PolicyDocument: {
          Statement: [
            {
              Action: ['s3:*'],
              Effect: 'Allow',
              Sid: 'AddPerm',
              Resource: '*',
            },
          ],
        },
      },
    ],
  },
);

export const createS3BucketWithContents = createCustomResource<
  S3BucketWithContentsOptions,
  { RegionalDomainName: string }
>(
  s3BucketWithContentsLambda.attributes.Arn,
  Object.values(s3BucketWithContentsLambda.components),
  ['RegionalDomainName'],
);
