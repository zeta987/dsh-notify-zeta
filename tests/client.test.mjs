import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

const CLIENT_PATH = new URL('../lib/client.js', import.meta.url)

async function loadClient(overrides = {}) {
  const source = await readFile(CLIENT_PATH, 'utf8')
  let registration
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    Fragment: Symbol('Fragment'),
    useCallback: (fn) => fn,
    useEffect: () => {},
    useMemo: (fn) => fn(),
    useRef: (value) => ({ current: value }),
    useState: (value) => [typeof value === 'function' ? value() : value, () => {}],
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  }
  const document = overrides.document ?? {
    hidden: false,
    hasFocus: () => true,
    head: { appendChild() {} },
    getElementById: () => null,
    createElement: () => ({ dataset: {}, textContent: '' }),
    addEventListener() {},
    removeEventListener() {},
  }
  const window = {
    __ModuleLoader__: { load(value) { registration = value } },
    document,
    addEventListener() {},
    removeEventListener() {},
    focus() {},
    ...overrides.window,
  }
  const sandbox = {
    AbortController,
    console,
    crypto: overrides.crypto ?? { randomUUID: () => 'client-1' },
    document,
    EventSource: overrides.EventSource,
    fetch: overrides.fetch,
    Notification: overrides.Notification,
    setInterval: overrides.setInterval ?? (() => 1),
    clearInterval: overrides.clearInterval ?? (() => {}),
    setTimeout,
    clearTimeout,
    URL,
    window,
  }
  sandbox.globalThis = sandbox
  vm.runInNewContext(source, sandbox, { filename: CLIENT_PATH.pathname })
  assert.equal(registration.id, 'dsh-notify-zeta')
  const exports = registration.factory((id) => {
    assert.equal(id, 'react')
    return React
  })
  return { exports, window, document }
}

function settings(patch = {}) {
  return {
    enabled: true,
    native: true,
    browser: true,
    sound: false,
    backgroundOnly: false,
    preview: true,
    includeSubagents: false,
    events: {
      completed: true,
      error: true,
      aborted: true,
      interrupted: true,
      blocked: true,
      maxTokens: true,
      approval: true,
      question: true,
      planReview: true,
      compaction: true,
      jobCompleted: true,
      jobFailed: true,
      jobKilled: true,
      goal: true,
    },
    ...patch,
  }
}

function snapshot(history = [], patch = {}) {
  return {
    instanceId: 'instance-1',
    revision: 1,
    settings: settings(),
    history,
    pending: [],
    native: { available: true },
    ...patch,
  }
}

function event(patch = {}) {
  return {
    id: 'event-1',
    sessionId: 'session-1',
    kind: 'completed',
    title: '背景任務完成',
    body: '已整理完資料。',
    questions: [],
    createdAt: '2026-09-16T00:00:00.000Z',
    ...patch,
  }
}

function jsonResponse(status, value) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return value },
  }
}

test('registers the installed DSH settings section contract', async () => {
  const { exports } = await loadClient()
  let injected
  let registered
  const ctx = {
    slots: {
      inject(name, factory) { injected = name; return factory() },
      register(entry, component) { registered = { entry, component } },
    },
    sessions: { list: { getSnapshot: () => ({ current: undefined }), subscribe: () => () => {} } },
    locale: {},
    effect() {},
  }

  exports.apply(ctx)

  assert.deepEqual(Array.from(exports.inject), ['slots', 'sessions', 'locale'])
  assert.equal(injected, 'settings.section')
  assert.equal(registered.entry.name, 'settings.section')
  assert.equal(registered.entry.id, 'zeta-notify')
  assert.equal(registered.entry.order, 60)
  assert.equal(registered.entry.label(), 'Zeta 通知')
  assert.equal(typeof registered.component, 'function')
})

test('seeds existing ids and only delivers newly observed events once', async () => {
  const delivered = []
  class FakeNotification {
    static permission = 'granted'
    constructor(title, options) { delivered.push({ title, options, instance: this }) }
    close() {}
  }
  const { exports } = await loadClient({ Notification: FakeNotification })
  const runtime = exports.createClientRuntime({
    NotificationApi: FakeNotification,
    document: { hidden: true, hasFocus: () => false },
    window: { focus() {} },
  })

  runtime.acceptSnapshot(snapshot([event()]), { baseline: true })
  assert.equal(delivered.length, 0)

  const second = event({ id: 'event-2', title: '新的完成事件' })
  runtime.acceptSnapshot(snapshot([event(), second]))
  runtime.acceptSnapshot(snapshot([event(), second]))

  assert.equal(delivered.length, 1)
  assert.equal(delivered[0].title, '新的完成事件')
})

