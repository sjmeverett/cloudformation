import { Stack } from '../createStack';
import { Command } from 'commander';
import { deploy } from './deploy';

export function autorun(stack: Stack) {
  const program = new Command();
  let handled = false;

  program
    .command('deploy <destinationDir>')
    .description(
      'Uploads the template file and any assets referred to by the manifest file and creates a changeset in CloudFormation',
    )
    .option(
      '-b, --bucket <bucket>',
      'The bucket to upload the template and assets to',
    )
    .option(
      '-V, --stack-version <version>',
      'A unique string representing this version of the stack (e.g. git hash)',
    )
    .option(
      '-p, --paramfile <path>',
      'The path to a file containing values for the parameters',
    )
    .option('-e, --execute', 'If specified, the changeset will be executed')
    .option('-r, --region', 'The region to deploy to')
    .action((manifestPath, destinationDir, options) => {
      handled = true;

      const region =
        options.region ||
        process.env.AWS_REGION ||
        process.env.AWS_DEFAULT_REGION ||
        'eu-west-2';

      deploy(
        stack,
        manifestPath,
        destinationDir,
        options.bucket,
        options.execute,
        options.paramfile,
        region,
      ).then(
        changeSet => {
          console.log(
            `Created changeset ${changeSet.Id} for stack ${changeSet.StackId}`,
          );
        },
        err => {
          console.error('Deploy failed.\n');
          console.error(err.stack);
        },
      );
    });

  program.parse(process.argv);

  if (!handled) {
    program.help();
  }
}
