import { createStandardLambda } from '../createStandardLambda';
import { join } from 'path';
import { createCustomResource } from '../createCustomResource';
import { CloudFrontInvalidationOptions } from './CloudFrontInvalidationOptions';

const CloudFrontInvalidationLambda = createStandardLambda(
  'CloudFrontInvalidationResource',
  {
    Source: join(__dirname, 'cloudfrontInvalidationLambda.js'),
    Handler: 'cloudfrontInvalidationLambda.handler',
    Runtime: 'nodejs12.x',
    NodeModules: ['node-fetch'],
    Timeout: 120,
    Policies: [
      {
        PolicyName: 'CloudFrontInvalidationResoureS3Policy',
        PolicyDocument: {
          Statement: [
            {
              Action: ['cloudfront:CreateInvalidation'],
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

export const createCloudFrontInvalidation = createCustomResource<
  CloudFrontInvalidationOptions
>(
  CloudFrontInvalidationLambda.attributes.Arn,
  Object.values(CloudFrontInvalidationLambda.components),
);
