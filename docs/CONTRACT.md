# Interface Provider Plugin Contract (Commands Desktop)

This document is the source-of-truth contract for external interface plugins loaded by Commands Desktop.

Use this file with the reference plugin at `interface-plugins/webhook-echo`.

## 1. Runtime Loading Model

- Built-in providers load first (currently includes built-in `slack`).
- External providers are additive and loaded after built-ins.
- External providers are loaded from:
  - default: `~/.commands-agent/interface-plugins`
  - override: `COMMANDS_AGENT_INTERFACE_PLUGINS_DIR`
- Allowlist is loaded from plugin directory parent:
  - default path: `~/.commands-agent/interface-plugins-allowed.json`
- No `Commands.app` source modification is required.

## 2. Required Plugin Files

Each plugin directory must contain:

- `manifest.json`
- `index.js`

Both files must be regular files.

- Symlinked `manifest.json` or `index.js` is rejected.

Optional files are allowed, including `package.json` and `node_modules`.

## 3. `index.js` Export Contract

`index.js` must export a descriptor object with:

- `manifest`
- `createProviderPlugin(host)`

Example:

```js
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(path.join(__dirname, 'manifest.json'), 'utf-8'));

function createProviderPlugin(host) {
  return {
    validateCreate(input) { return { ok: true }; },
    prepareCreate(input) { return { ok: true, config: {}, routeOverrides: {} }; },
    validateUpdate(input) { return { ok: true }; },
    prepareUpdate(input) { return { ok: true, config: input.existingConfig || {}, routeOverrides: {} }; },
    async handleTunnelRequest(ctx) {
      await ctx.sendResponse({
        status: 200,
        headers: [['content-type', 'application/json']],
        body: JSON.stringify({ ok: true }),
      });
    },
    async runAction(actionId, ctxPayload) {
      return { ok: true, result: { actionId } };
    },
    async onDelete(ctx) {},
  };
}

export default { manifest, createProviderPlugin };
export { manifest, createProviderPlugin };
```

Hard rules:

- `createProviderPlugin` must be a function.
- `createProviderPlugin` must return an object.
- Exported `manifest` must deep-match `manifest.json` exactly.
- `manifest.interfaceType` must be unique across all loaded providers.
- `manifest.id` must be unique across all loaded providers.

## 4. Plugin Lifetime And Concurrency

- Interface providers are singleton instances.
- `createProviderPlugin(host)` is called once at startup.
- Hook calls can happen concurrently; do not assume serialized hook execution.
- Keep mutable state thread-safe for async reentrancy.

## 5. Host Object Passed To `createProviderPlugin`

`host` shape:

```js
{
  manifest,      // frozen manifest
  log(...args),  // tagged logger
  cache,         // Map instance, persistent for plugin lifetime
  runtime,       // runtime helpers (may evolve)
}
```

Current runtime helper fields:

- `runtime.fs`
- `runtime.profilesDir`
- `runtime.atomicWrite`
- `runtime.requestLocalPrompt(profileId, payload, timeoutMs)`
- `runtime.emitConversationEvent(payload)`
- `runtime.isProfileRunning(profileId)`

Treat `runtime` as advanced and host-owned.

## 6. Manifest Schema (`manifest.json`)

Unknown fields are rejected.

### 6.1 Allowed Top-Level Keys

- `id` (required non-empty string)
- `name` (required non-empty string)
- `version` (required non-empty string)
- `apiVersion` (required non-empty string)
- `interfaceType` (required non-empty string)
- `routeDefaults` (optional object)
- `createForm` (required object)
- `updateForm` (optional object)
- `actions` (optional array)
- `description` (optional non-empty string)

### 6.2 `interfaceType` Rules

- Must match regex: `^[a-z][a-z0-9_]{0,31}$`
- Reserved types are forbidden for external plugins:
  - `slack`
  - `internal`
  - `test`

### 6.3 `createForm` And `updateForm` Rules

Each form object allows only:

- `secrets`
- `config`

`secrets` entries allow only keys:

- `key` (required non-empty string)
- `label` (required non-empty string)
- `required` (optional boolean)

`config` entries allow only keys:

- `key` (required non-empty string)
- `label` (required non-empty string)
- `type` (optional non-empty string)
- `required` (optional boolean)

Additional rules:

- duplicate `secrets[].key` is rejected
- duplicate `config[].key` is rejected
- secret key `webhookUrl` is reserved and cannot be declared

### 6.4 `routeDefaults` Rules

Allowed keys:

- `tokenAuthMode` (optional non-empty string)
- `deadlineMs` (optional positive number)
- `maxBodyBytes` (optional positive number)
- `tokenMaxAgeDays` (optional positive number)

All other keys are rejected.

### 6.5 `actions` Rules

`actions` must be an array of objects with only:

- `id` (required non-empty string)
- `label` (required non-empty string)
- `confirmText` (optional non-empty string)

Duplicate `actions[].id` is rejected.

## 7. Loader Security, Allowlist, And Integrity

Allowlist file schema:

```json
{
  "allowed": [
    "plugin-dir-name",
    { "name": "plugin-dir-name", "sha256": "<hex>" }
  ]
}
```

Behavior:

- plugin directory name must be allowlisted unless trust-all mode is active
- if `sha256` is present, full plugin integrity hash must match
- hash is computed across plugin file paths + bytes
- symlinks are rejected during integrity hashing

If allowlist is missing or invalid, external plugins are skipped.

## 8. Trust-All Dev Bypass

Trust-all bypass is active only when both conditions are true:

1. Dev mode enabled:
  - `COMMANDS_AGENT_DEV=1` or desktop setting `devMode=true`
