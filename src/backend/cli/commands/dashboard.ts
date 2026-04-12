import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { Argv } from 'yargs';
import { EXIT_FAILURE } from '../constants';

export function buildDashboardCommand(y: Argv): Argv {
  return y
    .option('port', {
      type: 'number',
      default: 3001,
      describe: 'Port to serve the dashboard on',
    })
    .option('no-open', {
      type: 'boolean',
      default: false,
      describe: 'Start the server without opening a browser tab',
    });
}

export async function handleDashboardCommand(argv: any): Promise<void> {
  const { execSync, spawn } = await import('child_process');
  const distPath = path.resolve('src/frontend/dist/index.html');

  if (!fs.existsSync(distPath)) {
    console.log(chalk.dim('Building frontend...'));
    try {
      execSync('npm run build:frontend', { stdio: 'inherit' });
    } catch {
      console.error(chalk.red('Frontend build failed.'));
      process.exit(EXIT_FAILURE);
    }
  }

  const port = argv.port;
  process.env.PORT = String(port);

  process.on('SIGINT', () => {
    console.log(chalk.dim('\nDashboard stopped.'));
    process.exit(0);
  });

  // Start the API server in-process, already in ts-node
  const { buildApp } = await import('../../api/server');
  const app = await buildApp();
  try {
    await app.listen({ port, host: '0.0.0.0' });
  } catch (err: any) {
    if (err.code === 'EADDRINUSE') {
      console.error(
        chalk.red(
          `Port ${port} is already in use. Stop the existing server or run with --port <n>.`,
        ),
      );
      process.exit(EXIT_FAILURE);
    }
    throw err;
  }

  const url = `http://localhost:${port}`;
  console.log(chalk.green(`Dashboard running at ${url}`));

  if (!argv['no-open']) {
    const opener =
      process.platform === 'darwin'
        ? 'open'
        : process.platform === 'win32'
          ? 'start'
          : 'xdg-open';
    spawn(opener, [url], { detached: true, stdio: 'ignore' });
  }
}
