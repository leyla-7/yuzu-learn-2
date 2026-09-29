import fs from 'node:fs/promises'

const APP_URL = 'http://127.0.0.1:4173'
const DEVTOOLS_URL = 'http://127.0.0.1:9222'
const OUTPUT_DIR = 'browser-evidence'
const TARGET_SEQUENCE = ['П', 'р', 'и', 'в', 'і', 'т']

const audioToGrapheme = {
  'audio/component-p': 'П',
  'audio/component-r': 'р',
  'audio/component-y': 'и',
  'audio/component-v': 'в',
  'audio/component-i': 'і',
  'audio/component-t': 'т',
}

const graphemeToAudio = {
  П: 'audio/component-p',
  п: 'audio/component-p',
  р: 'audio/component-r',
  и: 'audio/component-y',
  в: 'audio/component-v',
  і: 'audio/component-i',
  т: 'audio/component-t',
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForHttp(url, attempts = 80) {
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

async function waitForExpression(expression, message, attempts = 80) {
  for (let index = 0; index < attempts; index += 1) {
    if (await evaluate(expression)) return
    await sleep(50)
  }
  throw new Error(`Timed out: ${message}`)
}

async function navigate() {
  await send('Page.navigate', { url: APP_URL })
  await waitForExpression("document.readyState === 'complete'", 'page load')
  await waitForExpression("document.querySelector('.lesson-shell') !== null", 'Lesson shell')
}

async function clickExpression(expression, label) {
  const result = await evaluate(`(() => { const el = ${expression}; if (!el) return false; el.click(); return true })()`)
  if (!result) throw new Error(`Could not click ${label}`)
  await sleep(35)
}

async function focusExpression(expression, label) {
  const result = await evaluate(`(() => { const el = ${expression}; if (!el) return false; el.focus(); return document.activeElement === el })()`)
  if (!result) throw new Error(`Could not focus ${label}`)
  await sleep(20)
}

async function pressEnter() {
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
    text: '\r',
    unmodifiedText: '\r',
  })
  await send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
  })
}

async function waitForActiveText(text, message) {
  await waitForExpression(
    `document.activeElement?.textContent?.trim() === ${JSON.stringify(text)}`,
    message,
  )
}

function byButtonText(text, selector = 'button') {
  return `[...document.querySelectorAll(${JSON.stringify(selector)})].find((el) => el.textContent.trim() === ${JSON.stringify(text)})`
}

function byAriaLabel(label) {
  return `document.querySelector(${JSON.stringify(`[aria-label="${label}"]`)})`
}

function byAudioId(audioId) {
  return `document.querySelector(${JSON.stringify(`[data-audio-id="${audioId}"]`)})`
}

async function clickButton(text, selector) {
  await clickExpression(byButtonText(text, selector), `button ${text}`)
}

async function clickAria(label) {
  await clickExpression(byAriaLabel(label), `aria-label ${label}`)
}

async function clickAudio(audioId) {
  await clickExpression(byAudioId(audioId), `audio ${audioId}`)
}

async function screenshot(fileName) {
  const result = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  })
  await fs.writeFile(`${OUTPUT_DIR}/${fileName}`, Buffer.from(result.data, 'base64'))
}

async function assertBrowser(condition, message) {
  const passed = await evaluate(condition)
  if (!passed) throw new Error(`Browser assertion failed: ${message}`)
}

async function completeContextChoice() {
  await clickAria('Beginning of contact')
  await waitForExpression(
    byButtonText('Continue') + ' !== undefined',
    'context Continue button',
  )
  await clickButton('Continue')
}

