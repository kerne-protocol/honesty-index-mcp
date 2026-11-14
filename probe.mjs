#!/usr/bin/env node
//
// Prove the README rather than asking anyone to believe it.
//
// Every claim this repository makes about the live server is a claim about a
// thing that could quietly change: the tool list, the transport, whether it
// still answers without a key. So this script talks to the real endpoint and
// fails if what it finds and what the README documents have drifted apart.
//
//   node probe.mjs
//   node probe.mjs --url http://localhost:8787/api/mcp
//   node probe.mjs --json
//
// Zero dependencies. Node 20 or later. Exits non-zero if the handshake fails,
// a documented tool is missing, an undocumented tool appears, or the one real
// call returns an error, so it drops into CI as it stands.
//
// The user agent contains "kerne-selftest" on purpose: the endpoint's public
// usage counts leave self-tests out, and a daily CI call must never be counted
// as somebody using the data.

const DEFAULT_URL = 'https://kerne.fi/api/mcp';
const PROTOCOL_VERSION = '2025-06-18';
const USER_AGENT = 'kerne-selftest honesty-index-mcp-probe/2.0.0';

// The tools the README documents. If the live server stops offering one, or
// offers one that was never written down, the README has become wrong.
const DOCUMENTED = [
  'get_signed_reserves',
  'get_stock_quote',
  'verify_stock_quote',
  'get_vault_state',
];

// Retired on 2026-10-28 with the collector behind them. If one comes back it
// must be documented first, so finding one is a failure like any other extra.
const RETIRED = [
  'list_rows',
  'get_board',
  'get_row',
  'get_methodology',
  'get_corrections',
  'get_right_of_reply',
];

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const urlIdx = args.indexOf('--url');
const url = urlIdx >= 0 ? args[urlIdx + 1] : DEFAULT_URL;

let nextId = 1;

async function rpc(method, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Streamable HTTP requires the client to accept both. This server
      // answers with a single JSON body.
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': PROTOCOL_VERSION,
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
  });
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result;
}

async function notify(method) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
    body: JSON.stringify({ jsonrpc: '2.0', method }),
  });
  // A notification carries no id, so the correct answer is 202 with no body.
  if (res.status !== 202) throw new Error(`${method}: expected 202, got ${res.status}`);
}

function fail(msg) {
  console.error('FAIL ' + msg);
  process.exitCode = 1;
}

const out = {};

try {
  const init = await rpc('initialize', {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: 'kerne-selftest-honesty-index-mcp-probe', version: '2.0.0' },
  });
  out.endpoint = url;
  out.protocolVersion = init.protocolVersion;
  out.serverInfo = init.serverInfo;
  out.capabilities = init.capabilities;
  out.instructions = init.instructions;

  await notify('notifications/initialized');

  const tools = await rpc('tools/list');
  out.tools = tools.tools.map((t) => ({ name: t.name, title: t.title }));

  // One real call, because a tool list is a promise and a result is evidence.
  // get_vault_state is a direct chain read pinned to one block, so it needs no
  // signer and no cache to be up.
  const call = await rpc('tools/call', { name: 'get_vault_state', arguments: {} });
  if (call.isError) throw new Error(`get_vault_state returned a tool error: ${call.content?.[0]?.text}`);
  const payload = JSON.parse(call.content[0].text);
  out.vaultAddress = payload.vault?.address;
  out.vaultBlock = payload.block?.number;
  out.vaultBlockTime = payload.block?.time;
  out.depositsOpen = payload.state?.deposits_open;

  const names = new Set(out.tools.map((t) => t.name));
  const missing = DOCUMENTED.filter((t) => !names.has(t));
  if (missing.length) fail(`documented but not offered: ${missing.join(', ')}`);
  const extra = [...names].filter((t) => !DOCUMENTED.includes(t));
  if (extra.length) fail(`offered but not documented in this README: ${extra.join(', ')}`);
  const back = RETIRED.filter((t) => names.has(t));
  if (back.length) fail(`a retired tool is offered again: ${back.join(', ')}`);
  if (!out.vaultAddress || !out.vaultBlock) fail('get_vault_state returned no vault address or block');
} catch (err) {
  fail(err.message);
}

if (asJson) {
  console.log(JSON.stringify(out, null, 2));
} else {
  console.log(`endpoint ${out.endpoint}`);
  console.log(`protocol ${out.protocolVersion ?? 'unknown'}`);
  console.log(
    `server   ${out.serverInfo ? `${out.serverInfo.name} ${out.serverInfo.version}` : 'unknown'}`,
  );
  console.log(`tools    ${(out.tools ?? []).map((t) => t.name).join(', ') || 'none'}`);
  console.log(`vault    ${out.vaultAddress ?? 'unknown'} at block ${out.vaultBlock ?? '?'} (${out.vaultBlockTime ?? '?'})`);
  console.log(`deposits ${out.depositsOpen === true ? 'open' : out.depositsOpen === false ? 'closed' : 'unknown'}`);
}

if (process.exitCode) {
  console.error('\nThe README in this repository describes a server that no longer matches.');
} else {
  console.log('\nOK');
}
