const archiver = require('archiver');
const { createWriteStream } = require('fs');

const outdir = 'build/cloudfront-invalidation-resource.zip';

const outstream = createWriteStream(outdir);

const archive = archiver('zip', { zlib: { level: 9 } });

archive.file('build/Lambda.js', { name: 'index.js' });

archive.pipe(outstream);
archive.finalize();