test('delivers one browser fallback when a fresh native notification later fails', async () => {
  const delivered = []
  class FakeNotification {
    static permission = 'granted'
    constructor(title) { delivered.push(title) }
  }
  const { exports } = await loadClient({ Notification: FakeNotification })
  const runtime = exports.createClientRuntime({
    NotificationApi: FakeNotification,
    document: { hidden: true, hasFocus: () => false },
  })
  const nativeEvent = event({ id: 'native-fallback', nativeDelivered: true })

  runtime.acceptSnapshot(snapshot([], { revision: 1 }), { baseline: true })
  runtime.acceptSnapshot(snapshot([nativeEvent], { revision: 2 }))
  assert.equal(delivered.length, 0)

  runtime.acceptSnapshot(snapshot([{ ...nativeEvent, nativeDelivered: false }], { revision: 3 }))
  assert.deepEqual(delivered, ['背景任務完成'])

  runtime.acceptSnapshot(snapshot([{ ...nativeEvent, nativeDelivered: false }], { revision: 4 }))
  assert.equal(delivered.length, 1)
})

test('never turns an initial native-delivered history entry into a browser replay', async () => {
  const delivered = []
  class FakeNotification {
    static permission = 'granted'
    constructor(title) { delivered.push(title) }
  }
  const { exports } = await loadClient({ Notification: FakeNotification })
  const runtime = exports.createClientRuntime({
    NotificationApi: FakeNotification,
    document: { hidden: true, hasFocus: () => false },
  })
  const oldEvent = event({ id: 'old-native', nativeDelivered: true })

  runtime.acceptSnapshot(snapshot([oldEvent], { revision: 8 }), { baseline: true })
  runtime.acceptSnapshot(snapshot([{ ...oldEvent, nativeDelivered: false }], { revision: 9 }))

  assert.equal(delivered.length, 0)
})

test('does not fallback-notify requests already resolved or cancelled', async () => {
  const delivered = []
  class FakeNotification {
    static permission = 'granted'
    constructor(title) { delivered.push(title) }
  }
  const { exports } = await loadClient({ Notification: FakeNotification })
  const runtime = exports.createClientRuntime({
    NotificationApi: FakeNotification,
    document: { hidden: true, hasFocus: () => false },
  })
  const approval = event({ id: 'resolved-approval', kind: 'approval', requestId: 'request-a', nativeDelivered: true })
  const question = event({ id: 'cancelled-question', kind: 'question', requestId: 'request-q', nativeDelivered: true })

  runtime.acceptSnapshot(snapshot([], { revision: 1 }), { baseline: true })
  runtime.acceptSnapshot(snapshot([approval, question], { revision: 2 }))
  runtime.acceptSnapshot(snapshot([
    { ...approval, nativeDelivered: false, resolved: true },
    { ...question, nativeDelivered: false, cancelled: true },
  ], { revision: 3 }))

  assert.equal(delivered.length, 0)
})

test('discards a delayed HTTP state response after a newer SSE state was accepted', async () => {
  let finishHttp
  const responseReady = new Promise((resolve) => { finishHttp = resolve })
  const fetch = async () => {
    await responseReady
    return jsonResponse(200, snapshot([], { instanceId: 'instance-a', revision: 1 }))
  }
  const { exports } = await loadClient({ fetch })
  const runtime = exports.createClientRuntime({ fetch })
  runtime.acceptSnapshot(snapshot([], { instanceId: 'instance-a', revision: 1 }), { baseline: true })

  const loading = runtime.refresh()
  runtime.acceptSnapshot(snapshot([event({ id: 'new-sse' })], { instanceId: 'instance-a', revision: 2 }))
  finishHttp()
  assert.equal(await loading, true)

  assert.equal(runtime.getState().snapshot.revision, 2)
  assert.equal(runtime.getState().snapshot.history[0].id, 'new-sse')
})

test('rejects a lower revision from the same host instance', async () => {
  const { exports } = await loadClient()
  const runtime = exports.createClientRuntime()
  const newest = event({ id: 'newest-state' })
  runtime.acceptSnapshot(snapshot([newest], { instanceId: 'instance-a', revision: 4 }), { baseline: true })

  const accepted = runtime.acceptSnapshot(snapshot([], { instanceId: 'instance-a', revision: 3 }))

  assert.equal(accepted, false)
  assert.equal(runtime.getState().snapshot.revision, 4)
  assert.equal(runtime.getState().snapshot.history[0].id, 'newest-state')
})

