import esbuild from 'esbuild';
import builtinModules from 'builtin-modules';

const watch = process.argv.includes('--watch');

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian', 'electron', ...builtinModules],
  format: 'cjs',
  target: 'es2022',
  logLevel: 'info',
  sourcemap: watch ? 'inline' : false,
  treeShaking: true,
  drop: watch ? [] : ['debugger'],
  // Mark verbose console calls as pure so esbuild can tree-shake them out of production.
  // Keep console.error and console.warn — those surface genuine problems the user needs to see in devtools.
  pure: watch ? [] : ['console.debug', 'console.log', 'console.info', 'console.trace'],
  outfile: 'main.js',
});

if (watch) {
  await context.watch();
  console.log('Watching...');
} else {
  await context.rebuild();
  await context.dispose();
}
