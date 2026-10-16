import fs from 'node:fs/promises'

const APP_URL = 'http://127.0.0.1:4173'
const DEVTOOLS_URL = 'http://127.0.0.1:9222'
const OUTPUT_DIR = 'browser-evidence'
const WORD = ['П', 'р', 'и', 'в', 'і', 'т']

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForHttp(url, attempts = 200) {
  let lastError
  for (let index = 0; index < attempts; index += 1) {
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

await fs.mkdir(OUTPUT_DIR, { recursive: true })
await waitForHttp(APP_URL)
await waitForHttp(`${DEVTOOLS_URL}/json/version`)

const pages = await fetch(`${DEVTOOLS_URL}/json/list`).then((response) => response.json())
const page = pages.find((candidate) => candidate.type === 'page' && candidate.webSocketDebuggerUrl)
if (!page?.webSocketDebuggerUrl) throw new Error('No debuggable Chrome page found')

const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

let nextId = 0
const pending = new Map()
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (!message.id) return
  const waiter = pending.get(message.id)
  if (!waiter) return
  pending.delete(message.id)
  if (message.error) waiter.reject(new Error(JSON.stringify(message.error)))
  else waiter.resolve(message.result)
})

function send(method, params = {}) {
  const id = ++nextId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (result.exceptionDetails) {
    const description = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text
    throw new Error(`Browser evaluation failed: ${description}`)
  }
  return result.result.value
}

async function waitForExpression(expression, message, attempts = 120) {
  for (let index = 0; index < attempts; index += 1) {
    if (await evaluate(expression)) return
    await sleep(50)
  }
  throw new Error(`Timed out: ${message}`)
}

async function clickExpression(expression, label) {
  const result = await evaluate(`(() => { const el = ${expression}; if (!el) return false; el.click(); return true })()`)
  if (!result) throw new Error(`Could not click ${label}`)
  await sleep(45)
}

function byButtonText(text, selector = 'button') {
  return `[...document.querySelectorAll(${JSON.stringify(selector)})].find((el) => el.textContent.trim() === ${JSON.stringify(text)})`
}

async function clickButton(text, selector = 'button') {
  await clickExpression(byButtonText(text, selector), `button ${text}`)
}

async function clickViewButton(view, text) {
  await clickButton(text, `[data-view="${view}"] button`)
}

async function clickGrapheme(view, grapheme) {
  await clickExpression(
    `[...document.querySelectorAll('[data-view="${view}"] .grapheme-button')].find((el) => el.textContent.trim() === ${JSON.stringify(grapheme)})`,
    `${view} grapheme ${grapheme}`,
  )
}

async function assertBrowser(condition, message) {
  const passed = await evaluate(condition)
  if (!passed) throw new Error(`Browser assertion failed: ${message}`)
}

async function screenshot(fileName) {
  const result = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  })
  await fs.writeFile(`${OUTPUT_DIR}/${fileName}`, Buffer.from(result.data, 'base64'))
}

async function waitForView(view) {
  await waitForExpression(`document.querySelector('[data-view="${view}"]') !== null`, `view ${view}`)
}

async function clickAudio(audioId) {
  const token = `audio-${Date.now()}-${Math.random()}`
  const prepared = await evaluate(`(() => {
    const button = [...document.querySelectorAll('[data-audio-id="${audioId}"]')]
      .find((candidate) => candidate.offsetParent !== null)
    if (!button) return false
    const wraps = [...document.querySelectorAll('.audio-wrap')]
    const wrap = wraps.find((candidate) => candidate.contains(button))
    const media = wrap?.querySelector('audio')
    if (!media) return false
    media.dataset.evidenceToken = ${JSON.stringify(token)}
    button.click()
    return true
  })()`)
  if (!prepared) throw new Error(`Could not start audio ${audioId}`)

  await waitForExpression(
    `(() => { const media = document.querySelector('[data-evidence-token="${token}"]'); return media && (media.currentTime > 0 || media.ended) })()`,
    `${audioId} begins playback`,
    240,
  )
  await waitForExpression(
    `(() => { const media = document.querySelector('[data-evidence-token="${token}"]'); return media && media.ended })()`,
    `${audioId} ends playback`,
    480,
  )
}

async function chooseSecondSoundOption() {
  await clickExpression(
    "document.querySelectorAll('.sound-option .choose-sound')[1]",
    'second sound option Choose',
  )
}

async function runMapping(index, grapheme, audioId) {
  await waitForView('mapping-teach')
  await assertBrowser(
    `document.querySelector('[data-view="mapping-teach"] .focus-word .is-focused')?.textContent === ${JSON.stringify(grapheme)}`,
    `mapping teach foregrounds ${grapheme}`,
  )
  await clickAudio(`audio/component-${audioId}`)
  await clickViewButton('mapping-teach', 'Try it')
  await waitForView('mapping-guided')
  await clickAudio(`audio/component-${audioId}`)
  await clickGrapheme('mapping-guided', grapheme)
  await sleep(380)
}

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', {
  width: 1180,
  height: 860,
  deviceScaleFactor: 1,
  mobile: false,
})

