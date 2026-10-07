import fs from 'node:fs/promises'

const CDP = 'http://127.0.0.1:9222'
const APP = 'http://127.0.0.1:4173'
const OUTPUT = 'browser-evidence-085'
const STORAGE_KEY = 'yuzu.shell.v1'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForHttp(url, attempts = 200) {
  let lastError
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch (error) {
      lastError = error
    }
    await sleep(100)
  }
  throw new Error(`Timed out waiting for ${url}: ${String(lastError ?? '')}`)
}

await fs.mkdir(OUTPUT, { recursive: true })
await waitForHttp(CDP + '/json/version')
await waitForHttp(APP)

const opened = await fetch(
  CDP + '/json/new?' + encodeURIComponent(APP + '/#/'),
  { method: 'PUT' },
)
if (!opened.ok) throw new Error('Could not open Chrome evidence tab')
const target = await opened.json()
const ws = new WebSocket(target.webSocketDebuggerUrl)
let nextId = 0
const pending = new Map()

ws.onmessage = (event) => {
  const message = JSON.parse(String(event.data))
  if (!message.id || !pending.has(message.id)) return
  const waiter = pending.get(message.id)
  pending.delete(message.id)
  if (message.error) waiter.reject(new Error(JSON.stringify(message.error)))
  else waiter.resolve(message.result)
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

async function waitFor(expression, label, attempts = 180) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await evaluate(expression)) return
    await sleep(80)
  }
  throw new Error(`Timed out: ${label}`)
}

async function assert(expression, label) {
  if (!(await evaluate(expression))) {
    throw new Error(`Browser assertion failed: ${label}`)
  }
}

function byText(text, selector = 'button') {
  return `[...document.querySelectorAll(${JSON.stringify(selector)})].find((element) => element.textContent?.trim() === ${JSON.stringify(text)})`
}

async function clickText(text, selector = 'button') {
  const ok = await evaluate(`(() => {
    const target = ${byText(text, selector)}
    if (!target || target.disabled) return false
    target.click()
    return true
  })()`)
  if (!ok) throw new Error(`Could not click ${text}`)
  await sleep(80)
}

async function clickSelector(selector, index = 0) {
  const ok = await evaluate(`(() => {
    const target = document.querySelectorAll(${JSON.stringify(selector)})[${index}]
    if (!target || target.disabled) return false
    target.click()
    return true
  })()`)
  if (!ok) throw new Error(`Could not click ${selector}[${index}]`)
  await sleep(80)
}

async function screenshot(name) {
  const result = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  })
  await fs.writeFile(
    `${OUTPUT}/${name}`,
    Buffer.from(result.data, 'base64'),
  )
}

function browserSession(lessonId, stateId, itemIndex = 0, opportunities = {}) {
  return {
    version: 1,
    lessonId,
    stateId,
    itemIndex,
    opportunities,
    evidenceByKey: {},
    constructionByKey: {},
    playedAudioRoles: [],
    helpDepthByKey: {},
    feedback: null,
  }
}

function shellState(lessonId, stateId, options = {}) {
  const completedBefore =
    lessonId === 'lesson-2'
      ? ['lesson-1']
      : lessonId === 'lesson-3'
        ? ['lesson-1', 'lesson-2']
        : ['lesson-1', 'lesson-2', 'lesson-3']
  const lessons = Object.fromEntries(
    completedBefore.map((id) => [
      id,
      { status: 'completed', resumePoint: null },
    ]),
  )
  lessons[lessonId] = {
    status: 'in-progress',
    resumePoint: JSON.stringify(
      browserSession(
        lessonId,
        stateId,
        options.itemIndex ?? 0,
        options.opportunities ?? {},
      ),
    ),
  }
  return {
    version: 1,
    courseStarted: true,
    lessons,
    accessibility: {
      useNonvisualAlternatives: options.nonvisual ?? false,
    },
  }
}

async function seed(lessonId, stateId, options = {}) {
  const state = shellState(lessonId, stateId, options)
  await evaluate(`(() => {
    localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, ${JSON.stringify(JSON.stringify(state))})
    location.hash = ${JSON.stringify('#/lesson/' + lessonId)}
    location.reload()
  })()`)
  await waitFor(
    `document.querySelector('[data-module1-state="${stateId}"]') !== null`,
    `${stateId} runtime`,
  )
}

