export interface S3ZipDeploymentOptions {
  SourceBucket: string;
  SourceKey: string;
  DestinationBucket: string;
  DeploymentName: string;
  CloudFrontDistributionId?: string;
}
