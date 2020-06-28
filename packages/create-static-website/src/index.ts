import {
  CloudFrontDistributionLambdaFunctionAssociation,
  createCloudFrontCloudFrontOriginAccessIdentity,
  createS3BucketPolicy,
  createCloudFrontDistribution,
  createRoute53RecordSet,
  fnSub,
  getAttribute,
  getRef,
  dependsOn,
  CloudFrontCloudFrontOriginAccessIdentityDescription,
  S3BucketPolicyDescription,
  CloudFrontDistributionDescription,
  Route53RecordSetDescription,
} from '@sjmeverett/cloudformation-types';
import {
  createCloudFrontInvalidation,
  CloudFrontInvalidationDescription,
} from '@sjmeverett/cloudfront-invalidation-resource';
import {
  createS3BucketWithContents,
  S3BucketWithContentsDescription,
} from '@sjmeverett/s3-bucket-with-contents-resource';

export interface StaticWebsiteOptions<TDomains extends string> {
  /**
   * The bucket that contains the source package.
   */
  SourceBucket: string;
  /**
   * The key of the source package.
   */
  SourceKey: string;
  /**
   * The name of the Route53 domain (usually the FQDN of the root domain, e.g. "example.com.")
   */
  HostedZoneName: string;
  /**
   * The domain name of the site, or multiple domain names with identifiers as keys.
   */
  DomainName: string | Record<TDomains, string>;
  /**
   * The default index document, e.g. index.html
   */
  IndexDocument: string;
  /**
   * The default error document
   */
  ErrorDocument: string;
  /**
   * The default root document for CloudFront.
   */
  DefaultRootDocument?: string;
  /**
   * The ARN of the HTTPS certificate
   */
  CertificateArn: string;
  /**
   * Optional lambda function associations for the cloudfront distribution
   */
  LambdaFunctionAssociations?: CloudFrontDistributionLambdaFunctionAssociation[];
  /**
   * The ARN of the CloudFrontInvalidation custom resource lambda.
   */
  CloudFrontInvalidationServiceToken: string;
  /**
   * The ARN of the S3BucketWithContents custom resource lambda.
   */
  S3BucketWithContentsServiceToken: string;
  /**
   * A map of key/values that will be saved into `/env.js`
   */
  Environment?: Record<string, any>;
}

export type StaticWebsiteResources<TDomains extends string> = {
  bucket: S3BucketWithContentsDescription;
  accessIdentity: CloudFrontCloudFrontOriginAccessIdentityDescription;
  bucketPolicy: S3BucketPolicyDescription;
  cloudfrontDistribution: CloudFrontDistributionDescription;
  invalidation: CloudFrontInvalidationDescription;
} & Record<TDomains, Route53RecordSetDescription>;

export function createStaticWebsite<TDomains extends string = 'Domain'>(
  name: string,
  options: StaticWebsiteOptions<TDomains>,
): StaticWebsiteResources<TDomains> {
  const domains: Record<TDomains, string> =
    typeof options.DomainName === 'string'
      ? ({ Domain: options.DomainName } as any)
      : options.DomainName;

  if (Object.keys(domains).length === 0) {
    throw new Error('You must specify at least 1 domain');
  }

  const bucket = createS3BucketWithContents(name + 'Bucket', {
    ServiceToken: options.S3BucketWithContentsServiceToken,
    SourceBucket: options.SourceBucket,
    SourceKey: options.SourceKey,
    IndexDocument: options.IndexDocument,
    ErrorDocument: options.ErrorDocument,
    ConfigFiles: options.Environment
      ? {
          'env.js': `window.env = ${JSON.stringify(options.Environment)};`,
        }
      : {},
  });

  const accessIdentity = createCloudFrontCloudFrontOriginAccessIdentity(
    name + 'AccessIdentity',
    {
      CloudFrontOriginAccessIdentityConfig: {
        Comment: getRef(bucket),
      },
    },
  );

  const bucketPolicy = createS3BucketPolicy(name + 'BucketPolicy', {
    Bucket: getRef(bucket),
    PolicyDocument: {
      Statement: [
        {
          Action: ['s3:GetObject'],
          Effect: 'Allow',
          Sid: 'AddPerm',
          Resource: fnSub('arn:aws:s3:::${bucket}/*', {
            bucket: getRef(bucket),
          }),
          Principal: {
            CanonicalUser: getAttribute(accessIdentity, 'S3CanonicalUserId'),
          },
        },
      ],
    },
  });

  const cloudfrontDistribution = createCloudFrontDistribution(
    name + 'CloudFrontDistribution',
    {
      DistributionConfig: {
        Aliases: Object.values(domains),
        Origins: [
          {
            DomainName: getAttribute(bucket, 'RegionalDomainName'),
            Id: 'S3Origin',
            S3OriginConfig: {
              OriginAccessIdentity: fnSub(
                'origin-access-identity/cloudfront/${identity}',
                {
                  identity: getRef(accessIdentity),
                },
              ),
            },
          },
        ],
        Enabled: true,
        HttpVersion: 'http2',
        PriceClass: 'PriceClass_All',
        DefaultRootObject: options.DefaultRootDocument,
        DefaultCacheBehavior: {
          LambdaFunctionAssociations: options.LambdaFunctionAssociations,
          AllowedMethods: ['GET', 'HEAD'],
          CachedMethods: ['GET', 'HEAD'],
          Compress: true,
          TargetOriginId: 'S3Origin',
          ForwardedValues: {
            QueryString: true,
            Cookies: {
              Forward: 'none',
            },
          },
          ViewerProtocolPolicy: 'redirect-to-https',
        },
        ViewerCertificate: {
          AcmCertificateArn: options.CertificateArn,
          SslSupportMethod: 'sni-only',
        },
        CustomErrorResponses: [
          {
            ErrorCode: 403,
            ResponseCode: 404,
            ResponsePagePath: '/' + options.ErrorDocument,
          },
        ],
      },
    },
  );

  dependsOn(cloudfrontDistribution, bucket);

  const invalidation = createCloudFrontInvalidation(name + 'Invalidation', {
    ServiceToken: options.CloudFrontInvalidationServiceToken,
    DistributionId: getRef(cloudfrontDistribution),
    Paths: ['/*'],
    Key: options.SourceKey,
  });

  dependsOn(invalidation, bucket);

  const domainDescriptions = {} as any;

  for (const key in domains) {
    domainDescriptions[key] = createRoute53RecordSet(name + key, {
      Name: domains[key],
      Type: 'A',
      HostedZoneName: options.HostedZoneName,
      AliasTarget: {
        HostedZoneId: 'Z2FDTNDATAQYW2',
        DNSName: getAttribute(cloudfrontDistribution, 'DomainName'),
      },
    });
  }

  return {
    bucket,
    accessIdentity,
    bucketPolicy,
    cloudfrontDistribution,
    invalidation,
    ...domainDescriptions,
  };
}