async function completeMappingPractice() {
  for (let guard = 0; guard < 40; guard += 1) {
    const canContinue = await evaluate(`${byButtonText('Continue', '.practice-step button')} !== undefined`)
    if (canContinue) {
      await clickButton('Continue', '.practice-step button')
      return
    }

    const focus = await evaluate("document.querySelector('.practice-step .focus-grapheme')?.textContent?.trim() ?? null")
    if (focus) {
      const audioId = graphemeToAudio[focus]
      if (!audioId) throw new Error(`No audio mapping for ${focus}`)
      await clickAudio(audioId)
      continue
    }

    const promptAudio = await evaluate("document.querySelector('.practice-step > .audio-control[data-audio-id]')?.dataset.audioId ?? null")
    const grapheme = audioToGrapheme[promptAudio]
    if (!grapheme) throw new Error(`No grapheme mapping for ${promptAudio}`)

    const lowercaseP = await evaluate("[...document.querySelectorAll('.practice-step .choice-row .grapheme-button')].some((el) => el.textContent.trim() === 'п')")
    const expected = promptAudio === 'audio/component-p' && lowercaseP ? 'п' : grapheme
    await clickButton(expected, '.practice-step .choice-row .grapheme-button')
  }
  throw new Error('Mapping practice did not complete')
}

async function completeVowelPractice() {
  for (let guard = 0; guard < 12; guard += 1) {
    const canContinue = await evaluate(`${byButtonText('Continue', '.vowel-step button')} !== undefined`)
    if (canContinue) {
      await clickButton('Continue', '.vowel-step button')
      return
    }

    const focus = await evaluate("document.querySelector('.vowel-step .focus-grapheme')?.textContent?.trim() ?? null")
    if (focus) {
      await clickAudio(graphemeToAudio[focus])
      continue
    }

    const promptAudio = await evaluate("document.querySelector('.vowel-step > .audio-control[data-audio-id]')?.dataset.audioId ?? null")
    const expected = promptAudio === 'audio/component-y' ? 'и' : promptAudio === 'audio/component-i' ? 'і' : null
    if (!expected) throw new Error(`Unexpected vowel audio ${promptAudio}`)
    await clickButton(expected, '.vowel-step .choice-row .grapheme-button')
  }
  throw new Error('Vowel practice did not complete')
}

async function completeBuildRead(useAccessible) {
  if (useAccessible) await clickButton('Use nonvisual version', '.build-step button')

  for (let pass = 0; pass < 2; pass += 1) {
    for (const component of TARGET_SEQUENCE) {
      await clickButton(component, '.build-step .grapheme-button')
    }
    await waitForExpression(
      `${byButtonText('Continue', '.build-step button')} !== undefined`,
      `Build pass ${pass + 1} Continue`,
    )
    await clickButton('Continue', '.build-step button')
  }
}

async function reachL9(useAccessible) {
  await navigate()
  await clickButton('Continue')
  await completeContextChoice()
  await completeMappingPractice()
  await completeVowelPractice()
  await completeBuildRead(useAccessible)
}

const evidence = {
  standardVisual: {},
  accessible: {},
  screenshots: [],
}

await send('Page.enable')
await send('Runtime.enable')

// Standard visual route.
await reachL9(false)
await waitForExpression("document.querySelector('.l9-step') !== null", 'visual L9')
await assertBrowser("document.body.innerText.includes('Привіт')", 'visual L9 exposes written target')
await assertBrowser("!document.body.innerText.includes('Привіп') && !document.body.innerText.includes('Птивіт')", 'visual L9 keeps foil spellings internal')
await assertBrowser("document.querySelectorAll('.l9-step [data-audio-id]').length === 3", 'visual L9 exposes three audio option seams')
await screenshot('standard-visual-l9.png')
evidence.screenshots.push('standard-visual-l9.png')
evidence.standardVisual = {
  targetVisible: true,
  foilSpellingsHidden: true,
  optionSeams: ['audio/l9-target', 'audio/l9-f1', 'audio/l9-f2'],
}
await clickAudio('audio/l9-target')
await clickButton('Continue', '.l9-step button')
await completeContextChoice()
await waitForExpression("document.querySelector('.completion-step') !== null", 'completion')
await screenshot('standard-completion.png')
evidence.screenshots.push('standard-completion.png')

