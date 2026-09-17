import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { spawn, spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import test from 'node:test'

import { createNativeBridge } from '../lib/native.js'
import { createHost } from '../lib/index.js'
import { HOST_STRINGS } from '../lib/core.js'

const workspace = path.dirname(fileURLToPath(import.meta.url))
const scriptPath = path.resolve(workspace, '..', 'native', 'notify.ps1')

class FakeChild extends EventEmitter {
  constructor() {
    super()
    this.stdout = new PassThrough()
    this.stderr = new PassThrough()
    this.writes = []
    this.kills = []
    this.stdin = new EventEmitter()
    this.stdin.destroyed = false
    this.stdin.write = (value) => {
      this.writes.push(String(value))
      return true
    }
    this.stdin.end = () => {
      this.stdin.destroyed = true
    }
  }

  kill(signal) {
    this.kills.push(signal)
    return true
  }
}

function makeSpawn() {
  const calls = []
  const children = []
  const spawnImpl = (...args) => {
    const child = new FakeChild()
    calls.push(args)
    children.push(child)
    return child
  }
  return { calls, children, spawnImpl }
}

function parseWrites(child) {
  return child.writes.map((line) => JSON.parse(line))
}

test('show lazily starts fixed Windows PowerShell and writes newline JSON', () => {
  const fake = makeSpawn()
  const bridge = createNativeBridge({
    platform: 'win32',
    scriptPath: 'C:\\fixed\\notify.ps1',
    spawnImpl: fake.spawnImpl,
  })

  assert.equal(bridge.available, true)
  assert.equal(fake.calls.length, 0)

  const event = {
    id: 'event-1',
    sessionId: 'session-1',
    requestId: 'request-1',
    token: 'opaque-token',
    kind: 'question',
    title: '需要選擇',
    body: '請選一項',
    questions: [],
  }
  const settings = { sound: true, volume: 0.6 }
  assert.equal(bridge.show(event, settings), true)

  assert.equal(fake.calls.length, 1)
  const [command, args, options] = fake.calls[0]
  assert.equal(
    command,
    `${process.env.SystemRoot || 'C:\\Windows'}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`,
  )
  assert.deepEqual(args, [
    '-NoProfile',
    '-Sta',
    '-WindowStyle',
    'Hidden',
    '-File',
    'C:\\fixed\\notify.ps1',
  ])
  assert.deepEqual(options.stdio, ['pipe', 'pipe', 'pipe'])
  assert.equal(options.windowsHide, true)
  assert.deepEqual(parseWrites(fake.children[0]), [
    { type: 'show', event, settings },
  ])
  assert.match(fake.children[0].writes[0], /\n$/)

  bridge.dispose()
  fake.children[0].emit('close', 0, null)
})

test('the host card wording rides along with the show message', () => {
  const fake = makeSpawn()
  const bridge = createNativeBridge({ platform: 'win32', spawnImpl: fake.spawnImpl })
  const event = { id: 'event-1', kind: 'question', title: 'Pick one' }
  const labels = { header: 'Zeta Notify', submit: 'Send answer' }

  assert.equal(bridge.show(event, { preview: true }, labels), true)
  // A non-object block is dropped so the script keeps its own constants.
  assert.equal(bridge.show(event, { preview: true }, 'en'), true)

  assert.deepEqual(parseWrites(fake.children[0]), [
    { type: 'show', event, settings: { preview: true }, labels },
    { type: 'show', event, settings: { preview: true } },
  ])
  bridge.dispose()
  fake.children[0].emit('close', 0, null)
})

test('an English host sends English card labels and a Chinese host sends Chinese ones', () => {
  for (const [language, expected] of [['en', HOST_STRINGS.en.native], ['zh', HOST_STRINGS.zh.native]]) {
    const sent = []
    const bridge = {
      available: true,
      show: (_event, _settings, labels) => {
        sent.push(labels)
        return true
      },
      close: () => {},
      dispose: () => {},
    }
    const ctx = {
      connection: { requestRejection: () => 401 },
      webServer: { register: () => () => {} },
      on: () => () => {},
    }
    const host = createHost(ctx, { bridge, language })
    host.center.publish({ kind: 'completed', sessionId: 'session-1' })

    assert.equal(sent.length, 1)
    assert.deepEqual(sent[0], expected)
    host.dispose()
  }

  assert.equal(HOST_STRINGS.en.native.header, 'Zeta Notify')
  assert.equal(HOST_STRINGS.en.native.submit, 'Send answer')
  assert.equal(HOST_STRINGS.en.native.allowOnce, 'Allow once')
  assert.equal(HOST_STRINGS.en.native.reject, 'Reject')
  assert.equal(HOST_STRINGS.en.native.later, 'Later')
  assert.equal(HOST_STRINGS.en.native.close, 'Close')
  assert.equal(HOST_STRINGS.en.native.custom, 'Other / more')
  assert.equal(HOST_STRINGS.en.native.defaultTitle, 'DSH notification')
  assert.equal(HOST_STRINGS.zh.native.header, 'Zeta 通知')
  assert.equal(HOST_STRINGS.zh.native.submit, '送出回答')
  assert.deepEqual(Object.keys(HOST_STRINGS.en.native), Object.keys(HOST_STRINGS.zh.native))
})

test('close never spawns a helper and sends a close message when running', () => {
  const fake = makeSpawn()
  const bridge = createNativeBridge({ platform: 'win32', spawnImpl: fake.spawnImpl })

  assert.equal(bridge.close('missing'), false)
  assert.equal(fake.calls.length, 0)

  bridge.show({ id: 'event-1', kind: 'complete' }, {})
  assert.equal(bridge.close('event-1'), true)
  assert.deepEqual(parseWrites(fake.children[0]).slice(-1), [
    { type: 'close', id: 'event-1' },
  ])

  bridge.dispose()
  fake.children[0].emit('close', 0, null)
})

test('preview off strips ordinary notification detail before crossing the pipe', () => {
  const fake = makeSpawn()
  const bridge = createNativeBridge({ platform: 'win32', spawnImpl: fake.spawnImpl })
  const event = {
    id: 'event-1',
    sessionId: 'session-secret',
    kind: 'complete',
    title: 'Private title',
    body: 'Private body',
    detail: 'Private detail',
    toolName: 'private-tool',
    reason: 'Private reason',
    createdAt: '2026-09-16T00:00:00.000Z',
  }

  bridge.show(event, { preview: false, sound: false })

  assert.deepEqual(parseWrites(fake.children[0]), [{
    type: 'show',
    event: {
      id: 'event-1',
      kind: 'complete',
      createdAt: '2026-09-16T00:00:00.000Z',
    },
    settings: { preview: false, sound: false },
  }])
  bridge.dispose()
  fake.children[0].emit('close', 0, null)
})

test('preview off preserves interactive detail required for a decision', () => {
  const fake = makeSpawn()
  const bridge = createNativeBridge({ platform: 'win32', spawnImpl: fake.spawnImpl })
  const event = {
    id: 'event-1',
    sessionId: 'session-1',
    requestId: 'request-1',
    token: 'opaque-token',
    kind: 'approval',
    title: 'Approval required',
    body: 'The command needs approval',
    toolName: 'shell',
    reason: 'Run a focused test',
  }

  bridge.show(event, { preview: false })

  assert.deepEqual(parseWrites(fake.children[0])[0].event, event)
  bridge.dispose()
  fake.children[0].emit('close', 0, null)
})

test('valid helper actions are forwarded with untouched request metadata', () => {
  const fake = makeSpawn()
  const actions = []
  const errors = []
  const bridge = createNativeBridge({
    platform: 'win32',
    spawnImpl: fake.spawnImpl,
    onAction: (action) => actions.push(action),
    onError: (error) => errors.push(error),
  })
  bridge.show({ id: 'event-1', kind: 'question' }, {})

  const respond = {
    type: 'respond',
    id: 'event-1',
    requestId: 'request-1',
    sessionId: 'session-1',
    token: 'verbatim-token',
    answers: [{ id: 'q1', selected: ['全部'], custom: '自訂文字' }],
  }
  const dismiss = {
    type: 'dismiss',
    id: 'event-2',
    requestId: 'request-2',
    sessionId: 'session-2',
    token: 'another-token',
  }

  fake.children[0].stdout.write(
    `${JSON.stringify({ type: 'ready' })}\n${JSON.stringify(respond)}\n${JSON.stringify(dismiss)}\n`,
  )

  assert.deepEqual(actions, [{ type: 'ready' }, respond, dismiss])
  assert.deepEqual(errors, [])
  bridge.dispose()
  fake.children[0].emit('close', 0, null)
})

test('replacement helper ready clears the host failure state', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 })
  const fake = makeSpawn()
  let host
  const bridge = createNativeBridge({
    platform: 'win32',
    spawnImpl: fake.spawnImpl,
    onAction: (action) => host.nativeAction(action),
    onError: () => host.nativeFailure(),
  })
  const ctx = {
    connection: { requestRejection: () => 401 },
    webServer: { register: () => () => {} },
    on: () => () => {},
  }
  host = createHost(ctx, { bridge })
  bridge.show({ id: 'first', kind: 'completed' }, {})
  const first = fake.children[0]
  first.stdin.emit('error', Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }))
  assert.ok(host.snapshot().native.error)
  context.mock.timers.tick(1_001)
  bridge.show({ id: 'replacement', kind: 'completed' }, {})
  first.stdout.write('{"type":"ready"}\n')
  assert.ok(host.snapshot().native.error)
  fake.children[1].stdout.write('{"type":"ready"}\n')
  assert.equal(host.snapshot().native.error, undefined)
  host.dispose()
  fake.children[1].emit('close', 0, null)
})

