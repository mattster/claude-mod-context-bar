import { describe, expect, mock, test } from 'claude-code/testing'
import type { SessionUsage } from 'claude-code'

import { allocate } from '../hooks/register'

const TOGGLE = {
  command: 'context-bar',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 80 },
} as const

const SURFACES = ['terminal', 'desktop'] as const

const PROPS = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 20,
  bodyColumns: 80,
  scroll: { offset: 0, bodyRows: 20 },
  view: {},
}

const cat = (name: string, tokens: number, color: string, kind: string) =>
  ({ name, tokens, color, isDeferred: kind === 'deferred', kind })

const USAGE = {
  startedAt: 0,
  rateLimits: [],
  context: {
    tokens: 62_000,
    window: 200_000,
    percent: 31,
    breakdown: {
      categories: [
        cat('System prompt', 3_000, 'promptBorder', 'used'),
        cat('System tools', 14_000, 'inactive', 'used'),
        cat('Memory files', 900, 'claude', 'used'),
        cat('Messages', 44_100, 'permission', 'used'),
        cat('MCP tools (deferred)', 9_000, 'warning', 'deferred'),
        cat('Autocompact buffer', 45_000, 'inactive', 'buffer'),
        cat('Free space', 93_000, 'inactive', 'free'),
      ],
      totalTokens: 62_000,
      rawMaxTokens: 200_000,
    },
  },
} as unknown as SessionUsage

describe('context-bar', () => {
  for (const surface of SURFACES) {
    test(`draws one segment per category on ${surface}, toggles off and on`, async ($, on) => {
      mock.store(on)
      on('session.usage', () => ({ value: USAGE }))
      // Stands for the engine's own empty band beneath the plugin.
      on('ui.render', ($, e) => {
        const { Box } = $.ui.resolve(e)
        return <Box key="engine-band" />
      })

      // Off, then on again (turning on takes a fresh reading).
      expect((await $.command.run(TOGGLE)).text).toBe('Context bar off.')
      const hidden = await $.ui.mount({ plugin: 'context-bar', surface, component: 'AbovePrompt', props: PROPS })
      expect(await hidden.find({ key: 'engine-band' })).toBeDefined()
      expect(await hidden.find({ text: /Messages/ })).toBeUndefined()
      await hidden.unmount()

      expect((await $.command.run(TOGGLE)).text).toBe('Context bar on.')
      const ui = await $.ui.mount({ plugin: 'context-bar', surface, component: 'AbovePrompt', props: PROPS })
      expect(await ui.find({ text: /31% · 62\.0k\/200\.0k/ })).toBeDefined()
      for (const name of ['System prompt', 'System tools', 'Memory files', 'Messages', 'Free space']) {
        expect(await ui.find({ text: new RegExp(name) })).toBeDefined()
      }
      // Deferred tool schemas sit outside the window, as /context leaves them out.
      expect(await ui.find({ text: /MCP tools/ })).toBeUndefined()
    })
  }

  test('allocates every cell and keeps small categories visible', () => {
    const segs = [
      { name: 'a', tokens: 100, color: 'x', kind: 'used' as const },
      { name: 'b', tokens: 50_000, color: 'x', kind: 'used' as const },
      { name: 'c', tokens: 149_900, color: 'x', kind: 'free' as const },
    ]
    const cells = allocate(segs, 40)
    expect(cells.reduce((s, n) => s + n, 0)).toBe(40)
    expect(cells[0]).toBe(1)
    expect(cells[1]).toBe(10)
  })
})
