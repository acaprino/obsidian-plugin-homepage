import esbuild from 'esbuild';
import builtinModules from 'builtin-modules';

const watch = process.argv.includes('--watch');

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian', 'electron', ...builtinModules],
  format: 'cjs',
  target: 'es2018',
  logLevel: 'info',
  sourcemap: 'inline',
  treeShaking: true,
  outfile: 'main.js',
});

if (watch) {
  await context.watch();
  console.log('Watching...');
} else {
  await context.rebuild();
  await context.dispose();
}