test('accepts a new host instance revision reset and reseeds without replaying its history', async () => {
  const delivered = []
  class FakeNotification {
    static permission = 'granted'
    constructor(title) { delivered.push(title) }
  }
  const { exports } = await loadClient({ Notification: FakeNotification })
  const runtime = exports.createClientRuntime({
    NotificationApi: FakeNotification,
    document: { hidden: true, hasFocus: () => false },
  })
  const restartHistory = event({ id: 'restart-history', title: '重啟前既有通知' })

  runtime.acceptSnapshot(snapshot([], { instanceId: 'instance-a', revision: 9 }), { baseline: true })
  runtime.acceptSnapshot(snapshot([restartHistory], { instanceId: 'instance-b', revision: 1 }))
  assert.equal(runtime.getState().snapshot.instanceId, 'instance-b')
  assert.equal(runtime.getState().snapshot.revision, 1)
  assert.equal(delivered.length, 0)

  runtime.acceptSnapshot(snapshot([
    event({ id: 'after-restart', title: '重啟後新通知' }),
    restartHistory,
  ], { instanceId: 'instance-b', revision: 2 }))
  assert.deepEqual(delivered, ['重啟後新通知'])
})

test('browser delivery obeys settings, visibility, native deduplication and privacy preview', async () => {
  const { exports } = await loadClient()
  const base = event()
  assert.equal(exports.browserDeliveryDecision(settings(), base, { permission: 'granted', hidden: true }), true)
  assert.equal(exports.browserDeliveryDecision(settings({ enabled: false }), base, { permission: 'granted', hidden: true }), false)
  assert.equal(exports.browserDeliveryDecision(settings({ browser: false }), base, { permission: 'granted', hidden: true }), false)
  assert.equal(exports.browserDeliveryDecision(settings({ events: { ...settings().events, completed: false } }), base, { permission: 'granted', hidden: true }), false)
  assert.equal(exports.browserDeliveryDecision(settings({ backgroundOnly: true }), base, { permission: 'granted', hidden: false, currentSessionId: 'session-1' }), false)
  assert.equal(exports.browserDeliveryDecision(settings({ backgroundOnly: true }), base, { permission: 'granted', hidden: false, currentSessionId: 'session-2' }), true)
  assert.equal(exports.browserDeliveryDecision(settings({ backgroundOnly: true }), { ...base, kind: 'question', requestId: 'request-1' }, { permission: 'granted', hidden: false }), true)
  assert.equal(exports.browserDeliveryDecision(settings(), { ...base, nativeDelivered: true }, { permission: 'granted', hidden: true }), false)
  assert.equal(exports.browserDeliveryDecision(settings(), { ...base, isTest: true, channel: 'browser', nativeDelivered: true }, { permission: 'granted', hidden: true }), true)
  assert.equal(exports.browserDeliveryDecision(settings(), base, { permission: 'denied', hidden: true }), false)

  assert.equal(exports.notificationBody(settings({ preview: false }), base), '有新的 DSH 通知，請開啟 DSH 查看。')
  assert.equal(exports.notificationBody(settings({ preview: true }), base), '已整理完資料。')
})

test('notification click focuses DSH and opens the matching session when available', async () => {
  let notification
  let focused = 0
  const opened = []
  class FakeNotification {
    static permission = 'granted'
    constructor(title, options) { this.title = title; this.options = options; notification = this }
    close() { this.closed = true }
  }
  const { exports } = await loadClient({ Notification: FakeNotification })
  const runtime = exports.createClientRuntime({
    NotificationApi: FakeNotification,
    document: { hidden: true, hasFocus: () => false },
    window: { focus() { focused += 1 } },
    sessions: { open(id) { opened.push(id) } },
  })

  runtime.acceptSnapshot(snapshot([], { revision: 1 }), { baseline: true })
  runtime.acceptSnapshot(snapshot([event()], { revision: 2 }))
  notification.onclick()

  assert.equal(focused, 1)
  assert.deepEqual(opened, ['session-1'])
  assert.equal(notification.closed, true)
})

