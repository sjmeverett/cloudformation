export interface S3BucketWithContentsOptions {
  SourceBucket: string;
  SourceKey: string;
  IndexDocument?: string;
  ErrorDocument?: string;
  ConfigFiles?: Record<string, string>;
}