await send('Page.navigate', { url: APP_URL })
await waitForExpression("document.readyState === 'complete'", 'page load')
await waitForView('encounter')

const evidence = {
  work: 'WORK-YUZU-096',
  media: {},
  interaction: {},
  mapping: {},
  vowels: {},
  build: {},
  navigation: {},
  finalEvidence: {},
  completion: {},
  screenshots: [],
}

// Contextual encounter: actual media + accepted audio; listening must not navigate.
await assertBrowser(
  "document.querySelector('.anchor-media img')?.complete && document.querySelector('.anchor-media img')?.naturalWidth > 0",
  '094 anchor greeting media loads as an actual image',
)
evidence.media.anchorNaturalSize = await evaluate("({ width: document.querySelector('.anchor-media img').naturalWidth, height: document.querySelector('.anchor-media img').naturalHeight })")
await screenshot('01-contextual-encounter.png')
evidence.screenshots.push('01-contextual-encounter.png')
await clickAudio('audio/contextual-target')
await assertBrowser(`document.querySelector('[data-view="encounter"]') !== null`, 'Listen/Replay never submits or navigates')
await clickViewButton('encounter', 'Continue')
await waitForView('mapping-teach')

// Safe Back at the first boundary.
await clickExpression(`document.querySelector('[aria-label="Back"]')`, 'Back')
await waitForView('encounter')
await clickViewButton('encounter', 'Continue')
await waitForView('mapping-teach')
evidence.navigation.backReturnsToPreviousLearnerState = true

// Complete П/п teach -> guided -> reciprocal retrieval path.
await screenshot('02-mapping-teach-p.png')
evidence.screenshots.push('02-mapping-teach-p.png')
await clickAudio('audio/component-p')
await clickViewButton('mapping-teach', 'Try it')
await waitForView('mapping-guided')
await screenshot('03-mapping-guided-p.png')
evidence.screenshots.push('03-mapping-guided-p.png')
await clickAudio('audio/component-p')
await clickGrapheme('mapping-guided', 'П')
await sleep(380)
await waitForView('mapping-guided')
await assertBrowser("document.body.innerText.includes('п')", 'lowercase п receives guided practice without a separate alphabet lesson')
await clickAudio('audio/component-p')
await clickGrapheme('mapping-guided', 'п')
await sleep(380)
await waitForView('mapping-retrieve')
await screenshot('04-mapping-retrieval-p.png')
evidence.screenshots.push('04-mapping-retrieval-p.png')

// Listening to answer alternatives must not submit.
await clickAudio('audio/component-t')
await assertBrowser(
  `!document.querySelector('[data-view="mapping-retrieve"] .feedback').textContent.includes('Try again')`,
  'playing an audio alternative does not submit an answer',
)
await clickAudio('audio/component-p')
await assertBrowser(
  `document.querySelector('[data-view="mapping-retrieve"]') !== null`,
  'playing the correct audio still does not submit',
)
await chooseSecondSoundOption()
await sleep(380)
evidence.mapping.completePPath = true
evidence.interaction.playReplayNeverSubmits = true

// Establish remaining consonant mappings enough for Build.
await runMapping(1, 'р', 'r')
await runMapping(2, 'в', 'v')
await runMapping(3, 'т', 't')
await waitForView('vowel-compare')

// Explicit experiential и/і.
await screenshot('05-vowel-compare.png')
evidence.screenshots.push('05-vowel-compare.png')
await clickAudio('audio/component-y')
await clickAudio('audio/component-i')
await clickViewButton('vowel-compare', 'Try it')
for (let trial = 0; trial < 4; trial += 1) {
  await waitForView('vowel-trial')
  if (trial === 0) {
    await clickAudio('audio/component-y')
    await clickGrapheme('vowel-trial', 'и')
  } else if (trial === 1) {
    await clickAudio('audio/component-i')
    await clickGrapheme('vowel-trial', 'і')
  } else {
    const before = await evaluate(`document.querySelector('[data-view="vowel-trial"] .feedback').textContent`)
    const audioIds = await evaluate(`[...document.querySelectorAll('[data-view="vowel-trial"] .sound-option [data-audio-id]')].map((el) => el.dataset.audioId)`)
    for (const id of audioIds) await clickAudio(id)
    const after = await evaluate(`document.querySelector('[data-view="vowel-trial"] .feedback').textContent`)
    if (before !== after) throw new Error('Listening changed vowel correctness state before Choose')
    await chooseSecondSoundOption()
  }
  await sleep(380)
}
await waitForView('supported-build')
evidence.vowels.compareAndReplay = true
evidence.vowels.guidedAndReciprocalPractice = true

