import {
  createS3BucketPolicy,
  createCloudFrontDistribution,
  createCloudFrontCloudFrontOriginAccessIdentity,
  createRoute53RecordSet,
  CloudFrontDistributionLambdaFunctionAssociation,
} from './generated';
import { fnSub } from './fnSub';
import { createModule } from './createModule';
import { createZipAsset } from './createZipAsset';
import { createS3BucketWithContents } from './custom/createS3BucketWithContents';
import { createCloudFrontInvalidation } from './custom/createCloudFrontInvalidation';

export interface StaticWebsiteOptions {
  /**
   * The name of the Route53 domain (usually the FQDN of the root domain, e.g. "example.com.")
   */
  HostedZoneName: string;
  /**
   * The domain name of the site
   */
  DomainName: string;
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
   * Source folder
   */
  SourceDir: string;
  /**
   * Optional environment variables to get written out to /env.js - e.g. for {foo: "bar"},
   * an env.js will be generated with the following contents:
   *
   * window.env = {foo: "bar"};
   */
  Environment?: Record<string, any>;
  /**
   * Optional lambda function associations for the cloudfront distribution
   */
  LambdaFunctionAssociations?: CloudFrontDistributionLambdaFunctionAssociation[];
}

export function createStaticWebsite(
  name: string,
  options: StaticWebsiteOptions,
) {
  const deploymentPackage = createZipAsset(
    name + 'DeploymentPackage',
    archive => {
      archive.directory(options.SourceDir, false, data => {
        return data.name === 'env.js' ? false : data;
      });

      if (options.Environment) {
        archive.append(`window.env = ${JSON.stringify(options.Environment)};`, {
          name: 'env.js',
        });
      }
    },
  );

  const bucket = createS3BucketWithContents(name + 'Bucket', {
    SourceBucket: deploymentPackage.bucket,
    SourceKey: deploymentPackage.key,
    IndexDocument: options.IndexDocument,
    ErrorDocument: options.ErrorDocument,
  });

  const accessIdentity = createCloudFrontCloudFrontOriginAccessIdentity(
    name + 'AccessIdentity',
    {
      CloudFrontOriginAccessIdentityConfig: {
        Comment: bucket.ref,
      },
    },
  );

  const bucketPolicy = createS3BucketPolicy(name + 'BucketPolicy', {
    Bucket: bucket.ref,
    PolicyDocument: {
      Statement: [
        {
          Action: ['s3:GetObject'],
          Effect: 'Allow',
          Sid: 'AddPerm',
          Resource: fnSub('arn:aws:s3:::${bucket}/*', { bucket: bucket.ref }),
          Principal: {
            CanonicalUser: accessIdentity.attributes.S3CanonicalUserId,
          },
        },
      ],
    },
  });

  const cloudfrontDistribution = createCloudFrontDistribution(
    name + 'CloudFrontDistribution',
    {
      DistributionConfig: {
        Aliases: [options.DomainName],
        Origins: [
          {
            DomainName: bucket.attributes.RegionalDomainName,
            Id: 'S3Origin',
            S3OriginConfig: {
              OriginAccessIdentity: fnSub(
                'origin-access-identity/cloudfront/${identity}',
                {
                  identity: accessIdentity.ref,
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

  cloudfrontDistribution.definition.DependsOn = [bucket.name];

  const invalidation = createCloudFrontInvalidation(name + 'Invalidation', {
    DistributionId: cloudfrontDistribution.ref,
    Paths: ['/*'],
    Key: deploymentPackage.key,
  });

  invalidation.definition.DependsOn = [bucket.name];

  const route53Domain = createRoute53RecordSet(name + 'Domain', {
    Name: options.DomainName,
    Type: 'A',
    HostedZoneName: options.HostedZoneName,
    AliasTarget: {
      HostedZoneId: 'Z2FDTNDATAQYW2',
      DNSName: cloudfrontDistribution.attributes.DomainName,
    },
  });

  return createModule(
    name,
    {
      deploymentPackage,
      bucket,
      accessIdentity,
      bucketPolicy,
      cloudfrontDistribution,
      invalidation,
      route53Domain,
    },
    {},
  );
}