test('each shown protocol line is forwarded exactly once', () => {
  const fake = makeSpawn()
  const actions = []
  const bridge = createNativeBridge({
    platform: 'win32',
    spawnImpl: fake.spawnImpl,
    onAction: (action) => actions.push(action),
  })
  bridge.show({ id: 'event-1', kind: 'complete' }, {})

  fake.children[0].stdout.write('{"type":"shown","id":"event-1"}\n')

  assert.deepEqual(actions, [{ type: 'shown', id: 'event-1' }])
  bridge.dispose()
  fake.children[0].emit('close', 0, null)
})

test('malformed, unknown, and oversized helper output report errors without actions', () => {
  const fake = makeSpawn()
  const actions = []
  const errors = []
  const bridge = createNativeBridge({
    platform: 'win32',
    spawnImpl: fake.spawnImpl,
    onAction: (action) => actions.push(action),
    onError: (error) => errors.push(error),
  })
  bridge.show({ id: 'event-1', kind: 'question' }, {})

  fake.children[0].stdout.write('{bad json}\n')
  fake.children[0].stdout.write('{"type":"respond","id":"event-1"}\n')
  fake.children[0].stdout.write('{"type":"surprise"}\n')
  fake.children[0].stdout.write('x'.repeat(128 * 1024 + 1))

  assert.equal(actions.length, 0)
  assert.equal(errors.length, 4)
  assert.ok(errors.every((error) => error instanceof Error))
  assert.match(errors[3].message, /128 KiB/)
  bridge.dispose()
  fake.children[0].emit('close', 0, null)
})