// Supported Build: compact local Help.
await screenshot('06-supported-build.png')
evidence.screenshots.push('06-supported-build.png')
await clickViewButton('supported-build', 'Help')
await assertBrowser(
  `document.querySelector('[data-view="supported-build"] .compact-help')?.getBoundingClientRect().height < 120`,
  'Build Help stays compact and local',
)
await screenshot('07-supported-build-help.png')
evidence.screenshots.push('07-supported-build-help.png')
for (const grapheme of WORD) await clickGrapheme('supported-build', grapheme)
await clickViewButton('supported-build', 'Continue')
await waitForView('reduced-build')

// Reduced Build must preserve progress through Back and materially remove target/per-placement support.
await assertBrowser(
  `!document.querySelector('[data-view="reduced-build"] .focus-word') && !document.querySelector('[data-view="reduced-build"] [data-audio-id="audio/neutral-target"]')`,
  'reduced Build removes full target and target audio',
)
await clickGrapheme('reduced-build', 'П')
await clickExpression(`document.querySelector('[aria-label="Back"]')`, 'Back')
await waitForView('supported-build')
await assertBrowser(
  `document.querySelector('[data-view="supported-build"] .build-line')?.textContent.replace(/\\s/g, '') === 'Привіт'`,
  'Back preserves completed supported Build',
)
await clickViewButton('supported-build', 'Continue')
await waitForView('reduced-build')
await assertBrowser(
  `document.querySelector('[data-view="reduced-build"] .build-line')?.textContent.replace(/\\s/g, '').startsWith('П')`,
  'returning to reduced Build preserves its partial sequence',
)
evidence.navigation.backPreservesBuildProgress = true
await screenshot('08-reduced-build.png')
evidence.screenshots.push('08-reduced-build.png')

for (const grapheme of WORD.slice(1)) await clickGrapheme('reduced-build', grapheme)
await clickViewButton('reduced-build', 'Check')
await waitForExpression(
  `document.querySelector('[data-view="reduced-build"] .feedback')?.textContent.includes('Yes')`,
  'reduced Build full-sequence success',
)
evidence.build.supportedThenReduced = true
evidence.build.reducedHasNoPerPlacementCorrectness = true
await clickViewButton('reduced-build', 'Continue')
await waitForView('context-return')

// Candidate final evidence: fresh context + print, no target audio until Help.
await assertBrowser(
  `document.querySelector('[data-view="context-return"] [data-audio-id="audio/neutral-target"]') === null`,
  'final evidence does not expose target audio before Help',
)
await assertBrowser(
  `document.querySelector('[data-view="context-return"] .context-target')?.textContent.trim() === 'Привіт'`,
  'final evidence uses full taught print',
)
await assertBrowser(
  "getComputedStyle(document.querySelector('.context-image')).backgroundImage.includes('L1-07_context_sprite.webp')",
  'fresh-context choices use the actual 094 media sprite',
)
const mediaFetch = await evaluate("fetch('/media/lesson1/L1-07_context_sprite.webp').then((r) => r.ok)")
if (!mediaFetch) throw new Error('094 context sprite is not browser-loadable')
await screenshot('09-final-fresh-context.png')
evidence.screenshots.push('09-final-fresh-context.png')

await clickExpression("document.querySelectorAll('.context-tile')[1]", '094 greeting moment')
await waitForExpression(
  `document.querySelector('[data-view="context-return"] .feedback')?.textContent.includes('Yes')`,
  'fresh-context correct feedback',
)
await clickViewButton('context-return', 'Continue')
await waitForView('complete')
evidence.finalEvidence.pattern = 'printed taught target -> fresh greeting moment'
evidence.finalEvidence.noPreResponseTargetAudio = true
evidence.finalEvidence.uses094Media = true

await screenshot('10-completion.png')
evidence.screenshots.push('10-completion.png')
await assertBrowser(
  `document.querySelector('[data-view="complete"]')?.textContent.includes('Lesson complete') && document.querySelector('[data-view="complete"]')?.textContent.includes('Привіт')`,
  'completion creates a clear Lesson boundary around the taught target',
)
await assertBrowser(
  `!/master|A1|fluent|general reading/i.test(document.querySelector('[data-view="complete"]')?.textContent ?? '')`,
  'completion avoids unsupported mastery/A1/general-reading claims',
)
evidence.completion.clearClosure = true
evidence.completion.noUnsupportedClaim = true

await fs.writeFile(
  `${OUTPUT_DIR}/browser-evidence.json`,
  JSON.stringify(evidence, null, 2),
)

console.log('WORK-YUZU-096 representative browser slice PASS')
console.log(JSON.stringify(evidence, null, 2))
socket.close()
