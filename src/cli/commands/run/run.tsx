import React from 'react';
import { render } from 'ink';
import { ResponsesClient } from '../../../sdk/responses/client';
import { logger } from '../../../core/logging/logger';
import { RunView } from '../../ui/views/RunView';
import { RunStreamView } from '../../ui/views/RunStreamView';
import type { CreateResponseRequest, Item, Session } from '../../../sdk/responses/types';
import fs from 'fs';

interface RunOptions {
  model?: string;
  instructions?: string;
  turns?: string;
  tools?: string;
  stream?: boolean;
  print?: boolean;
  temperature?: string;
  maxTokens?: string;
  save?: string;
  resume?: string;
}

export async function runCommand(prompt: string | undefined, options: RunOptions): Promise<void> {
  if (!options.model && !options.resume) {
    const { waitUntilExit } = render(
      <RunView 
        error="Model is required. Use --model or -m to specify a model."
        hint={'Example: grid run -m llama-3.1-70b "Your prompt here"'}
      />
    );
    await waitUntilExit();
    return;
  }

  const client = ResponsesClient.getInstance();

  let session: Session | undefined;
  if (options.resume) {
    try {
      const data = fs.readFileSync(options.resume, 'utf-8');
      const saved = JSON.parse(data);
      session = saved.session;
      logger.info('Resumed session', { id: session?.id, turns: session?.turn });
    } catch (error: any) {
      const { waitUntilExit } = render(
        <RunView error={`Failed to resume session: ${error.message}`} />
      );
      await waitUntilExit();
      return;
    }
  }

  const maxTurns = options.turns ? parseInt(options.turns, 10) : undefined;
  const temperature = options.temperature ? parseFloat(options.temperature) : undefined;
  const maxTokens = options.maxTokens ? parseInt(options.maxTokens, 10) : undefined;
  const shouldStream = options.stream !== false;

  const items: Item[] = session?.items || [];
  if (prompt && !session) {
    items.push({
      type: 'message',
      role: 'user',
      content: prompt,
    });
  }

  if (options.print || !process.stdin.isTTY) {
    await runPrintMode(client, {
      model: options.model || session?.model || '',
      items,
      instructions: options.instructions,
      maxTurns,
      temperature,
      maxTokens,
      shouldStream,
      saveFile: options.save,
    });
    return;
  }

  await runInteractiveMode(client, {
    model: options.model || session?.model || '',
    items,
    instructions: options.instructions,
    maxTurns,
    temperature,
    maxTokens,
    shouldStream,
    saveFile: options.save,
    session,
  });
}

interface PrintModeOpts {
  model: string;
  items: Item[];
  instructions?: string;
  maxTurns?: number;
  temperature?: number;
  maxTokens?: number;
  shouldStream: boolean;
  saveFile?: string;
}

async function runPrintMode(client: ResponsesClient, opts: PrintModeOpts): Promise<void> {
  const request: CreateResponseRequest = {
    model: opts.model,
    input: opts.items,
    instructions: opts.instructions,
    max_turns: opts.maxTurns ?? 1,
    temperature: opts.temperature,
    max_tokens: opts.maxTokens,
    stream: opts.shouldStream,
  };

  try {
    if (opts.shouldStream) {
      for await (const event of client.stream(request)) {
        if (event.type === 'response.item.delta' && event.delta.content) {
          process.stdout.write(event.delta.content);
        } else if (event.type === 'error') {
          console.error('\nError: ' + event.error.message);
        } else if (event.type === 'response.done') {
          console.log('');
          if (opts.saveFile && event.response) {
            saveSession(opts.saveFile, {
              id: event.response.id,
              model: event.response.model,
              items: [...opts.items, ...event.response.items],
              turn: 1,
              created: event.response.created,
              updated: event.response.created,
              status: 'completed',
            });
          }
        }
      }
    } else {
      const response = await client.create(request);
      for (const item of response.items) {
        if (item.type === 'message' && item.role === 'assistant') {
          console.log(item.content);
        }
      }
      if (opts.saveFile) {
        saveSession(opts.saveFile, {
          id: response.id,
          model: response.model,
          items: [...opts.items, ...response.items],
          turn: 1,
          created: response.created,
          updated: response.created,
          status: 'completed',
        });
      }
    }
  } catch (error: any) {
    console.error('Error: ' + error.message);
    process.exit(1);
  }
}

interface InteractiveModeOpts {
  model: string;
  items: Item[];
  instructions?: string;
  maxTurns?: number;
  temperature?: number;
  maxTokens?: number;
  shouldStream: boolean;
  saveFile?: string;
  session?: Session;
}

async function runInteractiveMode(client: ResponsesClient, opts: InteractiveModeOpts): Promise<void> {
  const { waitUntilExit } = render(
    <RunStreamView
      client={client}
      initialItems={opts.items}
      model={opts.model}
      instructions={opts.instructions}
      maxTurns={opts.maxTurns}
      temperature={opts.temperature}
      maxTokens={opts.maxTokens}
      saveFile={opts.saveFile}
      session={opts.session}
    />
  );
  
  await waitUntilExit();
}

function saveSession(filename: string, session: Session): void {
  const data = {
    version: 1,
    session,
    metadata: {
      saved_at: new Date().toISOString(),
    },
  };
  
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  logger.info('Session saved', { filename });
}
