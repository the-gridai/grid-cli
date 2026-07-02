import React from 'react';
import { Command } from 'commander';
import { render } from 'ink';
import { ResponsesClient } from '../../../sdk/responses/client';
import { logger } from '../../../core/logging/logger';
import { ConsumptionModelsView } from '../../ui/views/ConsumptionModelsView';

export const modelsCommand = new Command('models')
  .alias('specs')
  .description('List available inference specs (models)')
  .option('--verbose', 'Show detailed spec information')
  .action(async (options: { verbose?: boolean }) => {
    const client = ResponsesClient.getInstance();
    
    try {
      const models = await client.listModels();
      
      const { waitUntilExit } = render(
        <ConsumptionModelsView 
          models={models} 
          verbose={options.verbose}
        />
      );
      await waitUntilExit();
      
    } catch (error: any) {
      logger.error('Failed to list models', { error: error.message });
      const { waitUntilExit } = render(
        <ConsumptionModelsView 
          models={[]} 
          error={error.message}
        />
      );
      await waitUntilExit();
    }
  });
