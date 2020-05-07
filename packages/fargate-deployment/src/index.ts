import {
  createECSCluster,
  createEC2SecurityGroup,
  createEC2SecurityGroupIngress,
  getRef,
  createElasticLoadBalancingV2LoadBalancer,
  createIAMRole,
  IAMRolePolicy,
  createECSTaskDefinition,
  getAttribute,
  fnSub,
  createECSService,
  createElasticLoadBalancingV2TargetGroup,
  createElasticLoadBalancingV2Listener,
  createRoute53RecordSet,
  ECSClusterDescription,
  EC2SecurityGroupDescription,
  EC2SecurityGroupIngressDescription,
  ElasticLoadBalancingV2LoadBalancerDescription,
  IAMRoleDescription,
  ECSTaskDefinitionDescription,
  ElasticLoadBalancingV2TargetGroupDescription,
  ECSServiceDescription,
  ElasticLoadBalancingV2ListenerDescription,
  Route53RecordSetDescription,
  dependsOn,
} from '@sjmeverett/cloudformation-types';

export interface FargateDeploymentOptions {
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
  ContainerPort: number;
  /**
   * How much CPU to give the container, where 1024 is 1 CPU (default 256)
   */
  ContainerCpu?: number;
  /**
   * How much memory in megabytes to give the container (default 512)
   */
  ContainerMemory?: number;
  /**
   * How many copies of the service task to run (default 2)
   */
  DesiredCount?: number;
  /**
   * The ID of the VPC to use
   */
  VpcId: string;
  /**
   * IDs of the private subnets
   */
  PrivateSubnets: string[];
  /**
   * IDs of the public subnets
   */
  PublicSubnets: string[];
  /**
   * The domain name to point at the load balancer
   */
  DomainName: string;
  /**
   * The domain zone name
   */
  ZoneName: string;
  /**
   * The stage, e.g. prod, dev
   */
  Stage: string;
  /**
   * The ACM certificate to use for HTTPS
   */
  CertificateArn: string;
  /**
   * The policies to attach to the role the container will run under.
   */
  Policies?: IAMRolePolicy[];
  /**
   * Optional environment variables.
   */
  Environment?: Record<string, string>;
  /**
   * The URL to poll for container health.
   */
  HealthCheckUrl?: string;
}

export interface FargateDeploymentResources {
  cluster: ECSClusterDescription;
  containerSecurityGroup: EC2SecurityGroupDescription;
  loadBalancerSecurityGroup: EC2SecurityGroupDescription;
  albIngress: EC2SecurityGroupIngressDescription;
  selfIngress: EC2SecurityGroupIngressDescription;
  loadBalancer: ElasticLoadBalancingV2LoadBalancerDescription;
  executionRole: IAMRoleDescription;
  taskRole: IAMRoleDescription;
  task: ECSTaskDefinitionDescription;
  targetGroup: ElasticLoadBalancingV2TargetGroupDescription;
  service: ECSServiceDescription;
  listener: ElasticLoadBalancingV2ListenerDescription;
  recordset: Route53RecordSetDescription;
}