async function clickAudio(role) {
  const selector = `[data-audio-role="${role}"] .audio-button`
  await clickSelector(selector)
  await waitFor(
    `(() => {
      const audio = document.querySelector('[data-audio-role="${role}"] audio')
      return audio && audio.currentTime > 0
    })()`,
    `${role} real playback`,
    260,
  )
  await waitFor(
    `localStorage.getItem(${JSON.stringify(STORAGE_KEY)})?.includes(${JSON.stringify(role)}) === true`,
    `${role} playback persisted into safe resume state`,
    120,
  )
}

async function keyActivate(selector) {
  const focused = await evaluate(`(() => {
    const target = document.querySelector(${JSON.stringify(selector)})
    if (!target) return false
    target.focus()
    return document.activeElement === target
  })()`)
  if (!focused) throw new Error(`Could not focus ${selector}`)
  await call('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: ' ',
    code: 'Space',
    text: ' ',
    windowsVirtualKeyCode: 32,
    nativeVirtualKeyCode: 32,
  })
  await call('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: ' ',
    code: 'Space',
    windowsVirtualKeyCode: 32,
    nativeVirtualKeyCode: 32,
  })
  await sleep(100)
}

async function continueFromSuccess(label) {
  await waitFor(
    "document.activeElement?.classList.contains('lesson-feedback') === true",
    `${label} feedback focus`,
  )
  await clickText('Continue')
}

const evidence = {
  shellIntegration: false,
  acceptedW1RealPlayback: false,
  w2SeamsNoInventedSource: false,
  l2ExactSequence: false,
  l2SupportedConstruction: false,
  l3ProtectedListening: false,
  l3ProtectedReading: false,
  l3ReducedConstructionAndResume: false,
  accessibilityRoute: false,
  l4ReducedConstruction: false,
  focusKeyboard: false,
  responsive: false,
  noFalseMasteryCopy: false,
  mediaSlotsPresent: false,
}

await call('Page.enable')
await call('Runtime.enable')
await call('Emulation.setDeviceMetricsOverride', {
  width: 1280,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
})

// Shell integration / prerequisite path.
await evaluate(`localStorage.removeItem(${JSON.stringify(STORAGE_KEY)}); location.hash = '#/'; location.reload()`)
await waitFor("document.body?.innerText.includes('Start Course') === true", 'Course Home')
await assert(
  "document.body.innerText.includes('Lesson 1') && document.body.innerText.includes('Lesson 2') && document.body.innerText.includes('Lesson 3') && document.body.innerText.includes('Lesson 4')",
  'Module 1 exposes all four Lessons',
)
await assert(
  "document.body.innerText.match(/Unavailable/g)?.length >= 3",
  'L2-L4 remain prerequisite-gated before L1',
)
evidence.shellIntegration = true
await screenshot('01-course-home-module1.png')

// L2 S01: real accepted W1 audio, protected listening, keyboard card activation.
await seed('lesson-2', 'l2-s01')
await assert(
  "!document.body.innerText.includes('Привіт')",
  'L2-S01 hides answer print before response',
)
await clickAudio('w1-neutral')
evidence.acceptedW1RealPlayback = true
await clickSelector('[data-moment-id="cinema-opening"]')
await continueFromSuccess('L2-S01 context response')
await waitFor(
  "document.body.innerText.includes('Привіт')",
  'L2-S01 reintegration after response',
)
await screenshot('02-l2-s01-reintegration.png')
await clickText('и', '.grapheme-button')
await continueFromSuccess('L2-S01 и renewal')
await waitFor(
  `document.querySelector('[data-module1-state="l2-s01"][data-module1-item="2"]') !== null`,
  'L2-S01 second vowel renewal',
)
await clickText('і', '.grapheme-button')
await continueFromSuccess('L2-S01 і renewal')
await waitFor(
  `document.querySelector('[data-module1-state="l2-s02"]') !== null`,
  'L2-S02 after both W1 renewals',
)

// W2 teaching seam: exact symbolic role, no source invented; the audio-dependent state remains honestly gated.
await assert(
  `document.querySelector('[data-audio-role="w2-contextual"]')?.dataset.audioSeam === 'AUD-M1-L2-W2-CONTEXT-BUVAI'`,
  'W2 contextual seam exact',
)
await assert(
  `document.querySelector('[data-audio-role="w2-contextual"] audio') === null`,
  'W2 contextual seam has no audio element/source',
)
await assert(
  "[...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Continue')?.disabled === true",
  'W2 teaching does not silently bypass the deferred contextual audio seam',
)
evidence.w2SeamsNoInventedSource = true

