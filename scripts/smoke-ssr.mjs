import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const port = await new Promise((resolve, reject) => {
  const listener = createServer();
  listener.once('error', reject);
  listener.listen(0, '127.0.0.1', () => {
    const address = listener.address();
    if (!address || typeof address === 'string') {
      reject(new Error('Could not allocate an SSR test port'));
      listener.close();
      return;
    }
    listener.close((error) => error ? reject(error) : resolve(address.port));
  });
});

const server = spawn(process.execPath, ['dist/angular19/server/server.mjs'], {
  env: { ...process.env, PORT: String(port), NG_ALLOWED_HOSTS: '127.0.0.1,localhost' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let stderr = '';
server.stderr.on('data', (data) => { stderr += data.toString(); });

try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('SSR server did not start in time')), 30000);
    server.once('error', (error) => { clearTimeout(timeout); reject(error); });
    server.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`SSR server exited with code ${code}: ${stderr}`));
    });
    server.stdout.on('data', (data) => {
      if (data.toString().includes('server listening')) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  for (const [path, expected] of [
    ['/home', 'ng-server-context'],
    ['/profile', 'Perfil'],
    ['/i18n/es.json', '"settings.profile"'],
  ]) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    const body = await response.text();
    if (!response.ok || !body.includes(expected)) {
      throw new Error(`SSR smoke test failed for ${path}: HTTP ${response.status}, missing ${expected}`);
    }
    console.log(`${path}: HTTP ${response.status}, expected content present`);
  }
  if (stderr) {
    throw new Error(`SSR server wrote to stderr: ${stderr}`);
  }
} finally {
  server.kill();
}
