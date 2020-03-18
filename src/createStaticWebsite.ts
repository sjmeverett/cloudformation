import {
  createS3Bucket,
  createS3BucketPolicy,
  createCloudFrontDistribution,
  createCloudFrontCloudFrontOriginAccessIdentity,
  createRoute53RecordSet,
} from './generated';
import { fnSub } from './fnSub';
import { createModule } from './createModule';
import { createZipAsset } from './createZipAsset';
import { createS3ZipDeployment } from './custom/createS3ZipDeployment';

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
   * The Route53 zone ID of CloudFront for the region being used
   */
  CloudFrontZoneId: string;
  /**
   * The default index document, e.g. index.html
   */
  IndexDocument: string;
  /**
   * The default error document
   */
  ErrorDocument: string;
  /**
   * The ARN of the HTTPS certificate
   */
  CertificateArn: string;
  /**
   * Source folder
   */
  SourceDir: string;
}

export function createStaticWebsite(
  name: string,
  options: StaticWebsiteOptions,
) {
  const bucket = createS3Bucket(name + 'Bucket', {
    AccessControl: 'PublicRead',
    WebsiteConfiguration: {
      IndexDocument: options.IndexDocument,
      ErrorDocument: options.ErrorDocument,
    },
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
        DefaultRootObject: options.IndexDocument,
        DefaultCacheBehavior: {
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
      },
    },
  );

  cloudfrontDistribution.definition.DependsOn = [bucket.name];

  const route53Domain = createRoute53RecordSet(name + 'Domain', {
    Name: options.DomainName,
    Type: 'A',
    HostedZoneName: options.HostedZoneName,
    AliasTarget: {
      HostedZoneId: 'Z2FDTNDATAQYW2',
      DNSName: cloudfrontDistribution.attributes.DomainName,
    },
  });

  const deploymentPackage = createZipAsset(
    name + 'DeploymentPackage',
    options.SourceDir,
  );

  const deployment = createS3ZipDeployment(name + 'Deployment', {
    SourceBucket: deploymentPackage.bucket,
    SourceKey: deploymentPackage.key,
    DestinationBucket: bucket.ref,
    DeploymentName: 'MainDeployment',
    BucketResourceName: bucket.name,
  });

  return createModule(
    name,
    {
      bucket,
      accessIdentity,
      bucketPolicy,
      cloudfrontDistribution,
      route53Domain,
      deploymentPackage,
      deployment,
    },
    {},
  );
}
