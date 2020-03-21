import { promises as fs, createReadStream } from 'fs';
import { template, forEach } from 'lodash';
import { S3, CloudFormation } from 'aws-sdk';
import { join } from 'path';
import { upload } from '../util/upload';
import { Stack } from '../createStack';

export interface DeployOptions {
  version: string;
  destinationDir: string;
  bucket: string;
  execute: boolean;
  paramsPath: string | undefined;
  region: string;
  packageOnly: boolean;
}

export async function deploy(stack: Stack, options: DeployOptions) {
  console.log('Building template and assets...');

  await fs.mkdir(options.destinationDir, { recursive: true });

  const templatePath = `${stack.name}-${options.version}.template.json`;

  const templateBody = JSON.stringify(stack.definition, null, 2);

  await fs.writeFile(join(options.destinationDir, templatePath), templateBody);

  const manifest = {
    version: options.version,
    name: stack.name,
    template: templatePath,
    assets: {} as Record<string, string>,
  };

  for (const asset of stack.assets) {
    if (typeof asset.source === 'string') {
      manifest.assets[asset.name] = asset.source;
    } else {
      manifest.assets[asset.name] = await asset.source(options.destinationDir);
    }
  }

  const manifestPath = `${stack.name}-${options.version}.manifest.json`;

  await fs.writeFile(
    join(options.destinationDir, manifestPath),
    JSON.stringify(manifest, null, 2),
  );

  if (options.packageOnly) {
    return;
  }

  console.log('Deploying...');
  const params = [] as CloudFormation.Parameter[];
  const s3 = new S3({ region: options.region });

  for (const assetName in manifest.assets) {
    const key = manifest.assets[assetName];

    params.push(
      {
        ParameterKey: `${assetName}Bucket`,
        ParameterValue: options.bucket,
      },
      {
        ParameterKey: `${assetName}Key`,
        ParameterValue: key,
      },
    );

    await upload(
      s3,
      options.bucket,
      key,
      createReadStream(join(options.destinationDir, key)),
    );
  }

  if (options.paramsPath) {
    const json = await fs.readFile(options.paramsPath, 'utf-8');

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
    options.bucket,
    manifest.template,
    createReadStream(join(options.destinationDir, manifest.template)),
  );

  const cloudFormation = new CloudFormation({ region: options.region });

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
      TemplateURL: `https://${options.bucket}.s3.${options.region}.amazonaws.com/${manifest.template}`,
      Parameters: params,
      Capabilities: ['CAPABILITY_IAM'],
    })
    .promise();

  if (options.execute) {
    console.log('Waiting for changeset to be created...');

    await cloudFormation
      .waitFor('changeSetCreateComplete', { ChangeSetName: changeSetName })
      .promise();

    console.log('Executing changeset...');

    await cloudFormation
      .executeChangeSet({
        StackName: manifest.name,
        ChangeSetName: changeSetName,
      })
      .promise();

    console.log('Done');
  }

  return changeSet;
}
