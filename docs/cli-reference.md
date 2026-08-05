# CLI Reference

Run `grid --help` for the live list, or `grid <command> --help` for any command group. Running `grid` with no arguments launches the interactive terminal UI.

## Global flags

| Flag | Description |
|------|-------------|
| `-p, --profile <name>` | Use a specific credential profile |
| `-t, --timing` | Print a request-timing breakdown after the command |
| `--version` | Print the CLI version |
| `--help` | Show help for the CLI or a command |

## Command groups

### `grid auth` — authentication

| Command | Description |
|---------|-------------|
| `grid auth status` | Show the active profile and whether it authenticates |
| `grid auth login` | Print credential setup instructions |
| `grid auth logout` | Clear the active session |

### `grid profile` — credential profiles

| Command | Description |
|---------|-------------|
| `grid profile list` | List all profiles |
| `grid profile show <name>` | Show a profile's details |
| `grid profile set <name> [--api-url --signing-key --fingerprint]` | Create/update a profile |
| `grid profile use <name>` | Set the default profile |
| `grid profile delete <name>` | Delete a profile |

### `grid trading` — trading account & keys (OAuth)

| Command | Description |
|---------|-------------|
| `grid trading keys create --label <name>` | Generate & register a new Ed25519 signing key |
| `grid trading keys list` | List registered keys (shows an 8-character fingerprint prefix) |
| `grid trading keys revoke <id>` | Revoke a key by id |

The full fingerprint is shown only once, when the key is created.

### `grid order` — order management

| Command | Description |
|---------|-------------|
| `grid order list` | List your orders |
| `grid order create` | Create an order |
| `grid order create --auto-transfer` | Buy and transfer the fill into the consumption account (advanced mode; buy orders only) |
| `grid order cancel <id>` | Cancel an order |
| `grid order cancel-all` | Cancel all open orders |

### `grid supply` — supply management

| Command | Description |
|---------|-------------|
| `grid supply summary` | View supply across instruments |
| `grid supply issue` | Issue new supply |
| `grid supply transfer` | Transfer supply to a trading account |
| `grid supply list` | List sell orders |

### `grid consumption` — consumption / inference credits

| Command | Description |
|---------|-------------|
| `grid consumption models` | List available models |
| `grid consumption balance` | Check token/credit balance |
| `grid consumption stats` | Daily usage: requests, tokens allocated, tokens used |
| `grid consumption usage` | Per-request spend receipts (cost, model, timing) |
| `grid consumption transfer` | Move tokens to/from the consumption account |
| `grid consumption keys` / `create` / `list` / `revoke` | Manage consumption API keys |

`stats` and `usage` answer different questions: `stats` aggregates by day, while
`usage` lists individual request receipts.

`grid consumption stats` defaults to the last 7 days. `--to` is exclusive, so it
defaults to tomorrow in order to include today.

| Option | Description |
|--------|-------------|
| `--from <date>` | Start date, inclusive (`YYYY-MM-DD`) |
| `--to <date>` | End date, exclusive; cannot be later than tomorrow |
| `--days <n>` | Days back from `--to` when `--from` is omitted (default 7) |
| `--instrument <id>` | Filter by instrument |
| `--api-key <id>` | Filter by API key |
| `--json` | Emit the raw API response |

### `grid account` — account settings

| Command | Description |
|---------|-------------|
| `grid account balance` | Show balances |
| `grid account limits --market <id>` | Show effective order rate limits for a market |
| `grid account settings` (or `settings show`) | Show all settings |
| `grid account settings mode --easy\|--advanced` | Switch account mode |
| `grid account settings auto-buy --enabled <bool>` | Enable/disable auto-buy (formerly auto top-up) |
| `grid account settings auto-reload [--enabled --threshold --amount --monthly-limit]` | Configure USD auto-reload |

Auto-transfer is not directly settable: it is derived from `account_mode`, and can
be opted into per order with `grid order create --auto-transfer`. Settings that the
account mode dictates are listed in `mode_managed_fields`; writing a divergent
value returns 403.

### `grid hotwire` — intelligence market

Run inference from the terminal.

```bash
grid hotwire -s <spec> --print "Your prompt"     # single-shot
grid hotwire -s <spec>                            # interactive
```

### `grid daemon` — long-running strategy runner

| Command | Description |
|---------|-------------|
| `grid daemon start` | Start the daemon with health/metrics endpoints |

See [`docs/EXTERNAL-STRATEGIES.md`](./EXTERNAL-STRATEGIES.md) for authoring strategies.

### `grid strategy` — strategy control

| Command | Description |
|---------|-------------|
| `grid strategy list` | List available/running strategies |
| `grid strategy start <name> -c <config.json>` | Start a strategy |
| `grid strategy get <id>` | Show a strategy's current config |
| `grid strategy set <id> ...` | Replace a strategy's config |
| `grid strategy patch <id> ...` | Update part of a config |
| `grid strategy reload <id>` | Reload config from disk/DB |

### `grid config` — configuration utilities

| Command | Description |
|---------|-------------|
| `grid config import --file <path> --id <id> --name <name> --type <type>` | Import a strategy config into the local store |

### `grid dev` — developer tools

| Command | Description |
|---------|-------------|
| `grid dev bench` | Run an exchange benchmark |
| `grid dev bench live` | Progressive load test with live ASCII charts |
| `grid dev setup activity-simulator` | Bootstrap local maker/taker profiles |
| `grid dev build [--clean] [--watch]` | Rebuild the CLI from source |
| `grid dev version [--patch\|--minor\|--major]` | Show or bump the version |

### `grid status` / `grid tui` / `grid verify` / `grid diagnostics`

| Command | Description |
|---------|-------------|
| `grid status` | Show system/connectivity status |
| `grid tui` | Launch the interactive terminal UI (same as running `grid` with no args) |
| `grid verify` | Verify API connectivity, credentials, mode, balances and market metadata |
| `grid diagnostics` (alias `doctor`) | Read-only diagnostics for local config and auth paths |

> Tip: append `--profile <name>` to any command to run it against a specific set of credentials, e.g. `grid --profile prod order list`.