test('an unexpected crash is reported and immediate show does not relaunch', () => {
  const fake = makeSpawn()
  const errors = []
  const bridge = createNativeBridge({
    platform: 'win32',
    spawnImpl: fake.spawnImpl,
    onError: (error) => errors.push(error),
  })
  bridge.show({ id: 'event-1', kind: 'complete' }, {})
  fake.children[0].emit('close', 9, null)

  assert.equal(errors.length, 1)
  assert.match(errors[0].message, /code 9/)
  assert.equal(bridge.show({ id: 'event-2', kind: 'error' }, {}), false)
  assert.equal(fake.calls.length, 1)
  bridge.dispose()
})

test('asynchronous stdin errors are contained and mark the helper failed', () => {
  const fake = makeSpawn()
  const errors = []
  const bridge = createNativeBridge({
    platform: 'win32',
    spawnImpl: fake.spawnImpl,
    onError: (error) => errors.push(error),
  })
  bridge.show({ id: 'event-1', kind: 'question' }, {})

  const error = Object.assign(new Error('write EPIPE'), { code: 'EPIPE' })
  fake.children[0].stdin.emit('error', error)

  assert.equal(errors.length, 1)
  assert.match(errors[0].message, /EPIPE/)
  assert.equal(bridge.show({ id: 'event-2', kind: 'question' }, {}), false)
  assert.equal(fake.calls.length, 1)
  bridge.dispose()
})

test('a helper that never becomes ready times out and cannot trap a request', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const fake = makeSpawn()
  const errors = []
  const bridge = createNativeBridge({
    platform: 'win32',
    spawnImpl: fake.spawnImpl,
    onError: (error) => errors.push(error),
  })

  assert.equal(bridge.show({ id: 'event-1', kind: 'question' }, {}), true)
  context.mock.timers.tick(10_000)

  assert.equal(errors.length, 1)
  assert.match(errors[0].message, /did not become ready within 10 seconds/)
  assert.deepEqual(fake.children[0].kills, ['SIGTERM'])
  assert.equal(bridge.show({ id: 'event-2', kind: 'question' }, {}), false)
  assert.equal(fake.calls.length, 1)
  bridge.dispose()
})

test('a delayed close from an old helper cannot clear the replacement ready timeout', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 })
  const fake = makeSpawn()
  const errors = []
  const bridge = createNativeBridge({
    platform: 'win32',
    spawnImpl: fake.spawnImpl,
    onError: (error) => errors.push(error),
  })

  assert.equal(bridge.show({ id: 'event-a', kind: 'question' }, {}), true)
  const first = fake.children[0]
  first.stdin.emit('error', Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }))

  context.mock.timers.tick(1_001)
  assert.equal(bridge.show({ id: 'event-b', kind: 'question' }, {}), true)
  const replacement = fake.children[1]
  first.emit('close', null, 'SIGTERM')
  context.mock.timers.tick(10_000)

  assert.equal(errors.length, 2)
  assert.match(errors[1].message, /did not become ready within 10 seconds/)
  assert.deepEqual(replacement.kills, ['SIGTERM'])
  bridge.dispose()
})

