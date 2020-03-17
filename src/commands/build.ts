import { Stack } from '../createStack';
import { promises as fs } from 'fs';
import { join } from 'path';

export async function build(
  stack: Stack,
  version: string,
  destinationDir: string,
) {
  await fs.mkdir(destinationDir, { recursive: true });

  const templatePath = `${stack.name}-${version}.template.json`;

  const templateBody = JSON.stringify(stack.definition, null, 2);

  await fs.writeFile(join(destinationDir, templatePath), templateBody);

  const manifest = {
    version,
    name: stack.name,
    template: templatePath,
    assets: {} as Record<string, string>,
  };

  for (const asset of stack.assets) {
    if (typeof asset.source === 'string') {
      manifest.assets[asset.name] = asset.source;
    } else {
      manifest.assets[asset.name] = await asset.source(destinationDir);
    }
  }

  const manifestPath = `${stack.name}-${version}.manifest.json`;

  await fs.writeFile(
    join(destinationDir, manifestPath),
    JSON.stringify(manifest, null, 2),
  );

  return manifestPath;
}
