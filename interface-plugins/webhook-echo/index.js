import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(path.join(__dirname, 'manifest.json'), 'utf-8'));

function safeTrim(value, maxLen = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLen) : '';
}

function parseStatusCode(value) {
  if (value === undefined || value === null || value === '') return null;
  const raw = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(raw)) return null;
  if (raw < 100 || raw > 599) return null;
  return raw;
}

function headersToObject(headerPairs) {
  const obj = {};
  const rows = Array.isArray(headerPairs) ? headerPairs : [];
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const key = safeTrim(String(row[0]).toLowerCase(), 200);
    const value = safeTrim(String(row[1]), 2000);
    if (!key) continue;
    obj[key] = value;
  }
  return obj;
}

function createProviderPlugin(host) {
  const state = {
    requestCount: 0,
  };

  function normalizeConfig(inputConfig) {
    const responseText = safeTrim(inputConfig?.responseText, 500);
    const responseStatus = parseStatusCode(inputConfig?.responseStatus);
    const normalized = {};
    if (responseText) normalized.responseText = responseText;
    if (responseStatus !== null) normalized.responseStatus = responseStatus;
    return normalized;
  }

  function validateFormInput({ config, secrets, requireSigningSecret }) {
    const responseText = safeTrim(config?.responseText, 500);
    const signingSecret = safeTrim(secrets?.signingSecret, 500);
    const responseStatusRaw = config?.responseStatus;
    const hasResponseStatus = !(responseStatusRaw === undefined || responseStatusRaw === null || String(responseStatusRaw).trim() === '');

    if (responseText.length > 400) {
      return {
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'responseText must be 400 characters or fewer',
          fields: ['responseText'],
        },
      };
    }
    if (requireSigningSecret && !signingSecret) {
      return {
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'signingSecret is required',
          fields: ['signingSecret'],
        },
      };
    }
    if (signingSecret.length > 200) {
      return {
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'signingSecret must be 200 characters or fewer',
          fields: ['signingSecret'],
        },
      };
    }
    if (hasResponseStatus && parseStatusCode(responseStatusRaw) === null) {
      return {
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'responseStatus must be an integer between 100 and 599',
          fields: ['responseStatus'],
        },
      };
    }
    return { ok: true };
  }

  function validateCreate({ config, secrets }) {
    return validateFormInput({ config, secrets, requireSigningSecret: true });
  }

  function prepareCreate({ config }) {
    return {
      ok: true,
      config: normalizeConfig(config),
      routeOverrides: {},
    };
  }

  function validateUpdate({ config, secrets }) {
    return validateFormInput({ config, secrets, requireSigningSecret: false });
  }

  function prepareUpdate({ config, existingConfig }) {
    const merged = { ...(existingConfig || {}), ...normalizeConfig(config) };
    return {
      ok: true,
      config: merged,
      routeOverrides: {},
    };
  }

  async function handleTunnelRequest(ctx) {
    state.requestCount += 1;

    const configuredText = safeTrim(ctx?.providerConfig?.responseText, 500)
      || 'Webhook received by webhook_echo';
    const responseStatus = parseStatusCode(ctx?.providerConfig?.responseStatus) || 200;

    let bodyText = '';
    try {
      bodyText = Buffer.isBuffer(ctx.bodyBuffer)
        ? ctx.bodyBuffer.toString('utf8').slice(0, 6000)
        : '';
    } catch {
      bodyText = '';
    }

    const headers = headersToObject(ctx.headers);
    const expectedSecret = safeTrim(ctx?.secrets?.signingSecret, 500);
    const providedSecret = safeTrim(headers['x-echo-secret'], 500);
    if (expectedSecret && providedSecret !== expectedSecret) {
      await ctx.sendResponse({
        status: 401,
        headers: [['content-type', 'application/json']],
        body: JSON.stringify({
          ok: false,
          error: 'invalid_signing_secret',
          message: 'Provide x-echo-secret header configured for this interface',
        }),
      });
      return;
    }

    const payload = {
      ok: true,
      message: configuredText,
      requestId: safeTrim(ctx.requestId, 200),
      routeId: safeTrim(ctx.routeId, 200),
      interfaceId: safeTrim(ctx.interfaceId, 200),
      profileId: safeTrim(ctx.profileId, 200),
      requestCount: state.requestCount,
      responseStatus,
      headers,
      bodyUtf8Preview: bodyText,
      receivedAt: new Date().toISOString(),
    };

    await ctx.sendResponse({
      status: responseStatus,
      headers: [['content-type', 'application/json']],
      body: JSON.stringify(payload),
    });
  }

  async function runAction(actionId) {
    if (actionId !== 'clear_cache') {
      return {
        ok: false,
        error: {
          code: 'action_failed',
          message: `Unknown action: ${actionId}`,
        },
      };
    }

    state.requestCount = 0;
    return {
      ok: true,
      result: {
        cleared: true,
      },
    };
  }

  function onDelete(ctx) {
    host.log('interface deleted', {
      profileId: safeTrim(ctx?.profileId, 200),
      interfaceId: safeTrim(ctx?.interfaceId, 200),
    });
  }

  return {
    validateCreate,
    prepareCreate,
    validateUpdate,
    prepareUpdate,
    handleTunnelRequest,
    runAction,
    onDelete,
  };
}

export default {
  manifest,
  createProviderPlugin,
};

export { manifest, createProviderPlugin };
