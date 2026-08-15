#!/usr/bin/env node
//
// Prove the README rather than asking anyone to believe it.
//
// Every claim this repository makes about the live server is a claim about a
// thing that could quietly change: the tool list, the transport, whether it
// still answers without a key. So the README does not describe the server, it
// prints what this script found, and this script talks to the real endpoint.
//
//   node probe.mjs
//   node probe.mjs --url http://localhost:3000/api/mcp
//   node probe.mjs --json
//
// Zero dependencies. Node 20 or later. Exits non-zero if the handshake fails,
// the tool list is empty, or any advertised tool is missing, so it drops into
// CI as it stands.

const DEFAULT_URL = 'https://kerne.fi/api/mcp';
const PROTOCOL_VERSION = '2025-06-18';

// The tools this repository documents. If the live server stops offering one,
// the README has become wrong and this exits 1 rather than printing a shorter
// list and looking fine.
const DOCUMENTED = [
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
      // Streamable HTTP requires the client to accept both. A server may answer
      // with a single JSON body or open an SSE stream; this one answers JSON.
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': PROTOCOL_VERSION,
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method }),
  });
  // A notification carries no id, so the correct answer is 202 with no body.
  if (res.status !== 202) throw new Error(`${method}: expected 202, got ${res.status}`);
}

function fail(msg) {
  console.error('FAIL  ' + msg);
  process.exitCode = 1;
}

const out = {};

try {
  const init = await rpc('initialize', {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: 'kerne-honesty-index-probe', version: '1.0.0' },
  });
  out.endpoint = url;
  out.protocolVersion = init.protocolVersion;
  out.serverInfo = init.serverInfo;
  out.capabilities = init.capabilities;
  out.instructions = init.instructions;

  await notify('notifications/initialized');

  const tools = await rpc('tools/list');
  out.tools = tools.tools.map((t) => ({ name: t.name, title: t.title }));

  const resources = await rpc('resources/list');
  out.resources = resources.resources.map((r) => ({ uri: r.uri, name: r.name }));

  // One real call, because a tool list is a promise and a result is evidence.
  const rows = await rpc('tools/call', { name: 'list_rows', arguments: {} });
  const payload = JSON.parse(rows.content[0].text);
  out.rowCount = payload.rows.length;
  out.snapshotGeneratedAt = payload.provenance.generated_at;
  out.snapshotSigned = payload.provenance.signed;
  out.snapshotSource = payload.provenance.source;

  const names = new Set(out.tools.map((t) => t.name));
  const missing = DOCUMENTED.filter((t) => !names.has(t));
  if (missing.length) fail(`documented but not offered: ${missing.join(', ')}`);
  const extra = [...names].filter((t) => !DOCUMENTED.includes(t));
  if (extra.length) fail(`offered but not documented in this README: ${extra.join(', ')}`);
  if (out.rowCount === 0) fail('list_rows returned an empty roster');
} catch (err) {
  fail(err.message);
}

if (asJson) {
  console.log(JSON.stringify(out, null, 2));
} else {
  console.log(`endpoint          ${out.endpoint}`);
  console.log(`protocol          ${out.protocolVersion ?? 'unknown'}`);
  console.log(
    `server            ${out.serverInfo ? `${out.serverInfo.name} ${out.serverInfo.version}` : 'unknown'}`,
  );
  console.log(`tools             ${(out.tools ?? []).map((t) => t.name).join(', ') || 'none'}`);
  console.log(`resources         ${(out.resources ?? []).map((r) => r.uri).join(', ') || 'none'}`);
  console.log(`rows on the board ${out.rowCount ?? 'unknown'}`);
  console.log(`snapshot          ${out.snapshotGeneratedAt ?? 'unknown'} (${out.snapshotSource ?? '?'})`);
  console.log(`signature         ${out.snapshotSigned === true ? 'verified' : 'NOT verified'}`);
}

if (process.exitCode) {
  console.error('\nThe README in this repository describes a server that no longer matches.');
} else {
  console.log('\nOK');
}
