const esbuild = require('esbuild');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {esbuild.BuildOptions}
 */
const extensionConfig = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node16',
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
};

/**
 * @type {esbuild.BuildOptions}
 */
const webviewConfig = {
  entryPoints: ['webview/main.ts'],
  bundle: true,
  outfile: 'dist/webview.js',
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
};

/**
 * @type {esbuild.BuildOptions}
 */
const workerConfig = {
  entryPoints: ['src/workers/rgWorker.ts'],
  bundle: true,
  outfile: 'dist/rgWorker.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node16',
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
};

async function build() {
  try {
    if (watch) {
      const extensionContext = await esbuild.context(extensionConfig);
      const webviewContext = await esbuild.context(webviewConfig);
      const workerContext = await esbuild.context(workerConfig);
      
      await Promise.all([
        extensionContext.watch(),
        webviewContext.watch(),
        workerContext.watch(),
      ]);
      
      console.log('Watching for changes...');
    } else {
      await Promise.all([
        esbuild.build(extensionConfig),
        esbuild.build(webviewConfig),
        esbuild.build(workerConfig),
      ]);
      
      console.log('Build complete!');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
