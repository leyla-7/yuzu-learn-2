import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve('public/audio/lesson1')
const expected = {
  '1.m4a': ['74e461b364b2684bd458c3ea689801f63489d208408a2bbcf34ed16915546951', 16558],
  '2.m4a': ['314e4fc02abd48ced2c9f0680d7a3f2550ad29aa9b97cc94cfb1d545c06dd829', 15021],
  '3.m4a': ['e7cb949b7e90f1990e5959cb60f51535e32b38e2b7332077cbd7dd426e176d6e', 13880],
  '4.m4a': ['cded5e729c3608a26eaaed319fc0979867d9fa673be1842e9d3a1545413dd27a', 12432],
  '5.m4a': ['c194f0e0003a5ba07426acb408af1aa91080717284588e10f2b96544268cd4e4', 8918],
  '6.m4a': ['e9d304bf3be5038e7945fc906f175b2699e2f70a809c1857bde79eefcc285b29', 11011],
  '7.m4a': ['dabc4ec1bbd2bde24e1a02fb164fde4fd7ecc97ca9e8c2cb12d484a8979b9c97', 8488],
  '8.m4a': ['98361c528c32502052393e2d4a4c9637c5ab0f2fcae9ffc934ab037ebe391303', 12546],
  '9.m4a': ['07324fca91a110d518700d0f32dcf2bf2a9a39d715c1f44dda53ead3a03afcf2', 11565],
  '12.m4a': ['bfceeff8291c410f5e03989e1f5959b5eec2e5cce777ae7b7b6cc67ff5483d1b', 16146],
  '13.m4a': ['c2a0b6b1d4037a7167538f828531734171d9b2103051bc3f0dc0353409873d7e', 16409],
  '14.m4a': ['0abde61ae9f91e72cc39da7e52fc9ee428813c9d900887539595ee39bdceb53f', 16170],
}

const actualNames = (await readdir(ROOT)).sort()
const expectedNames = Object.keys(expected).sort()
const missingNames = expectedNames.filter((name) => !actualNames.includes(name))
if (missingNames.length > 0) {
  throw new Error(
    `Lesson 1 accepted audio files missing: ${missingNames.join(', ')}`,
  )
}

const unboundExtras = actualNames.filter((name) => !expectedNames.includes(name))
if (unboundExtras.length > 0) {
  console.log(`Unbound extra audio files ignored: ${unboundExtras.join(', ')}`)
}

for (const [name, [expectedSha256, expectedSize]] of Object.entries(expected)) {
  const bytes = await readFile(path.join(ROOT, name))
  const actualSha256 = createHash('sha256').update(bytes).digest('hex')
  if (bytes.length !== expectedSize || actualSha256 !== expectedSha256) {
    throw new Error(
      `${name} mismatch: size ${bytes.length}/${expectedSize}, sha256 ${actualSha256}/${expectedSha256}`,
    )
  }
  console.log(`${name} PASS ${bytes.length} bytes sha256:${actualSha256}`)
}

console.log('WORK-YUZU-063 accepted audio byte verification PASS')
