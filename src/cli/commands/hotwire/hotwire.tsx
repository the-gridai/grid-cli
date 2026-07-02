/**
 * HOTWIRE - Grid Neural AI Interface
 * 
 * Metallic, polished AI chat experience
 */

import React from 'react';
import { render } from 'ink';
import { ResponsesClient } from '../../../sdk/responses/client';
import { ApiClient } from '../../../sdk/http/client';
import { logger } from '../../../core/logging/logger';
import { getConsumptionConfig } from '../../../core/config/profiles';
import { HotwireStreamView } from '../../ui/views/HotwireStreamView';
import type { Item, Session } from '../../../sdk/responses/types';
import fs from 'fs';
import { hotwireBanner, getRandomTagline } from '../../ui/hotwire/theme';

// Default system prompt for Hotwire
const DEFAULT_HOTWIRE_INSTRUCTIONS = `You are Hotwire, a helpful AI assistant. You provide clear, accurate, and thoughtful responses. Be concise but thorough.`;

// Auto-fund: try to transfer from trading account when balance is insufficient
async function tryAutoFund(model: string, amount: number): Promise<boolean> {
  try {
    // Extract instrument from model name (e.g., "fast-inference" -> "FAST-INFERENCE")
    const instrument = model.toUpperCase();
    
    console.log(`\x1b[38;5;220m◆ Auto-funding: Transferring ${amount} ${instrument} from trading account...\x1b[0m`);
    
    const apiClient = ApiClient.getInstance();
    await apiClient.transferToConsumption(instrument, amount);
    
    console.log(`\x1b[38;5;82m✓ Successfully transferred ${amount} ${instrument} to consumption account\x1b[0m`);
    return true;
  } catch (error: any) {
    console.log(`\x1b[38;5;203m✗ Auto-fund failed: ${error.message}\x1b[0m`);
    console.log(`\x1b[38;5;245m  Try: grid consumption transfer --instrument <INSTRUMENT> --quantity <N> --to-consumption\x1b[0m`);
    return false;
  }
}

// Generate the intro banner with metallic gradient and tagline
function getHotwireBanner(): string {
  const tagline = getRandomTagline();
  const taglineLength = tagline.length;
  const padding = Math.max(0, Math.floor((58 - taglineLength) / 2));
  
  return `
${hotwireBanner}
\x1b[38;5;245m${' '.repeat(padding)}${tagline}\x1b[0m
`;
}

interface HotwireOptions {
  spec?: string;
  instructions?: string;
  turns?: string;
  tools?: string;
  stream?: boolean;
  temperature?: string;
  maxTokens?: string;
  save?: string;
  resume?: string;
  autoFund?: boolean;
  autoFundAmount?: string;
}

export async function hotwireCommand(prompt: string | undefined, options: HotwireOptions): Promise<void> {
  // Determine mode: interactive if no prompt or resuming a session
  const isInteractive = (!prompt && !options.resume) || !!options.resume;
  
  // Show banner for interactive mode
  if (isInteractive && process.stdin.isTTY) {
    console.log(getHotwireBanner());
  }

  // Load consumption config from profile
  const consumptionConfig = getConsumptionConfig();
  
  // Resolve spec: CLI options > profile default > session
  const spec = options.spec || consumptionConfig.default_spec;
  
  if (!spec && !options.resume) {
    console.log('\x1b[38;5;203m✗ Spec required\x1b[0m');
    console.log('\x1b[38;5;245mUsage: grid hotwire -s <spec> "Your message"\x1b[0m');
    console.log('\x1b[38;5;245mOr set default: grid profile set <name> --consumption.default_spec fast-inference\x1b[0m');
    console.log('\x1b[38;5;245mList specs: grid consumption models\x1b[0m');
    return;
  }

  const client = ResponsesClient.getInstance();

  let session: Session | undefined;
  if (options.resume) {
    try {
      const data = fs.readFileSync(options.resume, 'utf-8');
      const saved = JSON.parse(data);
      session = saved.session;
      logger.info('Session restored', { id: session?.id, turns: session?.turn });
      console.log(`\x1b[38;5;220m◆ Session restored: ${session?.id}\x1b[0m`);
    } catch (error: any) {
      console.log(`\x1b[38;5;203m✗ Failed to restore session: ${error.message}\x1b[0m`);
      return;
    }
  }

  // Resolve options: CLI > profile defaults
  const maxTurns = options.turns ? parseInt(options.turns, 10) : undefined;
  const temperature = options.temperature 
    ? parseFloat(options.temperature) 
    : consumptionConfig.default_temperature;
  const maxTokens = options.maxTokens 
    ? parseInt(options.maxTokens, 10) 
    : consumptionConfig.default_max_tokens;
  const shouldStream = options.stream !== false;
  const instructions = options.instructions || consumptionConfig.default_instructions || DEFAULT_HOTWIRE_INSTRUCTIONS;
  const autoFund = options.autoFund ?? consumptionConfig.auto_fund;
  const autoFundAmount = options.autoFundAmount 
    ? parseInt(options.autoFundAmount, 10) 
    : (consumptionConfig.auto_fund_amount ?? 1000);

  const items: Item[] = session?.items || [];
  if (prompt && !session) {
    items.push({
      type: 'message',
      role: 'user',
      content: prompt,
    });
  }

  // Non-interactive print mode (default when prompt provided)
  // If interactive requested but no TTY, show helpful message
  if (isInteractive && !process.stdin.isTTY) {
    console.log('\x1b[38;5;220m⚠ Interactive mode requires a TTY terminal.\x1b[0m');
    console.log('\x1b[38;5;245m  Run this command in an interactive terminal, not through pipes or scripts.\x1b[0m');
    console.log('');
    console.log('\x1b[38;5;245m  Use non-interactive mode instead:\x1b[0m');
    console.log('\x1b[38;5;39m    grid hotwire "Your question here"\x1b[0m');
    return;
  }
  
  if (!isInteractive || !process.stdin.isTTY) {
    await runPrintMode(client, {
      model: spec || session?.model || '',
      items,
      instructions,
      maxTurns,
      temperature,
      maxTokens,
      shouldStream,
      saveFile: options.save,
      autoFund,
      autoFundAmount,
    });
    return;
  }

  // Interactive mode (with -i flag or no prompt)
  const { waitUntilExit } = render(
    <HotwireStreamView
      client={client}
      initialItems={items}
      model={spec || session?.model || ''}
      instructions={instructions}
      maxTurns={maxTurns}
      temperature={temperature}
      maxTokens={maxTokens}
      saveFile={options.save}
      session={session}
      autoFund={autoFund}
      autoFundAmount={autoFundAmount}
    />
  );
  
  await waitUntilExit();
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
  autoFund?: boolean;
  autoFundAmount?: number;
}

