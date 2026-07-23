import { Command } from 'commander';
import { ResponsesClient } from '../../../sdk/responses/client';
import { logger } from '../../../core/logging/logger';
import type {
  UsageReceipt,
  ListUsageParams,
  UsageCostStatus,
  UsageSummaryAggregates,
  UsageSummaryParams,
} from '../../../sdk/responses/types';

const DIM = '\x1b[38;5;245m';
const CYAN = '\x1b[38;5;39m';
const GREEN = '\x1b[38;5;114m';
const YELLOW = '\x1b[38;5;220m';
const RED = '\x1b[38;5;203m';
const RESET = '\x1b[0m';

function costColor(status: string): string {
  switch (status) {
    case 'reconciled':
      return GREEN;
    case 'pending':
      return YELLOW;
    case 'unpriced':
    case 'cancelled':
      return DIM;
    default:
      return RED;
  }
}

function formatCost(receipt: UsageReceipt): string {
  const { cost } = receipt;
  const amount = cost.amount != null ? `$${cost.amount} ${cost.currency}` : '—';
  return `${costColor(cost.status)}${amount} (${cost.status})${RESET}`;
}

function printReceipt(receipt: UsageReceipt): void {
  const { usage, cost, timing } = receipt;
  console.log(`${CYAN}Request ${receipt.request_id}${RESET}`);
  console.log(`  status      ${receipt.status}`);
  console.log(`  model       ${receipt.requested_model ?? '—'} → ${receipt.serving_model ?? '—'}`);
  console.log(`  endpoint    ${receipt.endpoint ?? '—'}`);
  if (receipt.api_key_id) {
    console.log(`  api key     ${receipt.api_key_id}`);
  }
  console.log(`  created     ${receipt.created_at}`);
  console.log(
    `  tokens      in=${usage.input_tokens ?? '—'} out=${usage.output_tokens ?? '—'} total=${usage.total_tokens ?? '—'}`
  );
  console.log(`  cost        ${formatCost(receipt)}`);
  if (cost.effective_price_per_token != null) {
    console.log(`  price/tok   $${cost.effective_price_per_token}`);
  }
  if (cost.reconciled_at != null) {
    console.log(
      `  reconciled  ${cost.reconciled_at}${cost.metering_policy_version ? ` (${cost.metering_policy_version})` : ''}`
    );
  }
  if (timing.duration_ms != null || timing.ttft_ms != null) {
    const parts = [
      timing.ttft_ms != null ? `${timing.ttft_ms}ms ttft` : null,
      timing.tokens_per_second != null ? `${timing.tokens_per_second} tok/s` : null,
      timing.duration_ms != null ? `${timing.duration_ms}ms total` : null,
    ].filter(Boolean);
    console.log(`  timing      ${parts.join(' │ ')}`);
  }
  if (cost.breakdown && cost.breakdown.length > 0) {
    console.log(`  ${DIM}cost basis (per acquisition lot):${RESET}`);
    for (const draw of cost.breakdown) {
      const price = draw.acquisition_price_per_token != null ? `$${draw.acquisition_price_per_token}/tok` : 'unpriced';
      const subtotal = draw.subtotal != null ? ` = $${draw.subtotal}` : '';
      console.log(`    ${DIM}${draw.tokens} tokens @ ${price}${subtotal}${RESET}`);
    }
  }
}

function printListRow(receipt: UsageReceipt): void {
  const total = receipt.usage.total_tokens ?? '—';
  const model = receipt.requested_model ?? '—';
  console.log(
    `${DIM}${receipt.created_at}${RESET}  ${receipt.request_id}  ${model}  ${total} tok  ${formatCost(receipt)}`
  );
}

function printAggregates(label: string, aggregates: UsageSummaryAggregates): void {
  const { cost } = aggregates;
  const amount = cost.reconciled_amount != null ? `$${cost.reconciled_amount} ${cost.currency}` : '—';
  console.log(`${CYAN}${label}${RESET}`);
  console.log(`  requests    ${aggregates.request_count}`);
  console.log(
    `  tokens      in=${aggregates.input_tokens} out=${aggregates.output_tokens} total=${aggregates.total_tokens}`
  );
  console.log(`  spend       ${GREEN}${amount}${RESET} (${cost.reconciled_requests} reconciled)`);
  const caveats: string[] = [];
  if (cost.pending_requests > 0) caveats.push(`${cost.pending_requests} pending`);
  if (cost.unpriced_requests > 0) caveats.push(`${cost.unpriced_requests} unpriced (${cost.unpriced_tokens} tok)`);
  if (cost.cancelled_requests > 0) caveats.push(`${cost.cancelled_requests} cancelled`);
  if (caveats.length > 0) {
    console.log(`  ${YELLOW}note        ${caveats.join(' │ ')}${RESET}`);
  }
}

interface UsageOptions {
  json?: boolean;
  requestId?: string;
  from?: string;
  to?: string;
  status?: string;
  costStatus?: string;
  model?: string;
  apiKey?: string;
  orderBy?: string;
  orderDirection?: string;
  limit?: string;
  next?: string;
  prev?: string;
}

interface SummaryOptions {
  json?: boolean;
  from?: string;
  to?: string;
  groupBy?: string;
  apiKey?: string;
}

