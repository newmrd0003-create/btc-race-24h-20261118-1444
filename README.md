[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/newmrd0003-create/btc-race-24h-20261118-1444/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/newmrd0003-create/btc-race-24h-20261118-1444/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

Built for [make.fun's "Race a BTC trading bot live for 24 hours" bounty](https://make.fun/bounty/btc-race-24h-20261118-1444) ($250 in USDC).

# Drop-Catcher 70

Long-only cbBTC/USDC 1-minute dip bot for the make.fun competition
**btc-race-24h-20261118-1444** — race a BTC trading bot live for 24 hours.

## How it trades

Bitcoin's 1-minute tape chops sideways most of the day, then falls hard
for an hour or two before bouncing. This bot waits: it only buys when
the close has fallen at least **120 bps below the close 70 bars ago**,
then goes all-in with its cash and rides the bounce out.

Exits (all measured against the fill cost, from the harness's own
position cost):

- **Hard take-profit** +140 bps
- **Hard stop** −250 bps
- **Trailing exit** once the trade has peaked at +150 bps and gives
  back 40 bps
- **Late-window exit** from bar 1290: take +70 bps, or exit on a
  30 bps give-back off a +70 bps peak

No new entries after bar 1320. At most one open position, one order per
batch, 100 bps max slippage on every order.

## Why these numbers

Backtested with the exact fill model (4 bps fee, 2 bps slippage,
constant-product impact on the fill bar's open depth, fills at the next
bar's open) on this competition's dev window **and** on the previous
race's dev window, picking the plateau that is good on both — not the
peak of either one alone:

| Dev window | Net PnL | Trades | Max drawdown |
| --- | --- | --- | --- |
| btc-race-24h-20261118-1444 (this race) | **+$24.61** | 4 (2 round trips, both winners) | 1.48% |
| btc-race-24h-20261117-0603 (previous race) | **+$32.63** | 6 (3 round trips) | 0.72% |

The longer 70-bar lookback with a tighter 140 bps take-profit beats the
older 55-bar / 190-bps settings on a falling tape: the dips that matter
take longer to form and the bounces that follow them are shallower. The
fitted-foresight ceiling on this window is about +$92, so +$24.61 is a
causal strategy's honest share of it, not a fitted schedule.

Verified with the kit's own grader (`makefun grade-local --driver
process`): net PnL 24.611884 USDC, 0 rejected orders, L1 regrade
reproduced byte for byte.

## Run it

Node 22, standard library only plus the kit's Python/TypeScript shim
copied byte-identical under `vendor/`:

```sh
node main.ts
```

The bot speaks `agent-fun/bars-replay/v1` on stdin/stdout. It reads no
wall clock, no files and no environment: every decision is a pure
function of the bars seen so far.

## License

MIT — see [LICENSE](LICENSE).
