# Control API security

## Request signatures

The control API uses a separate protocol from trading requests:

```text
JSON.stringify(["grid-control-v1", timestamp, nonce, METHOD, pathname + search, body])
```

Sign those UTF-8 bytes with Ed25519 and supply these headers:

- `x-thegrid-signature`: base64 signature.
- `x-thegrid-timestamp`: integer Unix seconds.
- `x-thegrid-fingerprint`: the configured operator key fingerprint.
- `x-thegrid-nonce`: 16 cryptographically random bytes encoded as 32 lowercase hexadecimal characters.

The exported `createSignedHeaders()` helper creates the signature and nonce.
Sign the full query string in the same order sent to the server.
The method and exact body bytes must also match the request.
Trading signatures and the older control signature format are rejected.
Upgrade custom control clients together with the daemon; there is no legacy fallback.
The trading SDK signature format is unchanged.

A valid nonce is accepted once per control-server process during the timestamp window, which defaults to plus or minus 60 seconds.
The bounded replay cache fails closed when full, and invalid signatures do not fill it.
A restart clears the cache. This is not durable exactly-once execution.
Before retrying a mutation with a new nonce, reconcile its result.

Use TLS and restrict control-port access to trusted operators.
Use a dedicated operator key and rotate the configured key when removing an operator.
Trading-key revocation does not independently revoke a control server's locally configured key.

## Private reads

`ControlServer({ allowUnauthenticatedReads: false })` enforces signatures for reads as well as writes when `requireAuth` is enabled.
`GET /health` and `GET /ready` remain public probes.
The legacy default still allows public reads; do not expose that mode to untrusted networks.
Private-read clients must sign GET requests with the same control protocol.

## Strategy identity isolation

If a strategy configures `credentials.envPrefix`, both its prefixed signing key and fingerprint must exist.
Missing either value stops startup before creating a strategy.
The daemon does not fall back to the default trading principal.
Without an explicit prefix, default-credential mode remains available.
Dynamic strategy profiles keep their credentials in memory rather than copying keys into additional environment variables.

## User-order proxy

The `/orders/user/list`, `/orders/user/cancel-all`, and `/orders/user/place` endpoints use the daemon's configured Trading API.
Request-body `apiUrl` overrides are rejected with HTTP 400.
Each request uses its supplied signing credentials in a fresh client instead of shared dynamic profiles or ambient OAuth credentials.
That client does not follow redirects, so it cannot forward its request-owned identity to a different destination.

## Host kernels

CVE-2026-98432 affects Linux host kernels, including kernels shared by Docker containers.
Rebuilding this CLI's Alpine image does not patch the host.
Use the host vendor's fixed kernel and verify the running version after reboot or node replacement.
The ordinary CLI is an outbound client, but daemon/control/health listeners need a separate reachability assessment.
Do not assume a deployment has an HTTP ALB in front of those listeners.
No explicit MPTCP listener configuration was found in this repository; that does not clear the broader IPv4 TCP bug.
These kernel concerns are separate from the control-API security fixes described above.

See the [Linux kernel advisory](https://kernel.googlesource.com/pub/scm/linux/security/vulns/+/refs/heads/master/cve/published/2026/CVE-2026-98432.mbox)
and the [published MPTCP exploit description](https://www.anthropic.com/research/discovering-vulnerabilities-with-claude).
