import { Command } from 'commander';
import chalk from 'chalk';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { findGridCliRoot } from '../../../core/version';

function runCommand(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(chalk.dim(`$ ${command} ${args.join(' ')}`));
    
    const proc = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: true,
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command exited with code ${code}`));
      }
    });
    
    proc.on('error', reject);
  });
}

export const buildCommand = new Command('build')
  .description('Rebuild the grid-cli binary')
  .option('--clean', 'Clean dist directory before building')
  .option('--watch', 'Watch for changes and rebuild automatically')
  .action(async (options: { clean?: boolean; watch?: boolean }) => {
    const rootDir = findGridCliRoot();
    
    console.log(chalk.bold('\n🔨 Building grid-cli...\n'));
    console.log(chalk.dim(`Root: ${rootDir}`));
    console.log('');
    
    try {
      if (options.clean) {
        console.log(chalk.yellow('Cleaning dist directory...'));
        const distPath = path.join(rootDir, 'dist');
        if (fs.existsSync(distPath)) {
          fs.rmSync(distPath, { recursive: true });
        }
        console.log(chalk.green('✓ Cleaned dist directory'));
        console.log('');
      }
      
      if (options.watch) {
        console.log(chalk.cyan('Starting watch mode...'));
        console.log(chalk.dim('Press Ctrl+C to stop\n'));
        await runCommand('npm', ['run', 'watch'], rootDir);
      } else {
        console.log(chalk.cyan('Compiling TypeScript...'));
        await runCommand('npm', ['run', 'build'], rootDir);
        console.log('');
        console.log(chalk.green('✓ Build complete!'));
        console.log('');
        console.log(chalk.dim('Binary location: ./bin/grid'));
        console.log(chalk.dim('To test: ./bin/grid --version'));
      }
    } catch (error) {
      console.error('');
      console.error(chalk.red('✗ Build failed'));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });
