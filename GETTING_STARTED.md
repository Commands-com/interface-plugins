# Getting Started (Interfaces)

## 1. Install plugin files

```bash
cd /Users/dtannen/Code/commands-com-agent-interfaces
./scripts/install-interface-plugins.sh
```

## 2. Restart Commands Desktop

Close and reopen desktop so the interface registry reloads.

## 3. Verify plugin appears

In Desktop:

1. Open an agent.
2. Go to `Interfaces` tab.
3. Click provider dropdown.
4. Confirm `Webhook Echo` appears.

## 4. Create a test interface

Use provider `Webhook Echo` and optionally set:

- `Default Response Text`

## 5. Test webhook

Copy webhook URL from interface row and send a POST:

```bash
curl -i -X POST "<webhook_url>" \
  -H "content-type: application/json" \
  -d '{"hello":"world"}'
```

You should receive a JSON response echoing request metadata.

## 6. Add your own provider

Duplicate template plugin:

```bash
cp -R ./interface-plugins/webhook-echo ./interface-plugins/my-provider
```

Then edit:

- `./interface-plugins/my-provider/manifest.json`
- `./interface-plugins/my-provider/index.js`

Regenerate allowlist:

```bash
node ./scripts/generate-interface-allowlist.mjs \
  ~/.commands-agent/interface-plugins \
  ~/.commands-agent/interface-plugins-allowed.json
```
