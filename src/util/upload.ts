import { S3 } from 'aws-sdk';
import Guage from 'gauge';

const gauge = new Guage();

export async function upload(
  s3: S3,
  bucket: string,
  key: string,
  body: S3.Body,
) {
  const status = `Uploading ${key}`;

  gauge.show(status, 0);

  const result = s3.upload({
    Key: key,
    Bucket: bucket,
    Body: body,
  });

  result.on('httpUploadProgress', progress => {
    gauge.pulse();
    gauge.show(status, progress.loaded / progress.total);
  });

  return result.promise();
}
