/** One /context category as the bar draws it. */
export type Segment = {
  name: string
  tokens: number
  /** Theme key /context draws the category in. */
  color: string
  kind: 'used' | 'free' | 'buffer'
}

/** A snapshot of the window, taken after each turn and tool call. */
export type Snapshot = {
  segments: Segment[]
  /** Tokens in use. */
  used: number
  /** The window measured against. */
  max: number
}

declare module 'claude-code' {
  interface PluginState {
    'context-bar': { snapshot: Snapshot | null; isShown: boolean }
  }
}
