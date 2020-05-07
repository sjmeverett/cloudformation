const archiver = require('archiver');
const { createWriteStream } = require('fs');

const outdir = 'dist/cloudfront-invalidation-resource.zip';

const outstream = createWriteStream(outdir);

const archive = archiver('zip', { zlib: { level: 9 } });

archive.file('dist/Lambda.js', { name: 'index.js' });

archive.pipe(outstream);
archive.finalize();
