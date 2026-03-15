const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.join(rootDir, 'src', 'frontend');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const apiPort = Number.parseInt(process.env.API_PORT ?? '3001', 10);
const apiBaseUrl = `http://localhost:${apiPort}`;

function waitForApiHealth(maxAttempts = 60, delayMs = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const check = () => {
      attempts += 1;

      const req = http.get(`${apiBaseUrl}/api/health`, (res) => {
        if (res.statusCode === 200) {
          res.resume();
          resolve();
          return;
        }

        res.resume();
        if (attempts >= maxAttempts) {
          reject(new Error('API did not become healthy in time.'));
          return;
        }

        setTimeout(check, delayMs);
      });

      req.on('error', () => {
        if (attempts >= maxAttempts) {
          reject(new Error('API did not become healthy in time.'));
          return;
        }
        setTimeout(check, delayMs);
      });

      req.setTimeout(1000, () => {
        req.destroy();
      });
    };

    check();
  });
}

function checkApiHealthOnce() {
  return new Promise((resolve) => {
    const req = http.get(`${apiBaseUrl}/api/health`, (res) => {
      const healthy = res.statusCode === 200;
      res.resume();
      resolve(healthy);
    });

    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function startProcess(command, args, cwd, env = process.env) {
  return spawn(command, args, {
    cwd,
    stdio: 'inherit',
    env,
  });
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage: npm run dashboard');
    console.log('Starts backend API (if needed), waits for /api/health, then starts frontend dev server.');
    return;
  }

  let apiProcess = null;
  const apiAlreadyRunning = await checkApiHealthOnce();

  if (apiAlreadyRunning) {
    console.log('[dashboard] API already healthy. Reusing existing backend.');
  } else {
    console.log('[dashboard] Starting API...');
    apiProcess = startProcess(npmCmd, ['run', 'api'], rootDir, {
      ...process.env,
      PORT: String(apiPort),
    });
  }

  const shutdown = () => {
    if (apiProcess && !apiProcess.killed) {
      apiProcess.kill('SIGINT');
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  if (apiProcess) {
    apiProcess.on('exit', (code) => {
      if (code !== 0) {
        console.error(`[dashboard] API exited with code ${code}.`);
        process.exit(code || 1);
      }
    });
  }

  try {
    console.log(`[dashboard] Waiting for API health at ${apiBaseUrl}/api/health...`);
    await waitForApiHealth();
    console.log('[dashboard] API is healthy. Starting frontend dev server...');

    const frontendProcess = startProcess(npmCmd, ['run', 'dev'], frontendDir, {
      ...process.env,
      API_PROXY_TARGET: process.env.API_PROXY_TARGET ?? apiBaseUrl,
    });

    frontendProcess.on('exit', (code) => {
      shutdown();
      process.exit(code || 0);
    });
  } catch (err) {
    console.error(`[dashboard] ${err.message}`);
    shutdown();
    process.exit(1);
  }
}

main();
