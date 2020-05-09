import { createIAMRole, IAMRolePolicy } from '@sjmeverett/cloudformation-types';

export interface CreateECSTaskRoleOptions {
  Policies?: IAMRolePolicy[];
}

export function createECSTaskRole(
  name: string,
  options: CreateECSTaskRoleOptions,
) {
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
    Policies: options.Policies || [],
  });
}
