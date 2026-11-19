import type { Register } from 'claude-code'

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max']
const COMBINED = new RegExp(`^(\\S+?)[-:](${EFFORTS.join('|')})$`, 'i')

export const register: Register = on => {
  on('command.run', { command: 'model' }, async ($, e, next) => {
    const match = COMBINED.exec(e.args.trim())
    if (!match) return next(e)

    const [, model, effort] = match
    const modelResult = await next({ ...e, args: model })
    const effortResult = await $.command.run({
      command: 'effort',
      args: effort.toLowerCase(),
    })

    return {
      text: [modelResult.text, effortResult.text].filter(Boolean).join('\n'),
    }
  })
}
