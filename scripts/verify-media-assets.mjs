import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const assets = [
  {
    path: 'public/media/lesson1/L1-01_anchor_greeting.webp',
    source: {
      libraryId: 'libfile_109d03d809808191930576c521a20045',
      file: 'L1-01_anchor_greeting.png',
      sha256: '3e4e9f7abc78391125fce0b8cd89a87e6648c043634fe4955e21f333e3e8f564',
      size: [1504, 430],
    },
    built: {
      sha256: '44528256a0e14d2d89cf75f04a4e66edbea7d630ef273a2b1b65ee95bb9519d1',
      bytes: 11998,
      size: [600, 172],
    },
  },
  {
    path: 'public/media/lesson1/L1-07_context_sprite.webp',
    source: {
      libraryIds: [
        'libfile_8ade8ecf9fa0819187b980111394e5af',
        'libfile_d1840596f0d081918242cc8906cc0021',
        'libfile_ea255b4271c48191a9316e2665b1fd01',
        'libfile_5fa4948e57d48191b18b780181b275bd',
      ],
      files: [
        'L1-07_A_approach.png',
        'L1-07_B_greeting.png',
        'L1-07_C_already_together.png',
        'L1-07_D_departure.png',
      ],
      sha256: [
        'e536a0b136dbeaa8192af1347d3e9c774ba586091c4aff0d4ff292632a3ce808',
        '6ab4b87125069ae0f03ff2ee487f7a5e284338e13e7c05d2e3adbfe490c0ae86',
        'df136c254407793007f5ae282bc7402c3baf096858e9344dfbc1783ce39070bb',
        'c634e6eda1f3ee8477dd71d5cd6043687af98da4f2469e798387ecf40b84add2',
      ],
      composition: 'A/B/C/D left-to-right; each source center-fit with CSS-cover semantics into an equal 90x102 cell',
    },
    built: {
      sha256: '37fd986c5bf9c82377c94aed2770d3521366a413545645ffcd156345214eb4f8',
      bytes: 10240,
      size: [360, 102],
    },
  },
]

function parseSimpleVp8Size(buffer) {
  if (buffer.subarray(12, 16).toString('ascii') !== 'VP8 ') {
    throw new Error('Expected a simple VP8 WebP chunk')
  }
  if (
    buffer[23] !== 0x9d ||
    buffer[24] !== 0x01 ||
    buffer[25] !== 0x2a
  ) {
    throw new Error('Missing VP8 frame sync code')
  }
  return [
    buffer.readUInt16LE(26) & 0x3fff,
    buffer.readUInt16LE(28) & 0x3fff,
  ]
}

for (const asset of assets) {
  const buffer = await readFile(asset.path)
  const hash = createHash('sha256').update(buffer).digest('hex')

  if (buffer.subarray(0, 4).toString('ascii') !== 'RIFF') {
    throw new Error(`${asset.path}: missing RIFF header`)
  }
  if (buffer.subarray(8, 12).toString('ascii') !== 'WEBP') {
    throw new Error(`${asset.path}: missing WEBP signature`)
  }

  const declaredTotal = buffer.readUInt32LE(4) + 8
  if (declaredTotal !== buffer.length) {
    throw new Error(
      `${asset.path}: truncated/overlong RIFF; declared ${declaredTotal}, actual ${buffer.length}`,
    )
  }
  if (buffer.length !== asset.built.bytes) {
    throw new Error(
      `${asset.path}: expected ${asset.built.bytes} bytes, got ${buffer.length}`,
    )
  }
  if (hash !== asset.built.sha256) {
    throw new Error(
      `${asset.path}: SHA-256 mismatch; expected ${asset.built.sha256}, got ${hash}`,
    )
  }

  const [width, height] = parseSimpleVp8Size(buffer)
  if (width !== asset.built.size[0] || height !== asset.built.size[1]) {
    throw new Error(
      `${asset.path}: expected ${asset.built.size.join('x')}, got ${width}x${height}`,
    )
  }

  console.log(
    `MEDIA PASS ${asset.path} ${width}x${height} ${buffer.length} bytes sha256:${hash}`,
  )
}