// Unrelated later states remain independently implemented and verifiable despite that seam.
await seed('lesson-2', 'l2-s03')
await keyActivate('.target-choice:last-child')
await continueFromSuccess('keyboard target-choice response')
await waitFor(
  `document.querySelector('[data-module1-item="1"]') !== null`,
  'keyboard target-choice activation',
)
evidence.focusKeyboard = true
await clickText('Бувай')
await continueFromSuccess('L2-S03 closing response')
await waitFor(
  `document.querySelector('[data-module1-state="l2-s04"]') !== null`,
  'L2-S04 mapping',
)
await assert(
  `document.querySelector('[data-audio-seam="MAP-Б"] audio') === null`,
  'MAP-Б symbolic and unbound',
)
await assert(
  "[...document.querySelectorAll('.mapping-activity .grapheme-button')].every((button) => button.disabled)",
  'mapping response remains unavailable until real W2 mapping audio exists',
)
evidence.l2ExactSequence = true
await screenshot('03-l2-s04-symbolic-mapping.png')

// L2 reading exists after the blocked mapping seam and is independently executable.
await seed('lesson-2', 'l2-s05')
await assert(
  `document.body.innerText.includes('Бувай') && document.querySelector('[data-audio-role="w2-neutral"]') === null`,
  'L2 read state has print and no target autoplay',
)
await clickSelector('[data-moment-id="park-closing"]')
await continueFromSuccess('L2-S05 reading response')
await waitFor(
  `document.querySelector('[data-module1-state="l2-s06"]') !== null`,
  'L2-S06 supported construction',
)
await assert(
  "document.querySelectorAll('.construction-slot').length === 5",
  'L2 supported construction has five slots',
)
await assert(
  "[...document.querySelectorAll('.construction-pool .grapheme-button')].map((x) => x.textContent.trim()).sort().join('') === ['Б','у','в','а','й'].sort().join('')",
  'L2 supported construction exact pool',
)
await assert(
  `document.querySelector('[data-audio-role="w2-neutral"] audio') === null`,
  'L2 W2 construction preserves symbolic audio seam',
)
await assert(
  `document.querySelector('[data-construction-contract="l2-w2-supported"]')?.dataset.inputReady === 'false' &&
   [...document.querySelectorAll('.construction-pool .grapheme-button')].every((button) => button.disabled)`,
  'audio-cued construction cannot record an attempt before W2 audio activation',
)
evidence.l2SupportedConstruction = true
await screenshot('04-l2-supported-construction.png')

// L3 listening protection: W1 works, then W2 blocks technically without exposing answer.
await seed('lesson-3', 'l3-s02')
await assert(
  "!document.body.innerText.includes('Привіт') && !document.body.innerText.includes('Бувай')",
  'L3 listening begins without answer print',
)
await clickAudio('w1-neutral')
await clickSelector('[data-moment-id="basketball-opening"]')
await continueFromSuccess('L3 W1 listening response')
await waitFor(
  `document.querySelector('[data-module1-item="1"]') !== null`,
  'L3 listening W2 item',
)
await assert(
  "!document.body.innerText.includes('Бувай')",
  'W2 answer print still hidden',
)
await clickText('Listen')
await waitFor(
  `document.body.innerText.includes("This audio couldn't be loaded.")`,
  'deferred W2 seam exposes technical state',
)
await assert(
  "document.querySelectorAll('.moment-choice-grid').length === 0",
  'W2 listening cannot record a response before audio exists',
)
evidence.l3ProtectedListening = true
await screenshot('05-l3-w2-listening-deferred.png')

// Reading protection and accessibility route.
await seed('lesson-3', 'l3-s03')
await assert(
  "document.body.innerText.includes('Привіт') && document.querySelector('[data-audio-role]') === null",
  'L3 reading has no target autoplay control',
)
await clickSelector('[data-moment-id="bicycle-opening"]')
await continueFromSuccess('L3 W1 reading response')
await waitFor(
  "document.body.innerText.includes('Бувай')",
  'L3 second read item',
)
await assert(
  "document.querySelector('[data-audio-role]') === null",
  'L3 W2 reading still has no audio before response',
)
evidence.l3ProtectedReading = true

await seed('lesson-3', 'l3-s03', { nonvisual: true })
await assert(
  `document.querySelector('[data-target-length-support="false"]') !== null`,
  'nonvisual route replaces print-led reading with reduced construction',
)
await assert(
  "document.querySelectorAll('.construction-slot').length === 0",
  'accessible reduced construction has no target-length slots',
)
await assert(
  "!document.body.innerText.includes('Привіт')",
  'nonvisual route withholds full target before construction response',
)
evidence.accessibilityRoute = true
await screenshot('06-l3-accessible-reading-route.png')

