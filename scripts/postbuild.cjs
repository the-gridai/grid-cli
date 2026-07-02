#!/usr/bin/env node
/**
 * Post-build script: generates the `bin/grid` entry point.
 *
 * Uses `--import` to load OpenTelemetry instrumentation BEFORE the app code,
 * following the official OTel Node.js pattern for ESM applications.
 * @see https://opentelemetry.io/docs/languages/js/getting-started/nodejs/
 */
const fs = require('fs');
const path = require('path');

fs.mkdirSync(path.join(__dirname, '..', 'bin'), { recursive: true });

const shim = `#!/usr/bin/env bash
# grid-cli entry point — loads OTel instrumentation before app code.
# --require loads the CJS instrumentation setup so that require-in-the-middle
# can patch Node's http/https modules before any application code imports them.
#
# Resolve symlinks so this works when npm links the binary elsewhere.
SOURCE="\${BASH_SOURCE[0]}"
while [ -L "$SOURCE" ]; do
  DIR="$(cd "$(dirname "$SOURCE")" && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ "$SOURCE" != /* ]] && SOURCE="$DIR/$SOURCE"
done
DIR="$(cd "$(dirname "$SOURCE")" && pwd)"
exec node --require "$DIR/../dist/src/instrumentation.cjs" "$DIR/../dist/src/cli/index.js" "$@"
`;

fs.writeFileSync(path.join(__dirname, '..', 'bin', 'grid'), shim);
fs.chmodSync(path.join(__dirname, '..', 'bin', 'grid'), '755');

// Copy instrumentation.cjs to dist (it's CJS, not processed by tsc)
const src = path.join(__dirname, '..', 'src', 'instrumentation.cjs');
const dst = path.join(__dirname, '..', 'dist', 'src', 'instrumentation.cjs');
fs.copyFileSync(src, dst);

console.log('Generated bin/grid with --require instrumentation.cjs');
