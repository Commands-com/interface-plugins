#!/usr/bin/env node
/**
 * Cross-platform interface plugin installer.
 * Replaces install-interface-plugins.sh for Windows/macOS/Linux compatibility.
 *
 * Usage: node scripts/install-interface-plugins.mjs [options]
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getDefaultBaseDir() {
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA || process.env.APPDATA || os.homedir();
    return path.join(base, 'commands-com', 'workspace');
  }
  return path.join(os.homedir(), '.commands-com', 'workspace');
}

function usage() {
  const defaultDest = path.join(getDefaultBaseDir(), 'interface-plugins');
  console.log(`Usage: node scripts/install-interface-plugins.mjs [options]

Options:
  --source <dir>          Source plugin directory (default: ./interface-plugins)
  --dest <dir>            Destination plugin directory
                          (default: ${defaultDest})
  --allowlist <file>      Allowlist output file (derived from --dest by default)
  --skip-allowlist        Do not write allowlist file
  --skip-npm-install      Skip npm install for plugins with package.json
  --prune                 Enable stale plugin pruning (disabled by default)
  -h, --help              Show this help`);
}

// Parse args
const repoRoot = path.resolve(__dirname, '..');
let sourceDir = path.join(repoRoot, 'interface-plugins');
let destDir = process.env.COMMANDS_AGENT_INTERFACE_PLUGINS_DIR || path.join(getDefaultBaseDir(), 'interface-plugins');
let allowlistPath = '';
let writeAllowlist = true;
let installDeps = true;
let prune = false;

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--source':
      if (i + 1 >= args.length) { console.error('Missing value for --source'); usage(); process.exit(1); }
      sourceDir = args[++i];
      break;
    case '--dest':
      if (i + 1 >= args.length) { console.error('Missing value for --dest'); usage(); process.exit(1); }
      destDir = args[++i];
      break;
    case '--allowlist':
      if (i + 1 >= args.length) { console.error('Missing value for --allowlist'); usage(); process.exit(1); }
      allowlistPath = args[++i];
      break;
    case '--skip-allowlist':
      writeAllowlist = false;
      break;
    case '--skip-npm-install':
      installDeps = false;
      break;
    case '--prune':
      prune = true;
      break;
    case '-h':
    case '--help':
      usage();
      process.exit(0);
      break;
    default:
      console.error(`Unknown argument: ${args[i]}`);
      usage();
      process.exit(1);
  }
}

if (!allowlistPath) {
  allowlistPath = path.join(path.dirname(destDir), 'interface-plugins-allowed.json');
}

if (!fs.existsSync(sourceDir)) {
  console.error(`Source directory not found: ${sourceDir}`);
  process.exit(1);
}

// Skip list for files/dirs that should not be synced
const SKIP = new Set(['.DS_Store', '.git', 'node_modules']);

/**
 * Recursively sync srcDir -> destDir, deleting files in dest that don't exist in src.
 */
function syncDir(srcDir, destDirPath, skipSet) {
  fs.mkdirSync(destDirPath, { recursive: true });

  const srcEntries = fs.readdirSync(srcDir, { withFileTypes: true });
  const srcNames = new Set();

  for (const entry of srcEntries) {
    if (skipSet.has(entry.name)) continue;
    srcNames.add(entry.name);

    const srcPath = path.join(srcDir, entry.name);
    const dstPath = path.join(destDirPath, entry.name);

    if (entry.isDirectory()) {
      syncDir(srcPath, dstPath, skipSet);
    } else {
      let needsCopy = true;
      if (fs.existsSync(dstPath)) {
        const srcStat = fs.statSync(srcPath);
        const dstStat = fs.statSync(dstPath);
        if (srcStat.size === dstStat.size && srcStat.mtimeMs <= dstStat.mtimeMs) {
          needsCopy = false;
        }
      }
      if (needsCopy) {
        fs.copyFileSync(srcPath, dstPath);
      }
    }
  }

  // Delete files in dest that don't exist in source
  const destEntries = fs.readdirSync(destDirPath, { withFileTypes: true });
  for (const entry of destEntries) {
    if (skipSet.has(entry.name)) continue;
    if (!srcNames.has(entry.name)) {
      const dstPath = path.join(destDirPath, entry.name);
      fs.rmSync(dstPath, { recursive: true, force: true });
    }
  }
}

fs.mkdirSync(destDir, { recursive: true });

console.log('Installing interface plugins');
console.log(`Source: ${sourceDir}`);
console.log(`Dest:   ${destDir}`);

const skipSet = SKIP;
const sourcePluginNames = new Set();

const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
for (const entry of entries) {
  if (!entry.isDirectory()) continue;

  const pluginName = entry.name;
  sourcePluginNames.add(pluginName);
  const srcPluginPath = path.join(sourceDir, pluginName);
  const destPluginPath = path.join(destDir, pluginName);

  console.log(`[${pluginName}] syncing`);
  syncDir(srcPluginPath, destPluginPath, skipSet);

  // Marker used by prune step
  fs.writeFileSync(
    path.join(destPluginPath, '.installed-by-commands-interface-plugins'),
    'installed by commands-com-agent-interfaces\n'
  );

  if (installDeps && fs.existsSync(path.join(destPluginPath, 'package.json'))) {
    console.log(`[${pluginName}] npm install --omit=dev`);
    execFileSync('npm', ['install', '--omit=dev'], {
      cwd: destPluginPath,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
  }
}

// Prune stale plugin directories
if (prune) {
  const destEntries = fs.readdirSync(destDir, { withFileTypes: true });
  for (const entry of destEntries) {
    if (!entry.isDirectory()) continue;
    if (sourcePluginNames.has(entry.name)) continue;

    const destPluginPath = path.join(destDir, entry.name);
    const markerPath = path.join(destPluginPath, '.installed-by-commands-interface-plugins');
    if (fs.existsSync(markerPath)) {
      console.log(`[${entry.name}] removing stale plugin directory`);
      fs.rmSync(destPluginPath, { recursive: true, force: true });
    } else {
      console.log(`[${entry.name}] skipping removal (not managed by this installer)`);
    }
  }
} else {
  console.log('Note: stale-plugin pruning is disabled by default. Pass --prune to enable.');
}

// Generate allowlist
if (writeAllowlist) {
  const allowlistScript = path.join(repoRoot, 'scripts', 'generate-interface-allowlist.mjs');
  console.log(`Generating allowlist: ${allowlistPath}`);
  execFileSync(process.execPath, [allowlistScript, '--managed-only', destDir, allowlistPath], {
    stdio: 'inherit',
  });
}

console.log('Done. Restart Commands Desktop to load plugins.');
