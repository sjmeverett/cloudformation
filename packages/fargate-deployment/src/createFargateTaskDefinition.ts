import {
  createECSTaskDefinition,
  fnSub,
} from '@sjmeverett/cloudformation-types';

export interface CreateFargateTaskDefinitionOptions {
  /**
   * A name for the deployed service
   */
  ServiceName: string;
  /**
   * The Docker image
   */
  ImageUrl: string;
  /**
   * The port the container will listen on.
   */
  ContainerPort?: number;
  /**
   * How much CPU to give the container, where 1024 is 1 CPU (default 256)
   */
  ContainerCpu?: number;
  /**
   * How much memory in megabytes to give the container (default 512)
   */
  ContainerMemory?: number;
  /**
   * Optional environment variables.
   */
  Environment?: Record<string, string>;
  /**
   * The ARN of the execution role.
   */
  ExecutionRoleArn: string;
  /**
   * The ARN of the task role.
   */
  TaskRoleArn: string;
  /**
   * The name of the CloudWatch log group
   */
  LogGroup?: string;
}

export function createFargateTaskDefinition(
  name: string,
  options: CreateFargateTaskDefinitionOptions,
) {
  return createECSTaskDefinition(name, {
    Cpu: (options.ContainerCpu || 256).toString(),
    Memory: (options.ContainerMemory || 512).toString(),
    NetworkMode: 'awsvpc',
    RequiresCompatibilities: ['FARGATE'],
    ExecutionRoleArn: options.ExecutionRoleArn,
    TaskRoleArn: options.TaskRoleArn,
    ContainerDefinitions: [
      {
        Name: options.ServiceName,
        Cpu: options.ContainerCpu || 256,
        Memory: options.ContainerMemory || 512,
        Image: options.ImageUrl,
        PortMappings: options.ContainerPort
          ? [{ ContainerPort: options.ContainerPort }]
          : undefined,
        Environment: options.Environment
          ? Object.keys(options.Environment).map((Name) => ({
              Name,
              Value: options.Environment![Name],
            }))
          : [],
        LogConfiguration: options.LogGroup
          ? {
              LogDriver: 'awslogs',
              Options: {
                'awslogs-group': options.LogGroup,
                'awslogs-region': fnSub('${AWS::Region}'),
                'awslogs-stream-prefix': options.ServiceName,
              },
            }
          : undefined,
      },
    ],
  });
}
