import { createIAMRole } from '@sjmeverett/cloudformation-types';

export function createFargateExecutionRole(name: string) {
  return createIAMRole(name, {
    AssumeRolePolicyDocument: {
      Statement: [
        {
          Effect: 'Allow',
          Principal: {
            Service: 'ecs-tasks.amazonaws.com',
          },
          Action: 'sts:AssumeRole',
        },
      ],
    },
    Policies: [
      {
        PolicyName: `${name}ExecutionPolicy`,
        PolicyDocument: {
          Statement: [
            {
              Effect: 'Allow',
              Action: [
                'ecr:GetAuthorizationToken',
                'ecr:BatchCheckLayerAvailability',
                'ecr:GetDownloadUrlForLayer',
                'ecr:BatchGetImage',
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              Resource: '*',
            },
          ],
        },
      },
    ],
  });
}
