import fs from 'node:fs/promises'

const CDP = 'http://127.0.0.1:9222'
const APP = 'http://127.0.0.1:4173'

async function waitForHttp(url, attempts = 200) {
  let lastError
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url)
      if (response.ok) return response
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for ${url}: ${String(lastError ?? '')}`)
}

await waitForHttp(`${CDP}/json/version`)
await waitForHttp(APP)

const opened = await fetch(
  `${CDP}/json/new?${encodeURIComponent(`${APP}/#/`)}`,
  { method: 'PUT' },
)
if (!opened.ok) throw new Error('Could not open Chrome evidence tab')
const target = await opened.json()
const ws = new WebSocket(target.webSocketDebuggerUrl)

let nextId = 0
const pending = new Map()
ws.onmessage = (event) => {
  const message = JSON.parse(String(event.data))
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) reject(new Error(JSON.stringify(message.error)))
    else resolve(message.result)
  }
}

await new Promise((resolve, reject) => {
  ws.onopen = resolve
  ws.onerror = reject
})

function call(method, params = {}) {
  const id = ++nextId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression) {
  const result = await call('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails))
  }
  return result.result.value
}

async function waitFor(expression, label, attempts = 160) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await evaluate(expression)) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out: ${label}`)
}

async function navigate(url) {
  await call('Page.navigate', { url })
  await waitFor(
    "document.readyState === 'complete' || document.readyState === 'interactive'",
    `page load ${url}`,
  )
}

async function clickByText(text) {
  const ok = await evaluate(`(() => {
    const elements = [...document.querySelectorAll('button, a')]
    const target = elements.find((element) => element.textContent?.trim() === ${JSON.stringify(text)})
    if (!target) return false
    target.click()
    return true
  })()`)
  if (!ok) throw new Error(`Could not click "${text}"`)
}

async function screenshot(name) {
  const result = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  })
  await fs.writeFile(
    `browser-evidence/${name}`,
    Buffer.from(result.data, 'base64'),
  )
}

async function assert(expression, label) {
  if (!(await evaluate(expression))) {
    throw new Error(`Browser assertion failed: ${label}`)
  }
}

await call('Page.enable')
await call('Runtime.enable')
await call('Emulation.setDeviceMetricsOverride', {
  width: 1280,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
})

await evaluate("localStorage.removeItem('yuzu.shell.v1'); location.hash = '#/'; location.reload()")
await waitFor("document.body.innerText.includes('Start Course')", 'first-visit Start Course')
await assert(
  "document.body.innerText.includes('Ukrainian A1') && document.body.innerText.includes('Module 1') && document.body.innerText.includes('Lesson 1')",
  'Course Home orientation and path',
)
await screenshot('course-home-first-visit.png')

await clickByText('Start Course')
await waitFor("location.hash === '#/lesson/lesson-1'", 'Lesson direct route after Start Course')
await waitFor(`document.querySelector('[data-lesson-id="lesson-1"]') !== null`, 'Lesson runtime boundary')
await assert(
  "JSON.parse(localStorage.getItem('yuzu.shell.v1')).lessons['lesson-1'].status === 'in-progress'",
  'Lesson marked in progress only after shell transition',
)
await screenshot('lesson-boundary.png')

await evaluate(`window.dispatchEvent(new CustomEvent('yuzu:lesson-safe-point', { detail: { lessonId: 'lesson-1', resumePoint: 'checkpoint-browser-1' } }))`)
await waitFor(
  "JSON.parse(localStorage.getItem('yuzu.shell.v1')).lessons['lesson-1'].resumePoint === 'checkpoint-browser-1'",
  'safe resume point persisted',
)
await clickByText('Exit Lesson')
await waitFor("location.hash === '#/' && document.body.innerText.includes('Continue')", 'safe exit to Course Home')
await assert(
  "document.body.innerText.includes('In progress') && document.body.innerText.includes('Recommended')",
  'interrupted Lesson path state',
)