test('protocol actions from a failed helper generation are ignored', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 })
  const fake = makeSpawn()
  const actions = []
  const bridge = createNativeBridge({
    platform: 'win32',
    spawnImpl: fake.spawnImpl,
    onAction: (action) => actions.push(action),
  })

  bridge.show({ id: 'event-a', kind: 'complete' }, {})
  const first = fake.children[0]
  first.stdin.emit('error', Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }))
  context.mock.timers.tick(1_001)
  bridge.show({ id: 'event-b', kind: 'complete' }, {})

  first.stdout.write('{"type":"ready"}\n{"type":"shown","id":"event-a"}\n')

  assert.deepEqual(actions, [])
  bridge.dispose()
  fake.children[1].emit('close', 0, null)
})

test('oversized outbound notifications fail visibly before spawning', () => {
  const fake = makeSpawn()
  const errors = []
  const bridge = createNativeBridge({
    platform: 'win32',
    spawnImpl: fake.spawnImpl,
    onError: (error) => errors.push(error),
  })

  const shown = bridge.show(
    { id: 'event-1', kind: 'plan', detail: 'x'.repeat(128 * 1024) },
    {},
  )

  assert.equal(shown, false)
  assert.equal(fake.calls.length, 0)
  assert.equal(errors.length, 1)
  assert.match(errors[0].message, /128 KiB/)
  bridge.dispose()
})

test('dispose requests shutdown and force-kills a helper that does not exit', async () => {
  const fake = makeSpawn()
  const bridge = createNativeBridge({ platform: 'win32', spawnImpl: fake.spawnImpl })
  bridge.show({ id: 'event-1', kind: 'complete' }, {})
  const child = fake.children[0]

  bridge.dispose()

  assert.deepEqual(parseWrites(child).slice(-1), [{ type: 'shutdown' }])
  assert.equal(bridge.available, false)
  assert.equal(bridge.show({ id: 'event-2' }, {}), false)
  await new Promise((resolve) => setTimeout(resolve, 300))
  assert.deepEqual(child.kills, ['SIGTERM'])
})

test('non-Windows bridge remains unavailable and never spawns', () => {
  const fake = makeSpawn()
  const bridge = createNativeBridge({ platform: 'linux', spawnImpl: fake.spawnImpl })

  assert.equal(bridge.available, false)
  assert.equal(bridge.show({ id: 'event-1' }, {}), false)
  assert.equal(fake.calls.length, 0)
  bridge.dispose()
})

test('the helper reads every label the host sends and stays ASCII', async () => {
  const script = await readFile(scriptPath, 'utf8')
  for (const key of Object.keys(HOST_STRINGS.zh.native)) {
    assert.ok(script.includes(`'${key}'`), `notify.ps1 reads the ${key} label`)
  }
  assert.equal(/[^\x00-\x7F]/.test(script), false, 'notify.ps1 carries no literal non-ASCII text')
})

test('Windows PowerShell 5.1 parser accepts the native helper', { skip: process.platform !== 'win32' }, () => {
  const escapedPath = scriptPath.replaceAll("'", "''")
  const command = [
    `$errors = $null;`,
    `[void][System.Management.Automation.Language.Parser]::ParseFile('${escapedPath}', [ref]$null, [ref]$errors);`,
    `if ($errors.Count -gt 0) { $errors | ForEach-Object { [Console]::Error.WriteLine($_.Message) }; exit 1 }`,
  ].join(' ')
  const result = spawnSync(
    `${process.env.SystemRoot || 'C:\\Windows'}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`,
    ['-NoProfile', '-Command', command],
    { encoding: 'utf8' },
  )

  assert.equal(result.status, 0, result.stderr)
})

test('native helper becomes ready and shuts down without showing a window', { skip: process.platform !== 'win32' }, async () => {
  const executable = `${process.env.SystemRoot || 'C:\\Windows'}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
  const child = spawn(
    executable,
    ['-NoProfile', '-Sta', '-WindowStyle', 'Hidden', '-File', scriptPath],
    { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true },
  )
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')

  let stdout = ''
  let stderr = ''
  let shutdownSent = false
  child.stdout.on('data', (chunk) => {
    stdout += chunk
    if (!shutdownSent && stdout.includes('\n')) {
      shutdownSent = true
      child.stdin.end(`${JSON.stringify({ type: 'shutdown' })}\n`)
    }
  })
  child.stderr.on('data', (chunk) => {
    stderr += chunk
  })

  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`native helper timed out; stdout=${stdout}; stderr=${stderr}`))
    }, 5_000)
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      resolve({ code, signal })
    })
  })

  assert.equal(stdout.trim(), JSON.stringify({ type: 'ready' }))
  assert.equal(stderr, '')
  assert.deepEqual(result, { code: 0, signal: null })
})
