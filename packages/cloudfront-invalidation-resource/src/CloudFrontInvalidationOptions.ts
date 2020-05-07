export interface CloudFrontInvalidationOptions {
  /**
   * The ID of the CloudFront distribution to create an invalidation for.
   */
  DistributionId: string;
  /**
   * The list of paths to invalidate.
   */
  Paths: string[];
  /**
   * A key, can be anything, but changing this value trigger an update on the
   * custom resource, and therefore an invalidation.
   */
  Key: string;
}
