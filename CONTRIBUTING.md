# Contributing

Thanks for helping expand the Commands.com interface plugin ecosystem.

This repository is for external interface providers and the tooling/docs needed to install, validate, and safely load them in Commands Desktop. The goal is to make webhook-style integrations easy to build without requiring source access to the main app.

## What Belongs Here

Good fits for this repo:

- New external interface plugins
- Improvements to existing interface plugins
- Installer, allowlist, hashing, and local dev tooling for interface plugins
- Documentation that helps people build, validate, or safely install interface plugins

Usually not a fit:

- Changes that belong inside the main Commands Desktop app
- Private one-off plugins that cannot be shared or documented
- Breaking contract changes without matching docs updates
- Plugins that depend on undeclared files outside their own directory

## Ground Rules

Please keep contributions self-contained, honest, and easy to verify.

- A plugin should live entirely inside its own folder under `interface-plugins/`.
- Do not add hidden dependencies on another plugin's private files.
- Keep manifests and runtime behavior aligned with the documented contract.
- Prefer clear installation and validation steps over clever setup.
- Document any external services, credentials, tunnels, or webhook assumptions.

## Adding a New Interface Plugin

1. Start from `interface-plugins/webhook-echo` unless another existing plugin is a better fit.
2. Give the plugin a stable, descriptive `interfaceType`.
3. Add or update:
   - `manifest.json`
   - `index.js`
   - any supporting files inside the plugin folder
   - plugin-specific docs if setup is non-trivial
4. Reinstall locally with the interface-plugin installer.
5. Verify the plugin can be discovered and configured in Commands Desktop.

## Required Documentation

Every contribution should make its limits obvious.

- If a plugin needs external APIs, tunnels, secrets, or signing configuration, say so clearly.
- If a plugin is experimental, say so clearly.
- If a plugin is intended only for local/dev use, say so clearly.
- If a plugin expects a specific payload shape or webhook behavior, document that too.

## Validation

Before opening a PR, run the checks that apply to your change.

Common commands:

```bash
./scripts/install-interface-plugins.sh --plugin <name>
node scripts/install-interface-plugins.mjs --plugin <name>
node scripts/generate-interface-allowlist.mjs
node scripts/compute-interface-plugin-sha256.mjs ./interface-plugins/<name>
```

If your plugin has additional validation or webhook smoke tests, include them in the PR description.

## PR Checklist

Please aim to include:

- A short explanation of what the plugin or change does
- Any setup/runtime requirements
- Validation steps you ran
- Doc updates when behavior or workflow changes
- Sample payloads or screenshots when configuration UX changes

## Compatibility Expectations

Keep compatibility in mind when changing shared scripts or contracts.

- Do not break existing interface plugins unnecessarily.
- If you change the contract, update the docs in `docs/`.
- If you change installers or allowlist generation, keep single-plugin install working.

## Security and Trust

Interface plugins run local executable code in response to external requests.

- Avoid surprising behavior.
- Minimize unnecessary filesystem, process, or network access.
- Keep allowlist/integrity behavior intact.
- Do not weaken loading safeguards without a strong reason and a matching docs update.
- Be especially clear about any authentication, signature validation, or replay-protection behavior.

## Questions

If a change is large or changes the contract shape, open an issue or draft PR first so the approach can be aligned before too much work lands.
