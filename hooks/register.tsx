import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Segment, Snapshot } from '../types'

const snapshot = atom({ plugin: 'context-bar', key: 'snapshot' } as const, null)
const isShown = atom({ plugin: 'context-bar', key: 'isShown' } as const, true)
const STORE_KEY = 'isShown'

/** Reads the window as /context breaks it down (local estimate, no API calls). */
async function measure($: EngineInterface): Promise<Snapshot | null> {
  const { context } = await $.session.usage({ breakdown: 'summary' })
  const b = context.breakdown
  if (b) {
    const segments: Segment[] = []
    for (const c of b.categories) {
      if (c.kind === 'deferred' || c.tokens <= 0) continue
      segments.push({ name: c.name, tokens: c.tokens, color: c.color, kind: c.kind })
    }
    return { segments, used: b.totalTokens, max: b.rawMaxTokens }
  }
  // No breakdown on this host: fall back to the status line's single figure.
  if (context.tokens === undefined) return null
  return {
    used: context.tokens,
    max: context.window,
    segments: [
      { name: 'Used', tokens: context.tokens, color: 'promptBorder', kind: 'used' },
      { name: 'Free space', tokens: Math.max(0, context.window - context.tokens), color: 'inactive', kind: 'free' },
    ],
  }
}

async function refresh($: EngineInterface) {
  try {
    const snap = await measure($)
    await update($, snapshot, () => snap)
  } catch {
    // keep the last good snapshot
  }
}

/** Splits `width` cells across segments by size; every used category gets at least one. */
export function allocate(segments: readonly Segment[], width: number): number[] {
  const total = segments.reduce((s, x) => s + x.tokens, 0)
  if (total <= 0 || width <= 0) return segments.map(() => 0)
  const exact = segments.map(s => (s.tokens / total) * width)
  const cells = exact.map(Math.floor)
  let left = width - cells.reduce((a, b) => a + b, 0)
  const byRemainder = exact
    .map((v, i) => [v - Math.floor(v), i] as const)
    .sort((a, b) => b[0] - a[0])
  for (const [, i] of byRemainder) {
    if (left <= 0) break
    cells[i] = (cells[i] ?? 0) + 1
    left -= 1
  }
  // Make tiny used categories visible, borrowing from the widest non-used one.
  segments.forEach((s, i) => {
    if (s.kind !== 'used' || (cells[i] ?? 0) > 0) return
    let donor = -1
    segments.forEach((d, j) => {
      const c = cells[j] ?? 0
      if (d.kind !== 'used' && c > 1 && (donor < 0 || c > (cells[donor] ?? 0))) donor = j
    })
    if (donor >= 0) {
      cells[donor] = (cells[donor] ?? 0) - 1
      cells[i] = 1
    }
  })
  return cells
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return `${Math.round(n)}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({
      name: 'context-bar',
      description: 'Toggle the stacked context-window bar above the prompt',
    })
    try {
      const saved = await $.store.get(STORE_KEY)
      if (typeof saved === 'boolean') await update($, isShown, () => saved)
    } catch {
      // no store on this host: default to shown
    }
    void refresh($)
    return result
  })

  on('command.run', { command: 'context-bar' }, async $ => {
    const now = await update($, isShown, v => !v)
    $.store.set(STORE_KEY, now).catch(() => {}) // remember the choice across sessions
    if (now) await refresh($)
    return { text: `Context bar ${now ? 'on' : 'off'}.` }
  })

  // Keep the bar current: after each tool call mid-turn, and when a turn ends.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (await read($, isShown)) void refresh($)
    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (await read($, isShown)) await refresh($)
    return result
  })

  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    void refresh($)
    return result
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await read($, isShown))) return next(e)
    const snap = await read($, snapshot)
    if (!snap || snap.segments.length === 0) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const pct = snap.max > 0 ? Math.round((snap.used / snap.max) * 100) : 0
    const label = ` ${pct}% · ${fmtTokens(snap.used)}/${fmtTokens(snap.max)}`
    const width = Math.max(10, e.props.bodyColumns - label.length)
    const cells = allocate(snap.segments, width)

    return (
      <Box flexDirection="column">
        <Box>
          {snap.segments.map((s, i) =>
            (cells[i] ?? 0) > 0 ? (
              <Text color={s.color}>{(s.kind === 'used' ? '█' : '░').repeat(cells[i] ?? 0)}</Text>
            ) : null,
          )}
          <Text dimColor>{label}</Text>
        </Box>
        <Box flexWrap="wrap" columnGap={2}>
          {snap.segments.map(s => (
            <Text>
              <Text color={s.color}>{s.kind === 'used' ? '■' : '□'}</Text>
              <Text dimColor> {s.name} {fmtTokens(s.tokens)}</Text>
            </Text>
          ))}
        </Box>
      </Box>
    )
  })
}
