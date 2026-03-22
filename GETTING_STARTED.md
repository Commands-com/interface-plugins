# Getting Started: Build Custom Interfaces (Desktop App)

This guide is for Commands Desktop users (including DMG installs).

## Prerequisites

- Commands Desktop installed
- Node.js 18+ available in your shell (for install/hash scripts)

## 1. Get The Repo

```bash
git clone https://github.com/Commands-com/interface-plugins.git
cd interface-plugins
```

## 2. Install Plugins Into Desktop Directory

```bash
./scripts/install-interface-plugins.sh
```

This copies plugin folders into:

- `~/.commands-com/workspace/interface-plugins`

And writes allowlist file:

- `~/.commands-com/workspace/interface-plugins-allowed.json`

## 3. Restart Commands Desktop

Close and reopen the app so the interface registry reloads.

## 4. Confirm `Webhook Echo` Appears

In the app:

1. Open an agent.
2. Open `Interfaces` tab.
3. Open the provider dropdown.
4. Confirm `Webhook Echo` is listed.

If it is missing, jump to troubleshooting in [docs/CONTRACT.md](./docs/CONTRACT.md).

## 5. Create And Test A Webhook

1. Select provider `Webhook Echo`.
2. Set `Signing Secret` (example: `demo_secret`).
3. Optionally set `Default Response Text` and `Response Status Code`.
4. Click `Add Interface`.
5. Click `Copy Webhook URL`.
6. Send a request:

```bash
curl -i -X POST "<webhook_url>" \
  -H "x-echo-secret: demo_secret" \
  -H "content-type: application/json" \
  -d '{"test":"interface"}'
```

Expected result:

- HTTP 200
- JSON response with `ok: true`
- echoed request metadata (headers/body preview)

Optional settings test:

1. Open `Edit Settings` on the configured interface row.
2. Change `Default Response Text`.
3. Click `Save Settings`.
4. Send the webhook request again and confirm the new response text is applied.

## 6. Create Your Own Plugin

```bash
cp -R ./interface-plugins/webhook-echo ./interface-plugins/my-interface
```

Edit both files:

- `./interface-plugins/my-interface/manifest.json`
- `./interface-plugins/my-interface/index.js`

Required first edits:

- change `manifest.id` to a unique value
- change `manifest.interfaceType` to a unique value matching `^[a-z][a-z0-9_]{0,31}$`
- define `createForm` fields for interface creation
- define `updateForm` fields for per-interface settings updates (optional but recommended)
- keep exported `manifest` in `index.js` exactly equal to `manifest.json`

## 7. Reinstall After Every Change

```bash
./scripts/install-interface-plugins.sh
```

Then restart Commands Desktop.

Why this matters:

- plugin files must be in `~/.commands-com/workspace/interface-plugins`
- allowlist hash must match current plugin files

## 8. Validate In-App Behavior Before Publishing

Minimum checklist:

1. Create flow works: no validation or prepare errors.
2. Update flow works: `Edit Settings` saves config/secrets through `validateUpdate`/`prepareUpdate`.
3. Tunnel request handling works: webhook responds with HTTP 2xx/4xx/5xx as intended.
4. Delete flow works: route is revoked and plugin cleanup does not break deletion.
5. Action buttons work (if `manifest.actions` is present).
6. Token rotation works: copied webhook URL changes after rotate.

## 9. Common Failure Modes

- Provider missing in dropdown:
  - manifest invalid, allowlist missing/hash mismatch, or plugin load collision.
- Provider shows `provider unavailable`:
  - plugin missing at startup or `providerApiVersion` mismatch after plugin update.
- Settings save fails:
  - plugin rejected update in `validateUpdate`/`prepareUpdate`, or provider is unavailable.
- Action button fails:
  - plugin missing `runAction` or returned `{ ok: false, error }`.

## 10. Read Full Contract Before Shipping

Use [docs/CONTRACT.md](./docs/CONTRACT.md) as the source of truth for:

- manifest schema and rejected fields
- loader security and allowlist rules
- hook signatures and payloads
- runtime lifecycle and compatibility behavior