test('builds an exact all-question answer payload and rejects incomplete freeform', async () => {
  const { exports } = await loadClient()
  const pending = event({
    id: 'question-event',
    requestId: 'request-9',
    token: 'token-9',
    kind: 'question',
    questions: [
      { id: 'q1', question: '選擇版本', options: [{ label: 'A', description: '' }, { label: 'B', description: '' }], multiSelect: false },
      { id: 'q2', question: '選擇功能', options: [{ label: '通知', description: '' }, { label: '音效', description: '' }], multiSelect: true },
      { id: 'q3', question: '補充說明', options: [], multiSelect: false },
    ],
  })

  const payload = exports.buildAnswerPayload(pending, {
    q1: { selected: ['B'], custom: '' },
    q2: { selected: ['通知', '音效'], custom: '兩項都確認' },
    q3: { selected: [], custom: '保持安靜模式' },
  })

  assert.deepEqual(JSON.parse(JSON.stringify(payload)), {
    id: 'question-event',
    requestId: 'request-9',
    token: 'token-9',
    sessionId: 'session-1',
    answers: [
      { id: 'q1', selected: ['B'] },
      { id: 'q2', selected: ['通知', '音效'], custom: '兩項都確認' },
      { id: 'q3', selected: [], custom: '保持安靜模式' },
    ],
  })
  assert.throws(() => exports.buildAnswerPayload(pending, { q1: { selected: ['A'] }, q2: { selected: ['通知'] }, q3: { selected: [] } }), /q3/)
  assert.throws(() => exports.buildAnswerPayload(pending, { q1: { selected: ['A'], custom: '另外補充' }, q2: { selected: ['通知'] }, q3: { custom: '完成' } }), /q1/)
})

test('reports a stale one-shot decision and refreshes authoritative state', async () => {
  const calls = []
  const fetch = async (url, init = {}) => {
    calls.push({ url, init })
    if (url.endsWith('/answer')) return jsonResponse(409, { ok: false, error: 'request already resolved' })
    return jsonResponse(200, snapshot([], { revision: 4 }))
  }
  const { exports } = await loadClient({ fetch })
  const runtime = exports.createClientRuntime({ fetch })
  runtime.acceptSnapshot(snapshot([event({ id: 'approval-1', kind: 'approval', requestId: 'r1', token: 't1' })]), { baseline: true })

  const ok = await runtime.submitDecision(event({ id: 'approval-1', kind: 'approval', requestId: 'r1', token: 't1' }), 'allowed-once')

  assert.equal(ok, false)
  assert.match(runtime.getState().message.text, /已經處理或失效/)
  assert.equal(runtime.getState().message.error, true)
  assert.equal(calls[0].url, '/__dsh/zeta-notify/answer')
  assert.deepEqual(JSON.parse(calls[0].init.body).decision, 'allowed-once')
  assert.equal(calls[1].url, '/__dsh/zeta-notify/state')
})

test('sends only one event setting and merges it over a concurrent snapshot update', async () => {
  const calls = []
  let finishRequest
  const responseReady = new Promise((resolve) => { finishRequest = resolve })
  const fetch = async (url, init = {}) => {
    calls.push({ url, init })
    await responseReady
    return jsonResponse(200, { ok: true })
  }
  const { exports } = await loadClient({ fetch })
  const runtime = exports.createClientRuntime({ fetch })
  runtime.acceptSnapshot(snapshot([], { revision: 1 }), { baseline: true })

  const saving = runtime.updateSettings(exports.eventSettingsPatch('question', false))
  runtime.acceptSnapshot(snapshot([], {
    revision: 2,
    settings: settings({ events: { ...settings().events, error: false } }),
  }))
  finishRequest()

  assert.equal(await saving, true)
  assert.deepEqual(JSON.parse(calls[0].init.body), { patch: { events: { question: false } } })
  assert.equal(runtime.getState().snapshot.settings.events.question, false)
  assert.equal(runtime.getState().snapshot.settings.events.error, false)
  assert.equal(runtime.getState().snapshot.settings.events.completed, true)
})

test('native helper error takes priority over availability and clears on ready state', async () => {
  const { exports } = await loadClient()
  const runtime = exports.createClientRuntime()
  runtime.acceptSnapshot(snapshot([], {
    revision: 1,
    native: { available: true, error: '浮窗程序已停止' },
  }), { baseline: true })

  let status = exports.nativeStatus(runtime.getState().snapshot.native)
  assert.equal(status.error, true)
  assert.match(status.text, /浮窗程序已停止/)

  runtime.acceptSnapshot(snapshot([], {
    revision: 2,
    native: { available: true },
  }))
  status = exports.nativeStatus(runtime.getState().snapshot.native)
  assert.deepEqual(JSON.parse(JSON.stringify(status)), { text: 'Windows 浮窗可用', error: false })
})

