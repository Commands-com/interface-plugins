# Commands.com Interface Plugins

Build external interface providers (Slack-style webhook integrations) for Commands Desktop.

This repo is for desktop app users, including DMG installs. You do not need access to the `Commands.app` source repo to build and ship your own interface plugin.

## What You Get

- `interface-plugins/webhook-echo`: reference implementation you can copy
- `scripts/install-interface-plugins.sh`: install plugins into the desktop plugin directory
- `scripts/generate-interface-allowlist.mjs`: generate allowlist with SHA-256 integrity pins
- `scripts/compute-interface-plugin-sha256.mjs`: compute a single plugin hash
- `docs/CONTRACT.md`: full manifest, loader, lifecycle, and hook contract
- `GETTING_STARTED.md`: end-to-end authoring and testing workflow

## Install Into Commands Desktop

```bash
git clone https://github.com/Commands-com/interface-plugins.git
cd interface-plugins
./scripts/install-interface-plugins.sh
```

Install script output locations:

- `~/.commands-agent/interface-plugins`
- `~/.commands-agent/interface-plugins-allowed.json`

Then restart Commands Desktop.

## Verify The Reference Plugin

In the app:

1. Open an agent.
2. Open the `Interfaces` tab.
3. In the provider dropdown, select `Webhook Echo`.
4. Click `Add Interface`.
5. Click `Copy Webhook URL`.

Send a test request:

```bash
curl -i -X POST "<webhook_url>" \
  -H "content-type: application/json" \
  -d '{"hello":"world"}'
```

Expected behavior: HTTP 200 with JSON that includes request metadata and a running `requestCount`.

## Build Your Own Interface Provider

1. Copy the sample plugin.

```bash
cp -R ./interface-plugins/webhook-echo ./interface-plugins/my-interface
```

2. Update:

- `./interface-plugins/my-interface/manifest.json`
- `./interface-plugins/my-interface/index.js`

3. Reinstall and regenerate allowlist:

```bash
./scripts/install-interface-plugins.sh
```

4. Restart Commands Desktop.

## Security And Loading Model

- Built-in providers (including built-in `Slack`) still load.
- External providers are additive.
- External plugins cannot use reserved `interfaceType` values: `slack`, `internal`, `test`.
- Plugin directory names must be allowlisted.
- If an allowlist entry includes `sha256`, integrity is enforced at load time.
- `manifest.json` and `index.js` must be regular files (no symlinks).

Dev-only bypass exists:

- `COMMANDS_AGENT_DEV=1`
- `COMMANDS_AGENT_TRUST_ALL_INTERFACE_PLUGINS=1`

In Desktop UI this maps to Developer settings `Dev Mode` + `Trust All Plugins`.

## Gateway Requirement For Custom Interface Types

Custom plugins send `manifest.interfaceType` to gateway as `interface_type` when creating routes.

## Full Docs

- [Getting Started](./GETTING_STARTED.md)
- [Interface Contract](./docs/CONTRACT.md)
