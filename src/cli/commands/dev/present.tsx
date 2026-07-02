import { Command } from 'commander';
import { render, Box, Text } from 'ink';
import React from 'react';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { colors } from '../../ui/theme';
import { Header } from '../../ui/components';

// Get the project root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../../../..');
const presentationPath = path.join(projectRoot, 'docs', 'PRESENTATION.md');

interface PresentationTool {
  name: string;
  command: string;
  installInstructions: {
    macos?: string;
    linux?: string;
    cargo?: string;
    go?: string;
  };
}

const PRESENTATION_TOOLS: PresentationTool[] = [
  {
    name: 'mdp',
    command: 'mdp',
    installInstructions: {
      macos: 'brew install mdp',
      linux: 'sudo apt install mdp',
    },
  },
  {
    name: 'presenterm',
    command: 'presenterm',
    installInstructions: {
      cargo: 'cargo install presenterm',
    },
  },
  {
    name: 'patat',
    command: 'patat',
    installInstructions: {
      macos: 'brew install patat',
    },
  },
  {
    name: 'slides',
    command: 'slides',
    installInstructions: {
      go: 'go install github.com/maaslalani/slides@latest',
    },
  },
];

function commandExists(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function findPresentationTool(): PresentationTool | null {
  for (const tool of PRESENTATION_TOOLS) {
    if (commandExists(tool.command)) {
      return tool;
    }
  }
  return null;
}

interface NoToolViewProps {
  tools: PresentationTool[];
  presentationPath: string;
}

const NoToolView: React.FC<NoToolViewProps> = ({ tools, presentationPath }) => {
  return (
    <Box flexDirection="column" padding={1}>
      <Header title="PRESENTATION_" />
      <Box marginTop={1}>
        <Text color={colors.error}>No terminal presentation tool found!</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={colors.text}>Please install one of the following:</Text>
        <Box marginTop={1} flexDirection="column">
          {tools.map((tool) => (
            <Box key={tool.name} flexDirection="column" marginBottom={1}>
              <Text color={colors.primary} bold>  {tool.name}</Text>
              {tool.installInstructions.macos && (
                <Text color={colors.textMuted}>    macOS: {tool.installInstructions.macos}</Text>
              )}
              {tool.installInstructions.linux && (
                <Text color={colors.textMuted}>    Linux: {tool.installInstructions.linux}</Text>
              )}
              {tool.installInstructions.cargo && (
                <Text color={colors.textMuted}>    Cargo: {tool.installInstructions.cargo}</Text>
              )}
              {tool.installInstructions.go && (
                <Text color={colors.textMuted}>    Go:    {tool.installInstructions.go}</Text>
              )}
            </Box>
          ))}
        </Box>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={colors.textMuted}>Alternatively, view the presentation with:</Text>
        <Text color={colors.accent}>  less {presentationPath}</Text>
      </Box>
    </Box>
  );
};

interface LaunchingViewProps {
  toolName: string;
}

const LaunchingView: React.FC<LaunchingViewProps> = ({ toolName }) => {
  return (
    <Box flexDirection="column" padding={1}>
      <Header title="PRESENTATION_" />
      <Box marginTop={1}>
        <Text color={colors.success}>Launching presentation with </Text>
        <Text color={colors.primary} bold>{toolName}</Text>
        <Text color={colors.success}>...</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={colors.textMuted}>Controls: Space/Enter = next, b/p = back, q = quit</Text>
      </Box>
    </Box>
  );
};

export const presentCommand = new Command('present')
  .description('Launch the Grid CLI presentation (Kpop Daemon hunter and the grid-cli)')
  .option('--list', 'List available presentation tools')
  .option('--path', 'Show the presentation file path')
  .action(async (options) => {
    // Check if presentation file exists
    if (!fs.existsSync(presentationPath)) {
      console.error(`Presentation file not found at: ${presentationPath}`);
      console.error('Make sure you are running from the grid-cli project directory.');
      process.exit(1);
    }

    // Show path option
    if (options.path) {
      console.log(presentationPath);
      return;
    }

    // List tools option
    if (options.list) {
      console.log('\nAvailable presentation tools:\n');
      for (const tool of PRESENTATION_TOOLS) {
        const installed = commandExists(tool.command);
        const status = installed ? '✓ installed' : '✗ not found';
        const color = installed ? '\x1b[32m' : '\x1b[31m';
        console.log(`  ${color}${status}\x1b[0m  ${tool.name}`);
      }
      console.log('');
      return;
    }

    // Find a presentation tool
    const tool = findPresentationTool();

    if (!tool) {
      const { unmount, waitUntilExit } = render(
        <NoToolView tools={PRESENTATION_TOOLS} presentationPath={presentationPath} />
      );
      await waitUntilExit();
      unmount();
      process.exit(1);
    }

    // Show launching message
    const { unmount } = render(<LaunchingView toolName={tool.name} />);
    
    // Small delay to show the message
    await new Promise(resolve => setTimeout(resolve, 500));
    unmount();

    // Launch the presentation tool
    const child = spawn(tool.command, [presentationPath], {
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      process.exit(code ?? 0);
    });

    child.on('error', (err) => {
      console.error(`Failed to launch ${tool.name}:`, err.message);
      process.exit(1);
    });
  });
