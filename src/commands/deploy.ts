import { promises as fs, createReadStream } from 'fs';
import { template, forEach } from 'lodash';
import { S3, CloudFormation } from 'aws-sdk';
import { dirname, join } from 'path';

export async function deploy(
  manifestPath: string,
  bucket: string,
  execute: boolean,
  paramsPath: string | undefined,
) {
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
  const params = [] as CloudFormation.Parameter[];
  const s3 = new S3();
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

    await s3
      .upload({
        Bucket: bucket,
        Key: key,
        Body: createReadStream(join(manifestDir, key)),
      })
      .promise();
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

  await s3
    .upload({
      Bucket: bucket,
      Key: manifest.template,
      Body: createReadStream(join(manifestDir, manifest.template)),
    })
    .promise();

  const cloudFormation = new CloudFormation();

  const { StackSummaries } = await cloudFormation.listStacks({}).promise();

  const changeSetType = StackSummaries?.find(
    x =>
      x.StackName === manifest.name && x.StackStatus !== 'REVIEW_IN_PROGRESS',
  )
    ? 'UPDATE'
    : 'CREATE';

  const changeSetName = `${manifest.name}-${manifest.version}`;

  const changeSet = await cloudFormation
    .createChangeSet({
      StackName: manifest.name,
      ChangeSetType: changeSetType,
      ChangeSetName: changeSetName,
      TemplateURL: `https://s3.amazonaws.com/${bucket}/...`,
      Parameters: [],
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
