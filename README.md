# honesty-index-mcp

**Advertised versus realized yield for stablecoin vaults, as a Model Context
Protocol server. Remote, no key, no account, nothing to install.**

```
https://kerne.fi/api/mcp
```

Streamable HTTP. Stateless. Free, and it stays free: the numbers behind it are
already served without a key at
[kerne.fi/api/honesty-index](https://kerne.fi/api/honesty-index), and putting
them behind one would defeat the argument the board is making.

## Add it

Claude Code:

```
claude mcp add --transport http kerne-honesty-index https://kerne.fi/api/mcp
```

Anything that reads a config file:

```json
{
  "mcpServers": {
    "kerne-honesty-index": {
      "type": "http",
      "url": "https://kerne.fi/api/mcp"
    }
  }
}
```

Registry name: `io.github.kerne-protocol/honesty-index`

## What it answers

The [Kerne Honesty Index](https://kerne.fi/honesty-index) is an hourly, signed
board comparing what synthetic and yield-bearing dollars **advertise** against
what their holders actually **realized**, computed from ERC-4626 share price
growth on chain over a thirty day window. Kerne Protocol publishes it, is
measured on it, and lists its own row first by rule.

| Tool | What it returns |
| --- | --- |
| `list_rows` | The roster: key, protocol, symbol, chain, contract address. Cheap. Call it first. |
| `get_board` | Every row with its advertised figure, its realized figure, the stated gap, the delivery ratio, plus the board summary and the snapshot's provenance. |
| `get_row` | One row with everything behind it: the verbatim advertised quote and the first-party page it was read from, the capture date, both block heights, both share prices, the arithmetic, and the exact `eth_call` payloads to reproduce it. |
| `get_methodology` | The measurement, the comparability rules that decide when a gap may be stated at all, the ten day capture expiry, and what the board deliberately does not cover. |
| `get_corrections` | The append-only log of every time the board changed something it had stated about a named company, with both values and the rule that stops a repeat. |
| `get_right_of_reply` | The free, permanent, unedited reply slot every measured protocol has on its own row, its terms, and every reply received. |

One resource, `kerne://honesty-index/snapshot`, is the raw signed snapshot
including the canonical payload, its sha256 attestation hash and the EIP-191
signature over it.

## Three things a model should know before quoting a row

These are in the server's `instructions` too, because getting them wrong
produces a confident false statement about a named company.

1. **A null gap is not zero.** It means the two figures cover different periods,
   or the advertised capture is older than the freshness limit, or the protocol
   publishes no first-party figure at all. Absence is never a finding of
   non-payment.
2. **Rank on the delivery ratio, not the point gap.** A percentage point gap is
   not comparable across products at different rates, and this board spans
   several.
3. **A protocol in an announced wind down paying nothing is behaving
   correctly.** Read the `status` field beside the figure.

The board scores one axis. It is not an audit, not a rating, not a solvency
opinion, and it says nothing about the hedge or the reserves of any protocol on
it, including Kerne's.

## Do not take the server's word for it

Every figure it serves is re-derivable from public chain data by a program that
shares no code with the one that produced it:

```
npx -y github:kerne-protocol/realized-apy check
```

That is a second implementation with its own decoder, its own arithmetic, and
keccak256 and secp256k1 written from scratch rather than taken from a library.
It re-reads every row at the block heights the signed snapshot names and prints
PASS or FAIL. Method, tolerances and what happens if you get a different answer:
[kerne.fi/honesty-index/reproduce](https://kerne.fi/honesty-index/reproduce).

## Do not take this README's word for it either

This file describes a live server, and a live server can quietly stop matching
its documentation. So check it:

```
node probe.mjs
```

It runs the real handshake against the real endpoint, lists what is actually
offered, makes one real call, and **exits non-zero if the live tool list and the
table above have drifted apart in either direction**. No dependencies, Node 20 or
later. It runs in CI here on a schedule for the same reason.

## Right of reply

Every protocol this board publishes a number about has a free, permanent,
unedited reply slot on its own row. Published verbatim, never edited, never
removed, published whether or not it agrees with us, and we never answer inside
one. Nothing is charged for it and no commercial conversation is a condition of
it. Terms and form:
[kerne.fi/honesty-index/reproduce#right-of-reply](https://kerne.fi/honesty-index/reproduce#right-of-reply).

## What is in this repository

`server.json` is the registry descriptor. `probe.mjs` is the check above. The
server itself is a route on kerne.fi rather than a package here, because it is a
remote server: there is nothing for you to run, and a copy of the handler in this
repository would be a second thing to keep in step with the first.

MIT licensed.
