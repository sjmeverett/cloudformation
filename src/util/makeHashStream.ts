import stream from 'stream';
import crypto from 'crypto';

export function makeHashStream(cb: (hash: string) => void): stream.Transform {
  const hash = crypto.createHash('sha1');

  const tx = new stream.Transform({
    transform: (chunk, _encoding, callback): void => {
      hash.update(chunk);
      callback(undefined, chunk);
    },
  });

  tx.once('end', () => {
    cb(hash.digest('hex'));
  });

  return tx;
}
