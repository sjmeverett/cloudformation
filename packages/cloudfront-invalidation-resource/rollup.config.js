import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default {
  input: 'src/Lambda.ts',
  output: {
    dir: 'dist',
    format: 'cjs',
  },
  plugins: [
    resolve({ preferBuiltins: true }),
    commonjs(),
    json(),
    typescript(),
  ],
  external: ['aws-sdk', 'unzipper'],
};
