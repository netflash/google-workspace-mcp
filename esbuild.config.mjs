import * as esbuild from 'esbuild';
import path from 'path';

const isProduction = process.env.NODE_ENV === 'production';
const isWatch = process.argv.includes('--watch');

const jsoncParserAlias = {
  name: 'jsonc-parser-esm',
  setup(build) {
    build.onResolve({ filter: /^jsonc-parser$/ }, () => ({
      path: path.resolve('node_modules/jsonc-parser/lib/esm/main.js'),
    }));
  },
};

const extensionBuild = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  external: ['vscode'],
  plugins: [jsoncParserAlias],
  sourcemap: true,
  minify: isProduction,
};

const serverBuild = {
  entryPoints: ['src/mcp/server.ts'],
  bundle: true,
  outfile: 'dist/mcp/server.js',
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  sourcemap: true,
  minify: isProduction,
  banner: { js: '#!/usr/bin/env node' },
};

if (isWatch) {
  const extCtx = await esbuild.context(extensionBuild);
  const srvCtx = await esbuild.context(serverBuild);
  await Promise.all([extCtx.watch(), srvCtx.watch()]);
  console.log('Watching for changes...');
} else {
  await Promise.all([
    esbuild.build(extensionBuild),
    esbuild.build(serverBuild),
  ]);
  console.log('Build complete.');
}