function mergeSummaryOptions(options: SummaryOptions, command: Command): SummaryOptions {
  const inherited = command.parent?.opts<UsageOptions>() ?? {};

  return {
    json: options.json ?? inherited.json,
    from: options.from ?? inherited.from,
    to: options.to ?? inherited.to,
    groupBy: options.groupBy,
    apiKey: options.apiKey ?? inherited.apiKey,
  };
}

const summaryCommand = new Command('summary')
  .description(
    'Aggregated usage and spend: totals plus optional day/model/api_key buckets. ' +
      'Defaults to the last 30 days; windows span at most 31 days per call.'
  )
  .option('--json', 'Output raw JSON')
  .option('--from <iso8601>', 'Window start (default: 30 days before --to; max span 31 days)')
  .option('--to <iso8601>', 'Window end (default: now)')
  .option('--group-by <dim>', 'day | model | api_key (top 100 buckets)')
  .option('--api-key <id>', 'Scope to one API key id')
  .action(async (options: SummaryOptions, command: Command) => {
    const client = ResponsesClient.getInstance();
    const summaryOptions = mergeSummaryOptions(options, command);

    try {
      const params: UsageSummaryParams = {
        from: summaryOptions.from,
        to: summaryOptions.to,
        group_by: summaryOptions.groupBy as UsageSummaryParams['group_by'],
        api_key_id: summaryOptions.apiKey,
      };
      const summary = await client.getUsageSummary(params);

      if (summaryOptions.json) {
        console.log(JSON.stringify(summary, null, 2));
        return;
      }

      printAggregates('Totals', summary.totals);
      for (const bucket of summary.buckets ?? []) {
        console.log('');
        printAggregates(bucket.key ?? '(no key)', bucket);
      }
      if (summary.totals.cost.pending_requests > 0) {
        console.log(`${DIM}Pending requests settle shortly after their responses; re-run for final numbers.${RESET}`);
      }
    } catch (error: any) {
      logger.error('Failed to fetch usage summary', { error: error.message });
      console.error(`${RED}✗ ${error.message}${RESET}`);
      process.exitCode = 1;
    }
  });

export const usageCommand = new Command('usage')
  .description('Usage receipts: tokens and settled cost per request (spend transparency)')
  .argument('[request_id]', 'Request id from the x-grid-request-id response header; omit to list recent requests')
  .option('--request-id <id>', 'Request id from the x-grid-request-id response header')
  .option('--json', 'Output raw JSON')
  .option('--from <iso8601>', 'List: only requests at/after this time')
  .option('--to <iso8601>', 'List: only requests before this time')
  .option('--status <status>', 'List: pending | reconciled | error')
  .option('--cost-status <status>', 'List: pending | reconciled | unpriced | cancelled')
  .option('--model <model>', 'List: filter by requested model')
  .option('--api-key <id>', 'List: filter by API key id')
  .option('--order-by <field>', 'List: inserted_at | total_tokens (default inserted_at)')
  .option('--order-direction <dir>', 'List: asc | desc (default desc)')
  .option('--limit <n>', 'List: page size (max 100)', '50')
  .option('--next <cursor>', 'List: next-page cursor from paging.next_cursor')
  .option('--prev <cursor>', 'List: previous-page cursor from paging.prev_cursor')
  .addCommand(summaryCommand)
  .action(async (requestId: string | undefined, options: UsageOptions) => {
    const client = ResponsesClient.getInstance();

    try {
      if (requestId && options.requestId && requestId !== options.requestId) {
        throw new Error('Pass the receipt id either positionally or with --request-id, not both');
      }
      const receiptId = options.requestId ?? requestId;

      if (receiptId) {
        const receipt = await client.getUsage(receiptId);
        if (options.json) {
          console.log(JSON.stringify(receipt, null, 2));
        } else {
          printReceipt(receipt);
          if (receipt.cost.status === 'pending') {
            console.log(`${DIM}Cost settles shortly after the response; re-run to see the final amount.${RESET}`);
          }
        }
        return;
      }

      const params: ListUsageParams = {
        from: options.from,
        to: options.to,
        status: options.status as ListUsageParams['status'],
        cost_status: options.costStatus as UsageCostStatus | undefined,
        model: options.model,
        api_key_id: options.apiKey,
        order_by: options.orderBy as ListUsageParams['order_by'],
        order_direction: options.orderDirection as ListUsageParams['order_direction'],
        limit: options.limit ? parseInt(options.limit, 10) : undefined,
        next: options.next,
        prev: options.prev,
      };
      const page = await client.listUsage(params);

      if (options.json) {
        console.log(JSON.stringify(page, null, 2));
        return;
      }

      if (page.data.length === 0) {
        console.log(`${DIM}No requests found.${RESET}`);
        return;
      }
      for (const receipt of page.data) {
        printListRow(receipt);
      }
      if (page.paging.next_cursor) {
        console.log(`${DIM}More: grid consumption usage --next ${page.paging.next_cursor}${RESET}`);
      }
    } catch (error: any) {
      logger.error('Failed to fetch usage', { error: error.message });
      console.error(`${RED}✗ ${error.message}${RESET}`);
      process.exitCode = 1;
    }
  });
