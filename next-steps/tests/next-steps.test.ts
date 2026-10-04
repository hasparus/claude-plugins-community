import { expect, test } from 'claude-code/testing'

const turn = (turnId: string, durationMs: number, agentId?: string) => ({
  reason: 'answer' as const,
  answer: 'Done. Migrated the views, tests pass, PR is up for review with screenshots attached.',
  durationMs,
  isAborted: false,
  turnId,
  ...(agentId === undefined ? {} : { agentId }),
})

test('forks only after a long main-loop turn', async ($, on) => {
  const waiters: Array<() => void> = []
  let forks = 0
  const nextFork = () => new Promise<void>(resolve => waiters.push(resolve))
  on('turn.complete', () => ({ text: '' }))
  on('model.fork', () => {
    forks += 1
    waiters.shift()?.()
    return { value: { isAnswered: false as const, reason: 'nothing-to-fork' as const } }
  })

  const first = nextFork()
  await $.turn.complete(turn('short', 20_000))
  await $.turn.complete(turn('subagent', 600_000, 'agent-1'))
  await $.turn.complete(turn('long', 600_000))
  await first
  const second = nextFork()
  await $.turn.complete(turn('long-again', 600_000))
  await second

  expect(forks).toBe(2)
})

test('minTurnMinutes moves the gate', { options: { minTurnMinutes: 0.25 } }, async ($, on) => {
  let forked: () => void = () => undefined
  const fork = new Promise<void>(resolve => (forked = resolve))
  on('turn.complete', () => ({ text: '' }))
  on('model.fork', () => {
    forked()
    return { value: { isAnswered: false as const, reason: 'nothing-to-fork' as const } }
  })

  await $.turn.complete(turn('medium', 20_000))
  await fork
})
