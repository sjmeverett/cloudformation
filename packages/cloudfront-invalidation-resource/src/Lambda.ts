import { CloudFront } from 'aws-sdk';
import fetch from 'node-fetch';
import { CloudFrontInvalidationOptions } from './CloudFrontInvalidationOptions';

export const handler = async (event: any, context: any) => {
  const options: CloudFrontInvalidationOptions = event.ResourceProperties as any;
  const resourceId = `Invalidation-${options.DistributionId}`;

  try {
    console.log(event);

    if (event.RequestType === 'Create' || event.RequestType === 'Update') {
      const cloudfront = new CloudFront();

      await cloudfront
        .createInvalidation({
          DistributionId: options.DistributionId,
          InvalidationBatch: {
            CallerReference: Date.now().toString(),
            Paths: {
              Quantity: options.Paths.length,
              Items: options.Paths,
            },
          },
        })
        .promise();

      await putResponse(
        'SUCCESS',
        'Invalidation successfully created',
        resourceId,
        event,
      );
    } else if (event.RequestType === 'Delete') {
      await putResponse(
        'SUCCESS',
        'Successfully deleted (NOP)',
        event.PhysicalResourceId,
        event,
      );
    } else {
      await putResponse(
        'FAILED',
        `Unknown request type ${event.RequestType}`,
        resourceId,
        event,
      );
    }
  } catch (err) {
    console.log(err.stack);
    await putResponse('FAILED', `Error: ${err.message}`, resourceId, event);
  }
};

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
