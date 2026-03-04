# Interface Provider Contract

External interface plugin folder must contain:

- `manifest.json`
- `index.js`

## `manifest.json` required fields

- `id` (string)
- `name` (string)
- `version` (string)
- `apiVersion` (string)
- `interfaceType` (string, pattern `^[a-z][a-z0-9_]{0,31}$`)
- `createForm` (object)

Optional fields:

- `routeDefaults`
- `updateForm`
- `actions`
- `description`

## `index.js` required export

```js
export default {
  manifest,
  createProviderPlugin(host) {
    return {
      validateCreate(input) {},
      prepareCreate(input) {},
      handleTunnelRequest(ctx) {},
      runAction(actionId, ctx) {},
      validateUpdate(input) {},
      prepareUpdate(input) {},
      onDelete(ctx) {},
    };
  },
};
```

## Runtime notes

- Interface provider plugins are singleton instances (created once at app startup).
- Hooks can be called concurrently.
- `webhookUrl` is host-managed and must not be declared as a plugin secret key.
- External plugin code runs in desktop main process; only install trusted code.
