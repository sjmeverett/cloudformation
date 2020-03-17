import { promises as fs, createReadStream } from 'fs';
import { template, forEach } from 'lodash';
import { S3, CloudFormation } from 'aws-sdk';
import { dirname, join } from 'path';
import { upload } from '../util/upload';

export async function deploy(
  manifestPath: string,
  bucket: string,
  execute: boolean,
  paramsPath: string | undefined,
) {
  console.log('Deploying...');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
  const params = [] as CloudFormation.Parameter[];
  const s3 = new S3({ region: 'eu-west-2' });
  const manifestDir = dirname(manifestPath);

  for (const assetName in manifest.assets) {
    const key = manifest.assets[assetName];

    params.push(
      {
        ParameterKey: `${assetName}Bucket`,
        ParameterValue: bucket,
      },
      {
        ParameterKey: `${assetName}Key`,
        ParameterValue: key,
      },
    );

    await upload(s3, bucket, key, createReadStream(join(manifestDir, key)));
  }

  if (paramsPath) {
    const json = await fs.readFile(paramsPath, 'utf-8');

    forEach(JSON.parse(json), (str, key) => {
      const value = template(str)({ env: process.env });

      params.push({
        ParameterKey: key,
        ParameterValue: value,
      });
    });
  }

  await upload(
    s3,
    bucket,
    manifest.template,
    createReadStream(join(manifestDir, manifest.template)),
  );

  const cloudFormation = new CloudFormation({ region: 'eu-west-2' });

  const { StackSummaries } = await cloudFormation.listStacks({}).promise();

  const changeSetType = StackSummaries?.find(
    x =>
      x.StackName === manifest.name &&
      !['REVIEW_IN_PROGRESS', 'DELETE_COMPLETE'].includes(x.StackStatus),
  )
    ? 'UPDATE'
    : 'CREATE';

  const changeSetName = `${manifest.name}-${manifest.version}`;

  const changeSet = await cloudFormation
    .createChangeSet({
      StackName: manifest.name,
      ChangeSetType: changeSetType,
      ChangeSetName: changeSetName,
      TemplateURL: `https://${bucket}.s3.eu-west-2.amazonaws.com/${manifest.template}`,
      Parameters: params,
      Capabilities: ['CAPABILITY_IAM'],
    })
    .promise();

  if (execute) {
    await cloudFormation
      .executeChangeSet({
        StackName: manifest.name,
        ChangeSetName: changeSetName,
      })
      .promise();
  }

  return changeSet;
}