await evaluate('location.reload()')
await waitFor("document.body.innerText.includes('Continue')", 'returning learner after reload')
await clickByText('Continue')
await waitFor(`document.querySelector('[data-lesson-id="lesson-1"]') !== null`, 'resumed Lesson boundary')
await assert(
  `document.querySelector('[data-lesson-id="lesson-1"]').dataset.resumePoint === 'checkpoint-browser-1'`,
  'valid safe resume point handed back to runtime',
)
await assert(
  `document.querySelector('[data-lesson-id="lesson-1"]').dataset.lessonMode === 'resume'`,
  'resume mode',
)

await clickByText('Settings & accessibility')
await waitFor("document.body.innerText.includes('Use nonvisual alternatives where available')", 'Settings from Lesson')
await evaluate("document.querySelector('input[type=checkbox]').click()")
await waitFor(
  "JSON.parse(localStorage.getItem('yuzu.shell.v1')).accessibility.useNonvisualAlternatives === true",
  'accessibility preference persistence',
)
await clickByText('Return to Lesson')
await waitFor(`document.querySelector('[data-lesson-id="lesson-1"]') !== null`, 'Return to Lesson')
await assert(
  `document.querySelector('[data-lesson-id="lesson-1"]').dataset.useNonvisualAlternatives === 'true'`,
  'nonvisual preference reaches Lesson runtime boundary',
)

await evaluate(`(() => {
  window.__yuzuOriginalSetItem = Storage.prototype.setItem
  Storage.prototype.setItem = function () { throw new Error('forced-save-failure') }
})()`)
await evaluate(`window.dispatchEvent(new CustomEvent('yuzu:lesson-safe-point', { detail: { lessonId: 'lesson-1', resumePoint: 'checkpoint-browser-2' } }))`)
await waitFor(
  "document.body.innerText.includes(\"Your latest progress hasn't been saved yet.\")",
  'save failure recovery state',
)
await assert(
  "document.body.innerText.includes('checkpoint-browser-1')",
  'save failure names previous safe point',
)
await evaluate(`Storage.prototype.setItem = window.__yuzuOriginalSetItem`)
await clickByText('Try saving again')
await waitFor(
  `document.querySelector('[data-lesson-id="lesson-1"]') !== null`,
  'Lesson restored after save retry',
)
await assert(
  "JSON.parse(localStorage.getItem('yuzu.shell.v1')).lessons['lesson-1'].resumePoint === 'checkpoint-browser-2'",
  'latest safe point saved after retry',
)

await evaluate(`window.dispatchEvent(new CustomEvent('yuzu:lesson-load-failed', { detail: { lessonId: 'lesson-1' } }))`)
await waitFor("document.body.innerText.includes(\"This Lesson couldn't be loaded.\")", 'Lesson load recovery')
await assert(
  "JSON.parse(localStorage.getItem('yuzu.shell.v1')).lessons['lesson-1'].status === 'in-progress'",
  'Lesson load failure does not falsely complete Lesson',
)
await clickByText('Course Home')
await waitFor("location.hash === '#/'", 'Course Home after Lesson load failure')

await navigate(`${APP}/#/lesson/not-a-lesson`)
await waitFor("document.body.innerText.includes(\"We couldn't find that Lesson.\")", 'invalid direct-route recovery')
await assert(
  "document.body.innerText.includes('Continue') && document.body.innerText.includes('Course Home')",
  'invalid route provides safe recovery',
)