// Reduced construction, partial-state safe resume, broad K2 pool.
await seed('lesson-3', 'l3-s04')
for (const grapheme of ['П', 'р']) {
  await clickText(grapheme, '.construction-pool .grapheme-button')
}
await waitFor(
  "document.querySelector('.construction-build-area')?.textContent.includes('Пр')",
  'partial construction',
)
await evaluate('location.reload()')
await waitFor(
  `document.querySelector('[data-module1-state="l3-s04"]') !== null`,
  'L3 safe resume after reload',
)
await assert(
  "document.querySelector('.construction-build-area')?.textContent.includes('Пр')",
  'partial construction preserved across shell safe resume',
)
await assert(
  "document.querySelectorAll('.construction-pool .grapheme-button').length >= 10",
  'reduced construction uses broad K2 pool',
)
for (const grapheme of ['и', 'в', 'і', 'т']) {
  await clickText(grapheme, '.construction-pool .grapheme-button')
}
await clickText('Check')
await continueFromSuccess('L3 W1 construction response')
await waitFor(
  `document.querySelector('[data-module1-item="1"]') !== null`,
  'L3 W1 construction completes into W2 item',
)
await assert(
  `document.querySelector('[data-audio-role="w2-neutral"] audio') === null`,
  'L3 W2 construction exact symbolic seam',
)
evidence.l3ReducedConstructionAndResume = true
await screenshot('07-l3-reduced-construction.png')

// The two-audio integrated comparison stays non-answer-bearing while one role is deferred.
await seed('lesson-3', 'l3-s05')
await assert(
  "[...document.querySelectorAll('.audio-choice-card button[aria-label^=\"Choose audio\"]')].length === 2 && [...document.querySelectorAll('.audio-choice-card button[aria-label^=\"Choose audio\"]')].every((button) => button.disabled)",
  'two-audio comparison cannot use W1 availability to reveal the deferred W2 answer',
)
await assert(
  "!document.body.innerText.includes('Привіт') && !document.body.innerText.includes('Бувай')",
  'integrated audio choice exposes no target print before response',
)

// L4 lowest-support construction exists with the same protection and broader pool.
await seed('lesson-4', 'l4-s03')
await assert(
  `document.querySelector('[data-target-length-support="false"]') !== null && document.querySelectorAll('.construction-slot').length === 0`,
  'L4 lowest-support construction has no length slots',
)
await assert(
  "document.querySelectorAll('.construction-pool .grapheme-button').length >= 10",
  'L4 uses broad K2 pool',
)
evidence.l4ReducedConstruction = true

// Media slots are structurally exact and never substituted with invented image URLs.
await seed('lesson-4', 'l4-s04')
await assert(
  `document.querySelector('[data-media-slot="MEDIA-M1-L4-FOOD-TRUCK-OPENING"]')?.dataset.mediaStatus === 'external-slot'`,
  'final integration preserves exact external media slot',
)
await assert(
  "document.querySelectorAll('img[src]').length === 0",
  'no invented context image source',
)
evidence.mediaSlotsPresent = true

// Responsive / text-scale tolerance.
await call('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
})
await seed('lesson-2', 'l2-s03')
await assert(
  'document.documentElement.scrollWidth <= document.documentElement.clientWidth',
  '390px layout has no horizontal page scrolling',
)
await assert(
  "[...document.querySelectorAll('.target-choice')].every((button) => button.getBoundingClientRect().height >= 44)",
  'mobile target controls remain at least 44px high',
)
await screenshot('08-mobile-l2-function.png')

// 081 specifies 200% browser zoom, not doubled root font sizing.
// Starting from the 1280px desktop evidence viewport, 200% browser zoom
// presents approximately a 640 CSS px layout viewport. Verify that reflow
// condition directly rather than doubling every rem-based spacing value.
await call('Emulation.setDeviceMetricsOverride', {
  width: 640,
  height: 450,
  deviceScaleFactor: 2,
  mobile: false,
})
await seed('lesson-2', 'l2-s03')
await assert(
  'document.documentElement.scrollWidth <= document.documentElement.clientWidth',
  '200% browser-zoom-equivalent reflow has no horizontal page scrolling',
)
await screenshot('09-zoom-200-reflow.png')
evidence.responsive = true

await assert(
  "!document.body.innerText.includes('mastered') && !document.body.innerText.includes('certified') && !document.body.innerText.includes('A1 complete')",
  'no false mastery/certification/CEFR-completion claim',
)
evidence.noFalseMasteryCopy = true

await fs.writeFile(
  `${OUTPUT}/evidence.json`,
  JSON.stringify(evidence, null, 2),
)

console.log('WORK-YUZU-085 real-browser evidence PASS')
console.log(JSON.stringify(evidence, null, 2))
ws.close()
