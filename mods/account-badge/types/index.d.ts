export type Limits = { fiveHour: number | null; sevenDay: number | null }

declare module 'claude-code' {
  interface PluginState {
    'account-badge': { account: string | null; limits: Limits }
  }
}
