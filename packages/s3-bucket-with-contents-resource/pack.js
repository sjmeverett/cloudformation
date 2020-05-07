const archiver = require('archiver');
const { createWriteStream } = require('fs');
const { getPackagePaths } = require('@sjmeverett/get-package-paths');

const outdir = 'dist/s3-bucket-with-contents-resource.zip';
const includedPackages = ['unzipper'];

const outstream = createWriteStream(outdir);

const archive = archiver('zip', { zlib: { level: 9 } });
const packagePaths = getPackagePaths(process.cwd(), includedPackages);

archive.file('dist/Lambda.js', { name: 'index.js' });

packagePaths.forEach((pkg) => {
  archive.directory(pkg.path, `node_modules/${pkg.name}`);
});

archive.pipe(outstream);
archive.finalize();