export function createFargateDeployment(
  name: string,
  options: FargateDeploymentOptions,
): FargateDeploymentResources {
  const cluster = createECSCluster(`${name}Cluster`, {});

  const containerSecurityGroup = createEC2SecurityGroup(
    `${name}ContainerSecurityGroup`,
    {
      GroupDescription: 'Access to the Fargate containers',
      VpcId: options.VpcId,
    },
  );

  const loadBalancerSecurityGroup = createEC2SecurityGroup(
    `${name}LoadBalancerSecurityGroup`,
    {
      GroupDescription: 'Access to the public facing load balancer',
      VpcId: options.VpcId,
      SecurityGroupIngress: [{ CidrIp: '0.0.0.0/0', IpProtocol: '-1' }],
    },
  );

  const albIngress = createEC2SecurityGroupIngress(`${name}ALBIngress`, {
    Description: 'Ingress from the public ALB',
    GroupId: getRef(containerSecurityGroup),
    IpProtocol: '-1',
    SourceSecurityGroupId: getRef(loadBalancerSecurityGroup),
  });

  const selfIngress = createEC2SecurityGroupIngress(`${name}SelfIngress`, {
    Description: 'Ingress from other containers in the same security group',
    GroupId: getRef(containerSecurityGroup),
    IpProtocol: '-1',
    SourceSecurityGroupId: getRef(containerSecurityGroup),
  });

  const loadBalancer = createElasticLoadBalancingV2LoadBalancer(
    `${name}LoadBalancer`,
    {
      Scheme: 'internet-facing',
      LoadBalancerAttributes: [
        { Key: 'idle_timeout.timeout_seconds', Value: '30' },
      ],
      Subnets: options.PublicSubnets,
      SecurityGroups: [getRef(loadBalancerSecurityGroup)],
    },
  );

  const executionRole = createIAMRole(`${name}ExecutionRole`, {
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
                'logs:CreateLogStream',
                'logs:PutLogEvents',
                'logs:CreateLogGroup',
              ],
              Resource: '*',
            },
          ],
        },
      },
    ],
  });

  const taskRole = createIAMRole(`${name}TaskRole`, {
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

  const task = createECSTaskDefinition(`${name}Task`, {
    Cpu: (options.ContainerCpu || 256).toString(),
    Memory: (options.ContainerMemory || 512).toString(),
    NetworkMode: 'awsvpc',
    RequiresCompatibilities: ['FARGATE'],
    ExecutionRoleArn: getAttribute(executionRole, 'Arn'),
    TaskRoleArn: getAttribute(taskRole, 'Arn'),
    ContainerDefinitions: [
      {
        Name: options.ServiceName,
        Cpu: options.ContainerCpu || 256,
        Memory: options.ContainerMemory || 512,
        Image: options.ImageUrl,
        PortMappings: [{ ContainerPort: options.ContainerPort }],
        Environment: options.Environment
          ? Object.keys(options.Environment).map((Name) => ({
              Name,
              Value: options.Environment![Name],
            }))
          : [],
        LogConfiguration: {
          LogDriver: 'awslogs',
          Options: {
            'awslogs-create-group': 'true',
            'awslogs-group': name,
            'awslogs-region': fnSub('${AWS::Region}'),
            'awslogs-stream-prefix': name,
          },
        },
      },
    ],
  });

  const targetGroup = createElasticLoadBalancingV2TargetGroup(
    `${name}TargetGroup`,
    {
      HealthCheckIntervalSeconds: 10,
      HealthCheckPath: options.HealthCheckUrl || '/',
      HealthCheckProtocol: 'HTTP',
      HealthCheckTimeoutSeconds: 5,
      HealthyThresholdCount: 2,
      Port: options.ContainerPort,
      Protocol: 'HTTP',
      TargetType: 'ip',
      UnhealthyThresholdCount: 2,
      VpcId: options.VpcId,
    },
  );

  dependsOn(targetGroup, loadBalancer);

  const service = createECSService(`${name}Service`, {
    Cluster: getRef(cluster),
    LaunchType: 'FARGATE',
    DeploymentConfiguration: {
      MaximumPercent: 200,
      MinimumHealthyPercent: 75,
    },
    DesiredCount: options.DesiredCount || 2,
    NetworkConfiguration: {
      AwsvpcConfiguration: {
        SecurityGroups: [getRef(containerSecurityGroup)],
        Subnets: options.PrivateSubnets,
      },
    },
    TaskDefinition: getRef(task),
    LoadBalancers: [
      {
        ContainerName: options.ServiceName,
        ContainerPort: options.ContainerPort,
        TargetGroupArn: getRef(targetGroup),
      },
    ],
  });

  dependsOn(service, targetGroup);

  const listener = createElasticLoadBalancingV2Listener(`${name}Listener`, {
    DefaultActions: [{ TargetGroupArn: getRef(targetGroup), Type: 'forward' }],
    LoadBalancerArn: getRef(loadBalancer),
    Port: 443,
    Protocol: 'HTTPS',
    Certificates: [{ CertificateArn: options.CertificateArn }],
  });

  dependsOn(listener, loadBalancer);

  const recordset = createRoute53RecordSet(`${name}RecordSet`, {
    Name: options.DomainName,
    Type: 'A',
    HostedZoneName: options.ZoneName,
    AliasTarget: {
      HostedZoneId: getAttribute(loadBalancer, 'CanonicalHostedZoneID'),
      DNSName: getAttribute(loadBalancer, 'DNSName'),
      EvaluateTargetHealth: true,
    },
  });

  return {
    cluster,
    containerSecurityGroup,
    loadBalancerSecurityGroup,
    albIngress,
    selfIngress,
    loadBalancer,
    executionRole,
    taskRole,
    task,
    targetGroup,
    service,
    listener,
    recordset,
  };
}