// Accessible route, before evidence submission.
await reachL9(true)
await waitForExpression("document.querySelector('.accessible-l9-step') !== null", 'accessible L9-A')
await assertBrowser("!document.body.innerText.includes('Привіт')", 'accessible L9-A hides full target before submission')
await assertBrowser("document.querySelector('[data-audio-id=\"audio/l9-target\"]') === null && document.querySelector('[data-audio-id=\"audio/neutral-target\"]') === null", 'accessible L9-A has no target-audio control before submission')
await assertBrowser("[...document.querySelectorAll('.accessible-l9-step .grapheme-button')].map((el) => el.textContent.trim()).sort().join('') === ['П','р','и','в','і','т'].sort().join('')", 'accessible L9-A exposes exactly six taught grapheme controls')
await assertBrowser("[...document.querySelectorAll('.accessible-l9-step button')].find((el) => el.textContent.trim() === 'Check')?.disabled === true", 'Check is disabled before six components')
await screenshot('accessible-l9-before-submit.png')
evidence.screenshots.push('accessible-l9-before-submit.png')

// Keyboard focus contract: selection must keep focus inside reconstruction.
await focusExpression(
  byButtonText('П', '.accessible-l9-step .grapheme-button'),
  'first accessible grapheme',
)
await pressEnter()
await waitForActiveText(
  'р',
  'keyboard selection focus moves to the first remaining grapheme',
)
await assertBrowser(
  "document.activeElement?.classList.contains('grapheme-button') === true",
  'keyboard selection keeps focus on a reconstruction grapheme',
)

// Deliberately build an incorrect full sequence using keyboard activation.
await focusExpression(
  byButtonText('и', '.accessible-l9-step .grapheme-button'),
  'out-of-order accessible grapheme',
)
await pressEnter()
await waitForActiveText('р', 'focus after out-of-order second grapheme')
for (const expectedFocus of ['в', 'і', 'т', 'Check']) {
  await pressEnter()
  await waitForActiveText(
    expectedFocus,
    `keyboard reconstruction focus reaches ${expectedFocus}`,
  )
}
await assertBrowser(
  "document.activeElement?.textContent?.trim() === 'Check' && document.activeElement?.disabled === false",
  'focus moves to enabled Check after the sixth grapheme',
)
await pressEnter()
await waitForActiveText(
  'П',
  'failed Check restores focus to first restored grapheme',
)
await assertBrowser(
  "document.activeElement?.classList.contains('grapheme-button') === true",
  'failed Check restores focus inside reconstruction choices',
)
await screenshot('accessible-l9-focus-reset.png')
evidence.screenshots.push('accessible-l9-focus-reset.png')

// Retry correctly from the restored focus, using keyboard only.
for (const expectedFocus of ['р', 'и', 'в', 'і', 'т', 'Check']) {
  await pressEnter()
  await waitForActiveText(
    expectedFocus,
    `keyboard retry focus reaches ${expectedFocus}`,
  )
}
await assertBrowser(
  "document.activeElement?.textContent?.trim() === 'Check' && document.activeElement?.disabled === false",
  'keyboard retry remains inside reconstruction through Check',
)
await pressEnter()
await waitForExpression("document.body.innerText.includes('Привіт')", 'accessible reintegration target')
await assertBrowser("document.querySelector('[data-audio-id=\"audio/neutral-target\"]') !== null", 'target audio seam appears only after accessible reconstruction')
await screenshot('accessible-l9-reintegration.png')
evidence.screenshots.push('accessible-l9-reintegration.png')
evidence.accessible = {
  targetHiddenBeforeSubmission: true,
  targetAudioHiddenBeforeSubmission: true,
  sixControls: true,
  checkGatedUntilSix: true,
  keyboardSelectionFocusRetained: true,
  failedCheckFocusRestoredToFirstChoice: true,
  keyboardRetryCompleted: true,
  targetAndAudioReintroducedAfterSuccessfulReconstruction: true,
}

await fs.writeFile(
  `${OUTPUT_DIR}/browser-evidence.json`,
  JSON.stringify(evidence, null, 2),
)
console.log('WORK-YUZU-063 real-browser evidence PASS')
console.log(JSON.stringify(evidence, null, 2))
socket.close()