async function runPrintMode(client: ResponsesClient, opts: PrintModeOpts, retried = false): Promise<void> {
  try {
    if (opts.shouldStream) {
      let tokenCount = 0;
      const startTime = Date.now();
      let firstTokenTime = 0;
      
      for await (const event of client.stream({
        model: opts.model,
        input: opts.items,
        instructions: opts.instructions,
        max_turns: opts.maxTurns ?? 1,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        stream: true,
      })) {
        if (event.type === 'response.item.delta' && event.delta.content) {
          if (firstTokenTime === 0) {
            firstTokenTime = Date.now();
          }
          process.stdout.write(event.delta.content);
          tokenCount++;
        } else if (event.type === 'error') {
          // Check for 402 and try auto-fund
          const is402 = event.error.message?.includes('402');
          if (is402 && opts.autoFund && !retried) {
            console.log('\x1b[38;5;220m◆ Insufficient balance detected\x1b[0m');
            const funded = await tryAutoFund(opts.model, opts.autoFundAmount || 1000);
            if (funded) {
              return runPrintMode(client, opts, true);
            }
          }
          console.error('\n\x1b[38;5;203m✗ ' + event.error.message + '\x1b[0m');
          process.exit(1);
        } else if (event.type === 'response.done') {
          const elapsed = (Date.now() - startTime) / 1000;
          const ttft = firstTokenTime > 0 ? firstTokenTime - startTime : 0;
          const usage = event.response.usage;
          console.log('');
          if (usage) {
            const ttftStr = ttft > 0 ? `${ttft}ms ttft │ ` : '';
            console.log(`\x1b[38;5;245m─── ${ttftStr}${usage.completion_tokens} tokens │ ${(usage.completion_tokens / elapsed).toFixed(1)} tok/s │ ${elapsed.toFixed(1)}s ───\x1b[0m`);
          }
          
          if (opts.saveFile) {
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
      const response = await client.create({
        model: opts.model,
        input: opts.items,
        instructions: opts.instructions,
        max_turns: opts.maxTurns ?? 1,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        stream: false,
      });
      
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
    // Check for 402 (Payment Required / Insufficient Balance)
    const is402 = error.message?.includes('402') || 
                  error.response?.status === 402 || 
                  error.statusCode === 402;
    
    if (is402 && opts.autoFund && !retried) {
      console.log('\x1b[38;5;220m◆ Insufficient balance detected\x1b[0m');
      const funded = await tryAutoFund(opts.model, opts.autoFundAmount || 1000);
      if (funded) {
        // Retry the request
        return runPrintMode(client, opts, true);
      }
    }
    
    console.error('\x1b[38;5;203m✗ ' + error.message + '\x1b[0m');
    process.exit(1);
  }
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
  console.log(`\x1b[38;5;220m◆ Session saved: ${filename}\x1b[0m`);
}