await navigate(`${APP}/#/lesson/lesson-1`)
await waitFor(`document.querySelector('[data-lesson-id="lesson-1"]') !== null`, 'Lesson before completion')
await evaluate(`(() => {
  window.__yuzuOriginalSetItem = Storage.prototype.setItem
  Storage.prototype.setItem = function () { throw new Error('forced-completion-save-failure') }
})()`)
await evaluate(`window.dispatchEvent(new CustomEvent('yuzu:lesson-complete', { detail: { lessonId: 'lesson-1' } }))`)
await waitFor(
  "document.body.innerText.includes(\"Your Lesson is finished, but we couldn't update your course progress.\")",
  'completion update failure recovery state',
)
await assert(
  "JSON.parse(localStorage.getItem('yuzu.shell.v1')).lessons['lesson-1'].status === 'in-progress'",
  'failed completion update does not advance persisted course state',
)
await evaluate(`Storage.prototype.setItem = window.__yuzuOriginalSetItem`)
await clickByText('Try again')
await waitFor("document.body.innerText.includes('Lesson complete')", 'completion update retry succeeds')
await clickByText('Course Home')
await waitFor("location.hash === '#/' && document.body.innerText.includes('Completed')", 'completed Lesson on Course Home')
await assert(
  "!document.body.innerText.includes('A1 certified') && !document.body.innerText.includes('mastered')",
  'no false mastery or certification claim',
)
await evaluate(`(() => {
  const button = [...document.querySelectorAll('button')].find((element) => element.getAttribute('aria-label')?.startsWith('Lesson 1 — Completed'))
  if (!button) return false
  button.click()
  return true
})()`)
await waitFor("document.body.innerText.includes('Revisit')", 'completed Lesson revisit')
await assert(
  `document.querySelector('[data-lesson-id="lesson-1"]').dataset.lessonMode === 'revisit'`,
  'revisit runtime mode',
)
await evaluate(`window.dispatchEvent(new CustomEvent('yuzu:lesson-safe-point', { detail: { lessonId: 'lesson-1', resumePoint: 'revisit-must-not-regress' } }))`)
await new Promise((resolve) => setTimeout(resolve, 150))
await assert(
  "JSON.parse(localStorage.getItem('yuzu.shell.v1')).lessons['lesson-1'].status === 'completed'",
  'revisit does not regress canonical completion',
)
await screenshot('completed-lesson-revisit.png')

await navigate(`${APP}/#/`)
await waitFor("document.body.innerText.includes('Ukrainian A1')", 'Course Home before load-recovery proof')
await evaluate(`(() => {
  sessionStorage.setItem('yuzu.evidence.saved-shell', localStorage.getItem('yuzu.shell.v1'))
  localStorage.setItem('yuzu.shell.v1', '{broken')
  location.reload()
})()`)
await waitFor(
  "document.body.innerText.includes(\"We couldn't load your course.\")",
  'corrupt persisted state fails closed',
)
await evaluate(`localStorage.setItem('yuzu.shell.v1', sessionStorage.getItem('yuzu.evidence.saved-shell'))`)
await clickByText('Try again')
await waitFor("document.body.innerText.includes('Ukrainian A1')", 'course-state load retry succeeds')
await assert(
  "document.body.innerText.includes('Completed')",
  'load retry restores prior canonical progress',
)

await call('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
})
await navigate(`${APP}/#/`)
await waitFor("document.body.innerText.includes('Ukrainian A1')", 'mobile Course Home')
await assert(
  'document.documentElement.scrollWidth <= document.documentElement.clientWidth',
  'mobile shell has no horizontal page scrolling',
)
await assert(
  "getComputedStyle(document.querySelector('.primary-button') ?? document.body).minHeight !== '0px'",
  'mobile primary action remains a real control when present',
)
await screenshot('course-home-mobile.png')

const evidence = {
  firstVisitStart: true,
  curriculumDrivenPathRendered: true,
  startCreatesInProgressState: true,
  safePointPersistence: true,
  reloadResume: true,
  settingsReturnToLesson: true,
  nonvisualPreferencePersistence: true,
  lessonLoadFailureDoesNotAdvance: true,
  invalidRouteRecovery: true,
  saveFailureRecovery: true,
  lessonLoadFailureRecovery: true,
  completionEventConsumption: true,
  completionUpdateFailureRecovery: true,
  loadStateFailureRetry: true,
  completedLessonRevisitWithoutRegression: true,
  responsiveMobileNoHorizontalScroll: true,
}

await fs.writeFile(
  'browser-evidence/evidence.json',
  JSON.stringify(evidence, null, 2),
)

console.log('WORK-YUZU-074 real-browser shell evidence PASS')
console.log(JSON.stringify(evidence, null, 2))
ws.close()
