import { Command } from 'commander';
import chalk from 'chalk';
import { getVersion, setVersion, bumpVersion } from '../../../core/version';

export const versionCommand = new Command('version')
  .description('Show or bump the version')
  .argument('[newVersion]', 'New version to set (e.g., 0.5.1)')
  .option('--patch', 'Bump patch version (0.0.x)')
  .option('--minor', 'Bump minor version (0.x.0)')
  .option('--major', 'Bump major version (x.0.0)')
  .action((newVersion: string | undefined, options: { patch?: boolean; minor?: boolean; major?: boolean }) => {
    const currentVersion = getVersion();
    
    if (!newVersion && !options.patch && !options.minor && !options.major) {
      // Just show current version
      console.log(chalk.bold(`\ngrid-cli v${currentVersion}\n`));
      return;
    }
    
    try {
      let targetVersion: string;
      
      if (newVersion) {
        targetVersion = setVersion(newVersion);
      } else if (options.major) {
        targetVersion = bumpVersion('major');
      } else if (options.minor) {
        targetVersion = bumpVersion('minor');
      } else {
        targetVersion = bumpVersion('patch');
      }
      
      console.log(chalk.green(`\n✓ Version updated: ${currentVersion} → ${targetVersion}\n`));
      console.log(chalk.dim('Don\'t forget to rebuild: grid dev build'));
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });
