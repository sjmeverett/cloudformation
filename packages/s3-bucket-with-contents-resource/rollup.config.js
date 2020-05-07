import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default {
  input: 'dist/Lambda.js',
  output: {
    dir: 'build',
    format: 'cjs',
  },
  plugins: [resolve({ preferBuiltins: true }), commonjs(), json()],
  external: ['aws-sdk', 'unzipper'],
};