2. Trust-all enabled:
  - `COMMANDS_AGENT_TRUST_ALL_INTERFACE_PLUGINS=1` or desktop setting `trustAllPlugins=true`

When active:

- allowlist checks are bypassed
- integrity checks are bypassed

Use only for local development.

## 9. Hook Contract

All hooks are optional unless noted by your own plugin behavior.

### 9.1 `validateCreate({ config, secrets })`

Return shape:

- success: `{ ok: true }`
- failure: `{ ok: false, error: { code, message, fields? } }`

### 9.2 `prepareCreate({ config, secrets })`

Return shape:

- success: `{ ok: true, config?, routeOverrides? }`
- failure: `{ ok: false, error: { code, message } }`

`config` becomes persisted `providerConfig`.

`routeOverrides` is merged into gateway create payload after manifest defaults and before caller overrides.

### 9.3 `validateUpdate({ config, secrets, existingConfig })`

Same success/failure contract as `validateCreate`.

### 9.4 `prepareUpdate({ config, secrets, existingConfig })`

Same return contract as `prepareCreate`.

- `config` replaces persisted `providerConfig` when returned
- `routeOverrides` is merged with caller overrides for gateway update payload

### 9.5 `handleTunnelRequest(ctx)`

`ctx` shape:

```js
{
  profileId,
  profileName,
  interfaceId,
  providerConfig,
  requestId,
  routeId,
  headers,      // header tuple array from gateway frame
  bodyBuffer,   // Buffer
  secrets,      // hydrated provider secrets, excluding webhookUrl
  sendResponse, // async ({ status, headers, body }) => void
}
```

Requirements:

- must call `ctx.sendResponse(...)` for each inbound request
- response `body` may be string or Buffer-compatible payload

Error handling:

- if hook throws, service sends fallback `503` with `{"error":"internal_request_error"}`

### 9.6 `runAction(actionId, ctxPayload)`

`ctxPayload` contains:

```js
{
  profileId,
  interfaceId,
  secrets,
  providerConfig,
  ...payloadFromCaller
}
```

Return plugin result object. If you return `{ ok: false, error }`, that error is surfaced to UI.

### 9.7 `onDelete({ profileId, interfaceId })`

Called best-effort after route revoke and profile record removal.

Failures are logged and do not block deletion completion.

## 10. Interface Service Lifecycle Semantics

### 10.1 Create Flow

1. Resolve provider by `provider` (which equals `manifest.interfaceType`).
2. Run `validateCreate` then `prepareCreate` when implemented.
3. Persist plugin-declared secrets (`manifest.createForm.secrets`).
4. Create gateway route with payload:
   - `device_id`
   - `interface_type` (from `manifest.interfaceType`)
   - defaults from `routeDefaults`
   - merged `routeOverrides`
5. Store gateway `public_url` as host-managed secret `webhookUrl`.
6. Persist interface record with `providerApiVersion = manifest.apiVersion`.

### 10.2 Update Flow

- If provider is unavailable, config/secrets/routeOverride updates are rejected.
- Enabled toggle is still allowed when unavailable.
- `validateUpdate` and `prepareUpdate` run when implemented.
- Secret updates rotate references in secure store.
- Route override and enabled changes are sent in one gateway update payload.

### 10.3 Provider Availability Rules

An interface is marked `provider_unavailable` when either condition is true:

- provider plugin no longer resolves
- stored `providerApiVersion` differs from loaded `manifest.apiVersion`

When compatibility returns, status is restored.

### 10.4 Delete Flow

- Gateway route revoke attempted first (404 treated as idempotent success).
- Interface record removed from profile.
- All stored secret refs deleted.
- `onDelete` called best-effort.

## 11. Host-Managed Secrets

`webhookUrl` is always host-managed.

Rules:

- plugin cannot declare `webhookUrl` in manifest secrets
- plugin does not receive `webhookUrl` in hydrated `secrets`
- webhook URL retrieval/rotation is handled by service APIs

## 12. Desktop UI Behavior Notes

Current Interfaces tab behavior:

- provider list comes from loaded provider manifests
- create form uses `manifest.createForm` only
- secret fields render as password inputs
- config fields render as text inputs
- `config[].type` is currently metadata only (no specialized control rendering)
- `updateForm` is validated at load time but not currently rendered in UI
- `manifest.actions` render as action buttons on each interface row

## 13. Gateway Coupling And Route Overrides

Gateway create call uses `manifest.interfaceType` as `interface_type`.

Route override keys are passed through to gateway as-is.

Use gateway field names (snake_case), for example:

- `deadline_ms`
- `max_body_bytes`
- `token_max_age_days`
- `status`

Desktop does not fully validate arbitrary override keys.

## 14. Quality Checklist

1. Keep `manifest.json` and exported `manifest` exactly identical.
2. Use globally unique `id` and `interfaceType`.
3. Keep `apiVersion` stable; bump intentionally and plan migration impact.
4. Return explicit `{ ok: false, error }` for validation failures.
5. Always call `sendResponse` in `handleTunnelRequest`.
6. Handle missing/rotated secrets defensively.
7. Keep plugin logic deterministic and bounded by gateway deadlines.
8. Regenerate allowlist after any plugin file change.
9. Re-test create, webhook request, action, rotate token, delete.

## 15. Troubleshooting

- Provider not visible:
  - verify allowlist path and entry name match plugin directory
  - verify manifest schema and uniqueness
  - verify hash in allowlist after edits
- Provider visible but marked unavailable:
  - verify plugin loads successfully
  - verify `providerApiVersion` matches loaded `manifest.apiVersion`
- Webhook returns 503:
  - plugin missing `handleTunnelRequest`
  - plugin threw before `sendResponse`
- Action button fails:
  - `runAction` missing or returns error
