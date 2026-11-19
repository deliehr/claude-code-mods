import { atom, read, update } from 'claude-code'
import type { Register, SessionRateLimit } from 'claude-code'

import type { Limits } from '../types'

type OAuthAccount = {
  emailAddress?: string
  seatTier?: string
  organizationType?: string
  billingType?: string
}

const SEAT_LABELS: Record<string, string> = {
  team_tier_1: 'premium',
  team_tier_0: 'standard',
  team_standard: 'standard',
  team_premium: 'premium',
  enterprise_tier_1: 'premium',
  enterprise_tier_0: 'standard',
}

const account = atom({ plugin: 'account-badge', key: 'account' } as const, null)
const limits = atom(
  { plugin: 'account-badge', key: 'limits' } as const,
  { fiveHour: null, sevenDay: null },
)

const seatLabel = (oauth: OAuthAccount) => {
  const tier = oauth.seatTier
  if (tier) return SEAT_LABELS[tier] ?? tier
  return oauth.organizationType ?? oauth.billingType ?? 'unknown seat'
}

const toLimits = (windows: readonly SessionRateLimit[]): Limits => ({
  fiveHour: windows.find(w => w.kind === 'five_hour')?.percentUsed ?? null,
  sevenDay: windows.find(w => w.kind === 'seven_day')?.percentUsed ?? null,
})

const percent = (value: number | null) => (value === null ? '–' : `${Math.round(value)}%`)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    $.ui.status(undefined)

    try {
      const configDir = await $.env.get('CLAUDE_CONFIG_DIR')
      const home = await $.env.get('HOME')
      const path = configDir ? `${configDir}/.claude.json` : `${home}/.claude.json`
      const config = JSON.parse(await $.fs.read(path)) as { oauthAccount?: OAuthAccount }
      const oauth = config.oauthAccount
      const text = oauth?.emailAddress
        ? `${oauth.emailAddress} (${seatLabel(oauth)})`
        : 'no claude.ai account'

      await update($, account, () => text)
    } catch (error) {
      await update($, account, () => null)
      $.ui.log(`account-badge: ${String(error)}`, { to: 'debug' })
    }

    const usage = await $.session.usage()
    await update($, limits, () => toLimits(usage.rateLimits))

    return result
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      await update($, limits, () => toLimits(e.rateLimits))
    }
    return next(e)
  })

  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const text = await read($, account)
    if (!text) return next(e)

    const { fiveHour, sevenDay } = await read($, limits)
    const line = `Account: ${text} (${percent(fiveHour)}/${percent(sevenDay)})`

    return next({ ...e, props: { ...e.props, modes: [line, ...e.props.modes] } })
  })
}
