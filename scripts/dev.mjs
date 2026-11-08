import { spawn } from 'node:child_process';

const children = [];

function run(name, cmd, args) {
  const child = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  child.on('exit', (code) => {
    console.log(`[dev] ${name} exited ${code ?? 0}`);
    if (name === 'vite') shutdown();
  });
  children.push(child);
}

function shutdown() {
  for (const c of children) {
    if (!c.killed) c.kill('SIGTERM');
  }
  setTimeout(() => process.exit(0), 300);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Bundle once, then run. The shared board JSON and rules travel with it.
const build = spawn(process.execPath, ['scripts/build-server.mjs'], { stdio: 'inherit' });
build.on('exit', (code) => {
  if (code !== 0) {
    console.error('[dev] server bundle failed');
    process.exit(code ?? 1);
  }
  run('server', process.execPath, ['dist-server/index.js']);
  run('vite', process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--host', '127.0.0.1', '--port', '5173']);
});
