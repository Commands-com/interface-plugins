<div align="center">

# Commands.com Interface Plugins

**Build webhook integrations for Commands Desktop. No source access required.**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Security](https://img.shields.io/badge/Integrity-SHA--256%20Allowlist-8B5CF6.svg)](#security-and-loading)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)](#quick-start)

External interface providers (Slack-style webhook integrations) for Commands Desktop.
Works with packaged installs — no source repo needed.

```
Webhook Source  ──>  Commands Gateway  ──>  Interface Plugin  ──>  Agent
```

</div>

---

## Highlights

| | |
|---|---|
| **Zero dependencies** | Reference plugin uses only Node.js built-ins, no npm packages required |
| **Cross-platform** | Bash installer for macOS/Linux, Node.js installer for Windows |
| **Form-driven UI** | Declare `createForm` and `updateForm` in manifest — Desktop renders the fields |
| **SHA-256 integrity** | Allowlist with optional hash pins, symlink rejection, dev-only bypass |
| **Copy-and-go** | Clone `webhook-echo`, edit manifest and handler, reinstall |
| **Action buttons** | Define custom per-interface actions in the manifest |
| **Gateway routing** | Custom `interfaceType` sent as `interface_type` when creating routes |

## Requirements

- Node.js 18+
- Commands Desktop (DMG, installer, or dev build)

## Quick Start

```bash
git clone https://github.com/Commands-com/interface-plugins.git
cd interface-plugins
```

**macOS / Linux:**

```bash
./scripts/install-interface-plugins.sh
```

**Windows (or any platform with Node.js):**

```bash
node scripts/install-interface-plugins.mjs
```

Both scripts copy plugins, install npm dependencies, and generate the SHA-256 allowlist.

| Platform | Default install locations |
|---|---|
| macOS / Linux | `~/.commands-agent/interface-plugins` |
| Windows | `%LOCALAPPDATA%\commands-agent\interface-plugins` |

Restart Commands Desktop.

### Verify the Reference Plugin

1. Open an agent and go to the **Interfaces** tab.
2. Select **Webhook Echo** from the provider dropdown.
3. Set **Signing Secret** to `demo_secret` and click **Add Interface**.
4. Click **Copy Webhook URL**.

```bash
curl -i -X POST "<webhook_url>" \
  -H "x-echo-secret: demo_secret" \
  -H "content-type: application/json" \
  -d '{"hello":"world"}'
```

Expected: HTTP 200 with JSON including request metadata and a running `requestCount`.

## Build Your Own Interface Provider

```bash
cp -R ./interface-plugins/webhook-echo ./interface-plugins/my-interface
```

Update:

- `manifest.json` — plugin metadata, `createForm`, `updateForm`, actions
- `index.js` — provider hooks (`handleTunnelRequest`, `validateCreate`, etc.)

Reinstall and regenerate allowlist:

```bash
./scripts/install-interface-plugins.sh        # macOS/Linux
node scripts/install-interface-plugins.mjs    # Windows (or any platform)
```

Restart Commands Desktop. Your provider appears in the **Interfaces** tab.

## Security and Loading

| Rule | Detail |
|---|---|
| Built-in providers | Always load (including built-in Slack) |
| External providers | Additive — cannot override built-ins |
| Reserved types | `slack`, `internal`, `test` are blocked for external plugins |
| Allowlist | Plugin directory names must be listed |
| Integrity | If allowlist entry includes `sha256`, enforced at load time |
| File checks | `manifest.json` and `index.js` must be regular files (no symlinks) |

Dev-only bypass:

```bash
COMMANDS_AGENT_DEV=1 COMMANDS_AGENT_TRUST_ALL_INTERFACE_PLUGINS=1
```

In Desktop: **Settings > Developer > Dev Mode + Trust All Plugins**.

## Project Layout

```
interface-plugins/webhook-echo                  Reference implementation (copy to create new)
scripts/install-interface-plugins.sh            Bash installer (macOS/Linux)
scripts/install-interface-plugins.mjs           Node.js installer (cross-platform)
scripts/generate-interface-allowlist.mjs        Generate allowlist with SHA-256 pins
scripts/compute-interface-plugin-sha256.mjs     Compute single plugin hash
docs/CONTRACT.md                                Full manifest, loader, lifecycle, hook contract
GETTING_STARTED.md                              End-to-end authoring and testing workflow
```

## Additional Docs

- [Getting Started](./GETTING_STARTED.md)
- [Contributing](./CONTRIBUTING.md)
- [Interface Contract](./docs/CONTRACT.md)
