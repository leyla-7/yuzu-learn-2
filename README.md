# Yuzu Learn 2.0

Neutral browser-application technical foundation for Yuzu Learn 2.0.

This repository currently establishes development, build, type-checking, testing, and CI foundations only. It does **not** define learner-facing Lessons, course structure, activities, curriculum/content, progress, assessment, or other Product behavior.

## Requirements

- Node.js 24
- npm

## Development

```sh
npm install
npm run dev
```

## Verification

```sh
npm run typecheck
npm run test
npm run build
npm run check
```

`npm run check` is the aggregate foundation verification command.

## Current technical baseline

- React
- TypeScript
- Vite
- Vitest
- GitHub Actions CI

Future Product architecture remains intentionally open until supported by valid learner-facing specifications and evidence.
