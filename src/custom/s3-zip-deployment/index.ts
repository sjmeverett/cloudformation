import * as unzipper from 'unzipper';
import { S3, CloudFront } from 'aws-sdk';
import { Transform } from 'stream';
import { S3ZipDeploymentOptions } from './S3ZipDeploymentOptions';
import { lookup } from 'mime-types';

const response = require('cfn-response');

export const handler = async (event: any, context: any) => {
  try {
    console.log(event);
    const props: S3ZipDeploymentOptions = event.ResourceProperties as any;
    const s3 = new S3();

    if (event.RequestType === 'Create' || event.RequestType === 'Update') {
      const zipFile = s3
        .getObject({ Bucket: props.SourceBucket, Key: props.SourceKey })
        .createReadStream()
        .pipe(unzipper.Parse());

      zipFile.pipe(
        createTransformStream(async entry => {
          if (entry.type === 'File') {
            return s3
              .upload({
                Bucket: props.DestinationBucket,
                Key: entry.path,
                Body: entry,
                ContentType: lookup(entry.path) || 'application/octet-stream',
              })
              .promise();
          } else {
            return entry.autodrain();
          }
        }),
      );

      await zipFile.promise();

      if (props.CloudFrontDistributionId) {
        const cloudfront = new CloudFront();

        await cloudfront
          .createInvalidation({
            DistributionId: props.CloudFrontDistributionId,
            InvalidationBatch: {
              CallerReference: Date.now().toString(),
              Paths: {
                Quantity: 1,
                Items: ['/*'],
              },
            },
          })
          .promise();
      }

      response.send(event, context, 'SUCCESS', {
        PhysicalResourceId: `${props.DestinationBucket}:${props.DeploymentName}`,
      });
    } else if (event.RequestType === 'Delete') {
      response.send(event, context, 'SUCCESS', {
        PhysicalResourceId: `${props.DestinationBucket}:${props.DeploymentName}`,
      });
    } else {
      response.send(event, context, 'FAILED', {
        Error: `Unknown resource type ${event.RequestType}`,
      });
    }
  } catch (err) {
    console.error(err.stack);
    response.send(event, context, 'FAILED', { Error: err.message });
  }
};

function createTransformStream(process: (entry: any) => Promise<void>) {
  return new Transform({
    objectMode: true,
    transform: (entry, _enc, callback) => {
      process(entry).then(
        () => {
          callback();
        },
        err => {
          callback(err);
        },
      );
    },
  });
}
