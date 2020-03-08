import { createWriteStream, promises } from 'fs';
import archiver from 'archiver';
import { join } from 'path';
import { makeHashStream } from './makeHashStream';

export async function zipFolder(
  name: string,
  sourcePath: string,
  destinationDir: string,
) {
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.directory(sourcePath, false);

  const outstream = createWriteStream(join(destinationDir, `${name}.zip`));

  const hash = await new Promise<string>((resolve, reject) => {
    archive.on('error', reject);

    archive
      .pipe(makeHashStream(resolve))
      .pipe(outstream)
      .on('error', reject);

    archive.finalize();
  });

  const zipFileName = `${name}-${hash}.zip`;

  await promises.rename(
    join(destinationDir, `${name}.zip`),
    join(destinationDir, zipFileName),
  );

  return zipFileName;
}
