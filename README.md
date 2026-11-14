# honesty-index-mcp

**Read-only Kerne data on Base as a Model Context Protocol server: signed proof
of reserves for kUSD, a signed reference quote for a covered call on a tokenized
stock, a quote checker, and live vault state. Remote, no key, no account,
nothing to install.**

```
https://kerne.fi/api/mcp
```

Streamable HTTP. Stateless. Read-only: nothing this server offers can move funds.

## Add it

Claude Code:

```
claude mcp add --transport http kerne https://kerne.fi/api/mcp
```

Anything that reads a config file:

```json
{
  "mcpServers": {
    "kerne": {
      "type": "http",
      "url": "https://kerne.fi/api/mcp"
    }
  }
}
```

Registry name: `io.github.kerne-protocol/honesty-index`. The name is historical
(see the last section). Registry names cannot be renamed, and a second name would
list the same endpoint twice, so the entry keeps it.

## What it answers

| Tool | What it returns |
| --- | --- |
| `get_signed_reserves` | The latest signed proof of reserves for kUSD, the Kerne stablecoin on Base: outstanding kUSD, the USDC held in each PSM contract, the solvency ratio, the skUSD share price and the hedge account, read on chain at one pinned block and signed every 15 minutes by a key that holds no funds. The server checks the hash and the signer and says whether they checked. |
| `get_stock_quote` | The latest signed reference quote for a one week covered call on TSLAc (Coinbase tokenized Tesla stock on Base): spot from the Chainlink feed, realized volatility, a strike near 20 delta, the premium, the expiry and how long the quote is valid. A reference price only: not an offer, not advice, not for US persons, and nothing executes from it. |
| `verify_stock_quote` | Checks a quote: the hash against the signed string, both signatures (EIP-191 over the document, EIP-712 over the on-chain Quote struct) against the published signer, expiry, and whether the price round it is bound to is still the latest. No arguments checks the latest quote; or pass a quote someone else gave you. |
| `get_vault_state` | The covered call vault for TSLAc on Base, read live in one call pinned to one block: epoch, whether an epoch is live, whether sales are paused, deposit cap, total assets, the limits it enforces, the keeper, the latest price round, and what currently stops an epoch from opening. The vault is unaudited. |

No resources and no prompts. Two tools take an optional `include_signed_bytes`
flag that returns the exact signed string, so you can check the signature
yourself instead of trusting the server's check.

## Two things a model should know before quoting a result

These are in the server's `instructions` too.

1. **A signed result can be stale.** Every signed result says whether its
   signature checked and how old it is. Treat `verified: false` or
   `is_fresh: false` as not current.
2. **A quote is not a trade.** `get_stock_quote` is a reference price. Nothing
   executes from it, and `get_vault_state` says whether deposits are open at
   all (read `deposits_open`).

## Do not take this README's word for it

This file describes a live server, and a live server can quietly stop matching
its documentation. So check it:

```
node probe.mjs
```

It runs the real handshake against the real endpoint, lists what is actually
offered, makes one real call, and **exits non-zero if the live tool list and the
table above have drifted apart in either direction**. No dependencies, Node 20 or
later. It runs in CI here daily for the same reason. Its user agent says
`kerne-selftest`, so the endpoint's public usage counts
([kerne.fi/api/mcp/usage](https://kerne.fi/api/mcp/usage)) leave it out.

## What is in this repository

`server.json` is the registry descriptor. `probe.mjs` is the check above. The
server itself runs on kerne.fi rather than as a package here, because it is a
remote server: there is nothing for you to run.

## History

Until 2026-10-28 this endpoint served the Kerne Honesty Index: six tools
(`list_rows`, `get_board`, `get_row`, `get_methodology`, `get_corrections`,
`get_right_of_reply`) over an hourly board of advertised versus realized
stablecoin yield. Those tools are retired, because the collector behind the
board was deleted with its server on that date. Calling one now returns a tool
error that says so. Version 2.0.0 of the registry entry describes the server as
it is today.

MIT licensed.
