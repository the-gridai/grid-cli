import { Command } from 'commander';
import { spawn, execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

// Get the package root directory
function getPackageRoot(): string {
  // Get the directory of this file
  const currentDir = dirname(fileURLToPath(import.meta.url));
  
  // When running from dist: dist/src/cli/commands/ui/index.js
  // Go up: ui -> commands -> cli -> src -> dist -> root (5 levels)
  // When running from src: src/cli/commands/ui/index.ts  
  // Go up: ui -> commands -> cli -> src -> root (4 levels)
  
  // Check if we're in dist by looking for /dist/ in path
  if (currentDir.includes('/dist/')) {
    return join(currentDir, '..', '..', '..', '..', '..');
  }
  
  // Running from src
  return join(currentDir, '..', '..', '..', '..');
}

function getDashboardPath(): string {
  const root = getPackageRoot();
  return join(root, 'packages', 'strategy-dashboard');
}

export const uiCommand = new Command('ui')
  .description('Launch the Strategy Config Dashboard web UI')
  .option('-p, --port <port>', 'Port to serve on', '5174')
  .option('--control-api <url>', 'Control API URL (default: http://localhost:8092)')
  .option('--dev', 'Run in development mode with hot reload')
  .option('--build', 'Force rebuild before serving')
  .action(async (options) => {
    const dashboardPath = getDashboardPath();
    
    // Check if dashboard package exists
    if (!existsSync(join(dashboardPath, 'package.json'))) {
      console.error(chalk.red('Error: Strategy dashboard package not found at:'));
      console.error(chalk.gray(dashboardPath));
      console.error(chalk.yellow('\nMake sure you have the dashboard installed in packages/strategy-dashboard/'));
      process.exit(1);
    }

    const controlApiUrl = options.controlApi || process.env.VITE_CONTROL_API_URL || 'http://localhost:8092';
    const port = options.port;

    console.log(chalk.blue('Strategy Config Dashboard'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(chalk.gray('Dashboard path:'), dashboardPath);
    console.log(chalk.gray('Control API:'), controlApiUrl);
    console.log(chalk.gray('Port:'), port);
    console.log();

    // Check if node_modules exists, if not run npm install
    if (!existsSync(join(dashboardPath, 'node_modules'))) {
      console.log(chalk.yellow('Installing dashboard dependencies...'));
      try {
        execSync('npm install', { 
          cwd: dashboardPath, 
          stdio: 'inherit',
          env: { ...process.env }
        });
      } catch {
        console.error(chalk.red('Failed to install dependencies'));
        process.exit(1);
      }
    }

    if (options.dev) {
      // Development mode - run vite dev server
      console.log(chalk.green('Starting development server...'));
      console.log(chalk.gray('Press Ctrl+C to stop\n'));
      
      const child = spawn('npm', ['run', 'dev'], {
        cwd: dashboardPath,
        stdio: 'inherit',
        shell: true,
        env: {
          ...process.env,
          VITE_CONTROL_API_URL: controlApiUrl,
        }
      });

      child.on('error', (err) => {
        console.error(chalk.red('Failed to start dev server:'), err.message);
        process.exit(1);
      });

      // Handle process termination
      process.on('SIGINT', () => {
        child.kill('SIGINT');
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        child.kill('SIGTERM');
        process.exit(0);
      });

    } else {
      // Production mode - build and serve
      const distPath = join(dashboardPath, 'dist');
      
      // Build if dist doesn't exist or --build flag is set
      if (!existsSync(distPath) || options.build) {
        console.log(chalk.yellow('Building dashboard...'));
        try {
          execSync('npm run build', { 
            cwd: dashboardPath, 
            stdio: 'inherit',
            env: {
              ...process.env,
              VITE_CONTROL_API_URL: controlApiUrl,
            }
          });
        } catch {
          console.error(chalk.red('Failed to build dashboard'));
          process.exit(1);
        }
      }

      // Serve using vite preview
      console.log(chalk.green(`Starting dashboard on http://localhost:${port}`));
      console.log(chalk.gray('Press Ctrl+C to stop\n'));

      const child = spawn('npm', ['run', 'preview', '--', '--port', port], {
        cwd: dashboardPath,
        stdio: 'inherit',
        shell: true,
        env: {
          ...process.env,
          VITE_CONTROL_API_URL: controlApiUrl,
        }
      });

      child.on('error', (err) => {
        console.error(chalk.red('Failed to start server:'), err.message);
        process.exit(1);
      });

      // Handle process termination
      process.on('SIGINT', () => {
        child.kill('SIGINT');
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        child.kill('SIGTERM');
        process.exit(0);
      });
    }
  });
