import {
  createIAMRole,
  createLambdaFunction,
  createApiGatewayRestApi,
  createLambdaPermission,
  createApiGatewayResource,
  createApiGatewayMethod,
  createApiGatewayDeployment,
  createApiGatewayStage,
  createApiGatewayDomainName,
  createApiGatewayBasePathMapping,
  createRoute53RecordSet,
} from './generated';
import { createZipAsset } from './createZipAsset';
import { createModule } from './createModule';
import { fnSub } from './fnSub';
import {
  StandardLambdaOptions,
  createStandardLambda,
} from './createStandardLambda';

export interface LambdaApiOptions extends StandardLambdaOptions {
  /**
   * The API stage (e.g., dev)
   */
  Stage: string;
  /**
   * A description for the API
   */
  Description: string;
  /**
   * The name of the Route53 domain (usually the FQDN of the root domain, e.g. "example.com.")
   */
  HostedZoneName: string;
  /**
   * The domain name for the API
   */
  DomainName: string;
  /**
   * The ARN of the HTTPS certificate to use
   */
  CertificateArn: string;
}

/**
 * Creates an APIGateway API with a custom domain in Route53 that forwards all requests to a Lambda function.
 * @param name
 * @param options
 */
export function createLambdaApi(name: string, options: LambdaApiOptions) {
  //
  // Lambda
  //
  const lambda = createStandardLambda(name, options);

  const invokeArn = fnSub(
    'arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${Arn}/invocations',
    { Arn: lambda.attributes.Arn },
  );

  //
  // API Gateway
  //

  // create the API Gateway Rest API
  const api = createApiGatewayRestApi(name + 'ApiGateway', {
    Name: name + '-' + options.Stage,
    Description: options.Description,
  });

  // give API Gateway access to the lambda function
  const permission = createLambdaPermission(name + 'Permission', {
    Action: 'lambda:InvokeFunction',
    FunctionName: lambda.attributes.Arn,
    Principal: 'apigateway.amazonaws.com',
    SourceArn: fnSub(
      'arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${ApiId}/${Stage}/*/*',
      { ApiId: api.ref, Stage: options.Stage },
    ),
  });

  // proxy all paths (except /, which is below)
  const wildcardProxyResource = createApiGatewayResource(
    name + 'WildcardProxy',
    {
      RestApiId: api.ref,
      ParentId: api.attributes.RootResourceId,
      PathPart: '{proxy+}',
    },
  );

  const wildcardProxyMethod = createApiGatewayMethod(
    name + 'WildcardProxyMethod',
    {
      RestApiId: api.ref,
      ResourceId: wildcardProxyResource.ref,
      HttpMethod: 'ANY',
      AuthorizationType: 'NONE',
      Integration: {
        Type: 'AWS_PROXY',
        IntegrationHttpMethod: 'POST',
        Uri: invokeArn,
      },
    },
  );

  // proxy root (/) path
  const rootProxyMethod = createApiGatewayMethod(name + 'RootProxyMethod', {
    RestApiId: api.ref,
    ResourceId: api.attributes.RootResourceId,
    HttpMethod: 'ANY',
    AuthorizationType: 'NONE',
    Integration: {
      Type: 'AWS_PROXY',
      IntegrationHttpMethod: 'POST',
      Uri: invokeArn,
    },
  });

  // create a deployment
  const apiGatewayDeployment = createApiGatewayDeployment(name + 'Deployment', {
    RestApiId: api.ref,
  });

  apiGatewayDeployment.definition.DependsOn = [
    wildcardProxyMethod.name,
    rootProxyMethod.name,
  ];

  // create the stage to enable logging
  const stage = createApiGatewayStage(name + 'Stage', {
    RestApiId: api.ref,
    DeploymentId: apiGatewayDeployment.ref,
    StageName: options.Stage,
    MethodSettings: [
      {
        DataTraceEnabled: true,
        HttpMethod: '*',
        LoggingLevel: 'INFO',
        ResourcePath: '/*',
        MetricsEnabled: true,
      },
    ],
  });

  // create the domain name in API Gateway
  const apiGatewayDomain = createApiGatewayDomainName(name + 'Domain', {
    DomainName: options.DomainName,
    CertificateArn: options.CertificateArn,
  });

  // create the base path mapping in the API Gateway domain
  const basePathMapping = createApiGatewayBasePathMapping(name + 'BasePath', {
    DomainName: apiGatewayDomain.definition.Properties.DomainName,
    Stage: options.Stage,
    RestApiId: api.ref,
  });

  basePathMapping.definition.DependsOn = [apiGatewayDomain.name];

  //
  // Route53
  //

  // create the domain record in Route53
  const route53Record = createRoute53RecordSet(name + 'Route53Record', {
    Name: options.DomainName,
    Type: 'A',
    HostedZoneName: options.HostedZoneName,
    AliasTarget: {
      DNSName: apiGatewayDomain.attributes.DistributionDomainName,
      HostedZoneId: apiGatewayDomain.attributes.DistributionHostedZoneId,
      EvaluateTargetHealth: true,
    },
  });

  return createModule(
    name,
    {
      ...lambda.components,
      api,
      permission,
      wildcardProxyResource,
      wildcardProxyMethod,
      rootProxyMethod,
      apiGatewayDeployment,
      stage,
      apiGatewayDomain,
      basePathMapping,
      route53Record,
    },
    {},
  );
}
