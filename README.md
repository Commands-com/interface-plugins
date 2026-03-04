# Commands.com Agent Interfaces

External interface provider plugins for Commands.com Desktop.

This repo is for integrations like Slack-style webhook interfaces that run locally and are loaded by the desktop app.

## Important behavior

- Built-in interface providers (including built-in Slack) still load.
- External providers are additive.
- External providers cannot override reserved types (`slack`, `internal`, `test`).

## Repo layout

```text
commands-com-agent-interfaces/
  interface-plugins/
    webhook-echo/
      manifest.json
      index.js
  scripts/
    install-interface-plugins.sh
    compute-interface-plugin-sha256.mjs
    generate-interface-allowlist.mjs
  docs/
    CONTRACT.md
  interface-plugins-allowed.json.example
  README.md
  GETTING_STARTED.md
```

## Quick install (recommended)

```bash
cd /Users/dtannen/Code/commands-com-agent-interfaces
./scripts/install-interface-plugins.sh
```

This installs plugins to:

- `~/.commands-agent/interface-plugins`
- `~/.commands-agent/interface-plugins-allowed.json`

Then restart Commands Desktop.

## Manual install

```bash
mkdir -p ~/.commands-agent/interface-plugins
rsync -a --delete --exclude '.DS_Store' --exclude '.git/' \
  ./interface-plugins/ ~/.commands-agent/interface-plugins/
node ./scripts/generate-interface-allowlist.mjs \
  ~/.commands-agent/interface-plugins \
  ~/.commands-agent/interface-plugins-allowed.json
```

## Use repo path directly (optional)

You can point the app to this repo directly:

```bash
export COMMANDS_AGENT_INTERFACE_PLUGINS_DIR=/Users/dtannen/Code/commands-com-agent-interfaces/interface-plugins
```

If you do this, put allowlist at:

- `/Users/dtannen/Code/commands-com-agent-interfaces/interface-plugins-allowed.json`

## Security model

- Default secure mode: allowlist + optional integrity hash pin per plugin.
- Dev bypass exists but should not be used in production:

```bash
COMMANDS_AGENT_DEV=1
COMMANDS_AGENT_TRUST_ALL_INTERFACE_PLUGINS=1
```

## Add a new plugin

1. Copy `interface-plugins/webhook-echo` to a new folder.
2. Update `manifest.json` with a unique `id` and `interfaceType`.
3. Implement plugin hooks in `index.js`.
4. Regenerate allowlist with hashes:

```bash
node ./scripts/generate-interface-allowlist.mjs \
  ~/.commands-agent/interface-plugins \
  ~/.commands-agent/interface-plugins-allowed.json
```

## Contract

See [`docs/CONTRACT.md`](./docs/CONTRACT.md).

## Troubleshooting

- Provider not visible:
  - Check `manifest.json` schema and `interfaceType` uniqueness.
  - Check allowlist file path and plugin directory names.
- Provider shows unavailable:
  - `providerApiVersion` in existing records may mismatch the plugin `apiVersion`.
- Hash mismatch:
  - Regenerate allowlist after any plugin file change.