test('native, browser, question and approval tests plus clear expose success and auth errors', async () => {
  const calls = []
  let rejectClear = false
  const fetch = async (url, init = {}) => {
    calls.push({ url, init })
    if (rejectClear && url.endsWith('/clear')) return jsonResponse(401, { ok: false, error: 'unauthorized' })
    return jsonResponse(200, { ok: true })
  }
  class GrantedNotification { static permission = 'granted' }
  const { exports } = await loadClient({ fetch, Notification: GrantedNotification })
  const runtime = exports.createClientRuntime({ fetch, NotificationApi: GrantedNotification })

  for (const kind of ['native', 'browser', 'question', 'approval']) {
    assert.equal(await runtime.runTest(kind), true)
    assert.match(runtime.getState().message.text, /測試已送出/)
  }
  assert.deepEqual(calls.slice(0, 4).map(({ url, init }) => [url, JSON.parse(init.body).kind]), [
    ['/__dsh/zeta-notify/test', 'native'],
    ['/__dsh/zeta-notify/test', 'browser'],
    ['/__dsh/zeta-notify/test', 'question'],
    ['/__dsh/zeta-notify/test', 'approval'],
  ])

  rejectClear = true
  assert.equal(await runtime.clearHistory(), false)
  assert.match(runtime.getState().message.text, /登入|驗證/)
  assert.equal(runtime.getState().message.error, true)

  const unsupported = exports.createClientRuntime({ fetch, NotificationApi: null })
  assert.equal(await unsupported.runTest('browser'), false)
  assert.match(unsupported.getState().message.text, /不支援/)
  class DeniedNotification { static permission = 'denied' }
  const denied = exports.createClientRuntime({ fetch, NotificationApi: DeniedNotification })
  assert.equal(await denied.runTest('browser'), false)
  assert.match(denied.getState().message.text, /權限/)
})

test('subscribes to SSE after an offline initial state request and baselines the recovery snapshot', async () => {
  const notices = []
  let source
  class FakeNotification {
    static permission = 'granted'
    constructor(title) { notices.push(title) }
  }
  class FakeEventSource {
    constructor(url) { this.url = url; this.listeners = {}; source = this }
    addEventListener(name, listener) { this.listeners[name] = listener }
    close() { this.closed = true }
  }
  const fetch = async () => { throw new Error('offline') }
  const { exports } = await loadClient({ fetch, EventSource: FakeEventSource, Notification: FakeNotification })
  const runtime = exports.createClientRuntime({
    fetch,
    EventSource: FakeEventSource,
    NotificationApi: FakeNotification,
    document: { hidden: true, hasFocus: () => false, addEventListener() {}, removeEventListener() {} },
    window: { addEventListener() {}, removeEventListener() {} },
    setInterval: () => 1,
    clearInterval() {},
  })

  const stop = runtime.start()
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(source.url, '/__dsh/zeta-notify/events')
  source.onerror()
  assert.equal(runtime.getState().connection, 'disconnected')
  source.listeners.state({ data: JSON.stringify(snapshot([event()])) })
  assert.equal(runtime.getState().connection, 'connected')
  assert.equal(notices.length, 0)
  stop()
  assert.equal(source.closed, true)
})

test('owns and removes its stylesheet across dispose and reapply', async () => {
  const styles = []
  const document = {
    hidden: false,
    hasFocus: () => true,
    head: {
      appendChild(node) {
        node.parentNode = this
        node.remove = () => {
          const index = styles.indexOf(node)
          if (index >= 0) styles.splice(index, 1)
          node.parentNode = null
        }
        styles.push(node)
      },
    },
    getElementById: () => null,
    createElement: () => ({ dataset: {}, textContent: '', parentNode: null }),
    addEventListener() {},
    removeEventListener() {},
  }
  const { exports } = await loadClient({ document })
  const cleanups = []
  const ctx = {
    slots: { inject(_name, factory) { return factory() }, register() {} },
    sessions: { list: { getSnapshot: () => ({ current: undefined }), subscribe: () => () => {} } },
    locale: {},
    effect(factory, label) {
      if (label === 'dsh-notify-zeta: styles') cleanups.push(factory())
    },
  }

  exports.apply(ctx)
  assert.equal(styles.length, 1)
  assert.equal(styles[0].dataset.plugin, 'dsh-notify-zeta')
  assert.match(styles[0].textContent, /.zeta_notify/)
  cleanups.shift()()
  assert.equal(styles.length, 0)

  exports.apply(ctx)
  assert.equal(styles.length, 1)
  cleanups.shift()()
  assert.equal(styles.length, 0)
})
