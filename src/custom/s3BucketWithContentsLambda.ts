import * as unzipper from 'unzipper';
import { S3, AWSError } from 'aws-sdk';
import { Transform } from 'stream';
import { lookup } from 'mime-types';
import fetch from 'node-fetch';
import { PromiseResult } from 'aws-sdk/lib/request';
import { S3BucketWithContentsOptions } from './s3BucketWithContentsOptions';

export const handler = async (event: any, context: any) => {
  const options: S3BucketWithContentsOptions = event.ResourceProperties as any;

  const bucketName =
    event.PhysicalResourceId ||
    `${event.LogicalResourceId.toLowerCase()}-${Math.floor(
      Math.random() * 1e9,
    ).toString(36)}`;

  try {
    console.log(event);
    const s3 = new S3();

    if (event.RequestType === 'Create' || event.RequestType === 'Update') {
      if (!event.PhysicalResourceId) {
        await s3
          .createBucket({
            Bucket: bucketName,
            ACL: 'public-read',
          })
          .promise();
      }

      if (options.IndexDocument || options.ErrorDocument) {
        await s3
          .putBucketWebsite({
            Bucket: bucketName,
            WebsiteConfiguration: {
              IndexDocument: options.IndexDocument
                ? { Suffix: options.IndexDocument }
                : undefined,
              ErrorDocument: options.ErrorDocument
                ? { Key: 'index' }
                : undefined,
            },
          })
          .promise();
      }

      const zipFile = s3
        .getObject({ Bucket: options.SourceBucket, Key: options.SourceKey })
        .createReadStream()
        .pipe(unzipper.Parse());

      zipFile.pipe(
        createTransformStream(async entry => {
          if (entry.type === 'File') {
            return s3
              .upload({
                Bucket: bucketName,
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

      await putResponse('SUCCESS', 'Successfully created', bucketName, event, {
        RegionalDomainName: `${bucketName}.s3.${s3.config.region}.amazonaws.com`,
      });
    } else if (event.RequestType === 'Delete') {
      let token: string | undefined = undefined;

      do {
        const response = (await s3
          .listObjectsV2({
            Bucket: event.PhysicalResourceId,
            ContinuationToken: token,
          })
          .promise()) as PromiseResult<S3.ListObjectsV2Output, AWSError>;

        token = response.ContinuationToken;

        if (!response.Contents) {
          break;
        }

        await s3
          .deleteObjects({
            Bucket: event.PhysicalResourceId,
            Delete: {
              Objects: response.Contents.filter(
                object => object.Key,
              ).map(object => ({ Key: object.Key! })),
            },
          })
          .promise();
      } while (token);

      await s3.deleteBucket({ Bucket: event.PhysicalResourceId }).promise();

      await putResponse(
        'SUCCESS',
        'Successfully deleted',
        event.PhysicalResourceId,
        event,
      );
    } else {
      await putResponse(
        'FAILED',
        `Unknown request type ${event.RequestType}`,
        bucketName,
        event,
      );
    }
  } catch (err) {
    console.log(err.stack);
    await putResponse('FAILED', `Error: ${err.message}`, bucketName, event);
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

async function putResponse(
  status: 'SUCCESS' | 'FAILED',
  reason: string,
  resourceId: string,
  event: any,
  data: any = {},
) {
  const responseBody = {
    Status: status,
    Reason: reason,
    PhysicalResourceId: resourceId,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: data,
  };

  console.log('Response ', responseBody);

  const response = await fetch(event.ResponseURL, {
    method: 'PUT',
    headers: {
      'content-type': '',
    },
    body: JSON.stringify(responseBody),
  });

  console.log(`Reply: ${response.status} ${response.statusText}`);
}
