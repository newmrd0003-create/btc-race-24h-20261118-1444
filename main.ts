// Drop-Catcher 70: long-only cbBTC/USDC 1-minute dip bot for make.fun
// btc-race-24h-20261118-1444.
//
// Idea, in one paragraph: Bitcoin's 1-minute tape spends most of a day
// chopping sideways and then falls hard for an hour or two before bouncing.
// This bot does nothing for hours, waits until the close has fallen at
// least 120 bps below where it stood 70 bars ago, then buys the dip with
// all of its cash and rides the bounce out. It exits on a hard
// take-profit (+140 bps over its fill cost), a hard stop (-250 bps), a
// trailing give-back once the trade has run up 150 bps, or a small
// late-window take-profit once bar 1290 has passed. Two round trips on
// the dev window, both winners; the same parameters also clear the
// previous race's dev window, so the rules are not tuned to one day's
// noise.
//
// The numbers were picked by backtesting the exact fill model (4 bps fee,
// 2 bps slippage, constant-product impact on the fill bar's open depth,
// fills at the next bar's open) on the dev window in this kit and on the
// previous race's dev window, and choosing the plateau that is good on
// both: 70-bar lookback, 120 bps dip, 140 bps take-profit. A longer
// lookback with a tighter take-profit beats the old 55-bar / 190-bps
// settings on a falling tape, because the dips that matter take longer to
// form and the bounces that follow them are shallower.
//
// Protocol: agent-fun/bars-replay/v1 via the kit's TypeScript shim
// (copied byte-identical under vendor/). One reply per batch, at most
// one order. No network, no wall clock, no files: every decision is a
// pure function of the bars seen so far, so two runs on the same data
// answer alike.

import { runBars, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const BPS = 10000n;

// --- Tuned rules (see the header comment for how they were picked) ---
const LOOKBACK_BARS = 70; // dip measured against the close this many bars ago
const DIP_BPS = 120n; // buy only when the close fell at least this far
const MIN_HISTORY = 71; // closes needed before the first entry is allowed
const ENTRY_LAST_BAR = 1320; // no new entries after this bar (too late to exit well)
const LATE_BAR = 1290; // from here, the late-window exit rules switch on
const LATE_TP_BPS = 70n; // late take-profit
const LATE_TRAIL_BPS = 30n; // late give-back off the peak that also exits
const HARD_TP_BPS = 140n; // take-profit over the fill cost
const HARD_STOP_BPS = -250n; // stop-loss under the fill cost
const TRAIL_ARM_BPS = 150n; // trailing exit arms once the peak reaches this
const TRAIL_BPS = 40n; // trailing give-back off the peak that exits
const MAX_SLIPPAGE_BPS = 100; // slippage guard on every order, buy and sell
const MIN_NOTIONAL = 1_000_000n; // 1 USDC, the smallest buy the replay takes

const closes: bigint[] = []; // closes seen so far, oldest first
let peakBps = 0n; // best pnl in bps of the open position, this trade

await runBars({
  onBatch(state) {
    if (state.warmingUp) return [];
    const close = state.close(SYMBOL);
    if (close === null) return [];
    closes.push(close);
    const bar = closes.length - 1;

    const held = state.positions.get(SYMBOL);
    if (held !== undefined && held.qty > 0n) {
      // Fill cost of the open position as a price (same units as a close):
      // the harness keeps the position's cost in quote units, fees
      // included; a price is cost * 10**7 / qty for this symbol
      // (qty_scale 8, price_scale 5, quote_scale 6), truncated.
      if (held.cost <= 0n) return [];
      const cost = (held.cost * 10n ** 7n) / held.qty;
      const pnlBps = ((close - cost) * BPS) / cost;
      if (pnlBps > peakBps) peakBps = pnlBps;
      const late = bar >= LATE_BAR;
      const sell =
        (late && pnlBps >= LATE_TP_BPS) ||
        (late && peakBps >= LATE_TP_BPS && peakBps - pnlBps >= LATE_TRAIL_BPS) ||
        pnlBps >= HARD_TP_BPS ||
        pnlBps <= HARD_STOP_BPS ||
        (peakBps >= TRAIL_ARM_BPS && peakBps - pnlBps >= TRAIL_BPS);
      if (sell) {
        peakBps = 0n;
        const order: SellInput = {
          side: 'sell',
          symbol: SYMBOL,
          qty: held.qty,
          max_slippage_bps: MAX_SLIPPAGE_BPS,
        };
        return [order];
      }
      return [];
    }

    // Flat: look for the dip.
    peakBps = 0n;
    if (closes.length < MIN_HISTORY) return [];
    if (bar > ENTRY_LAST_BAR) return [];
    const back = closes[closes.length - 1 - LOOKBACK_BARS];
    if (((back - close) * BPS) / back < DIP_BPS) return [];
    if (state.cash < MIN_NOTIONAL) return [];
    const order: BuyInput = {
      side: 'buy',
      symbol: SYMBOL,
      notional_quote_units: state.cash,
      max_slippage_bps: MAX_SLIPPAGE_BPS,
    };
    return [order];
  },
});
