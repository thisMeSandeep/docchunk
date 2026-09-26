# Instructions 

- Firecrawl github - https://github.com/firecrawl/anydoc
- Make use of skills whenever relevant 
- Don't commit yourself , let me read changed files first .
- Sample files for testing are present in - ./sample-test-files 

## 1. Code style rules (for the agent)

> The maintainer reads and must understand every line. Prefer plain, obvious code over short or clever code.

### 1.1 Code

1. **Plain functions.** The only class is `DocchunkError`.
2. **Abstractions only where they serve users or the registry.** The strategy registry (PRD section 6.5) is the one internal pattern. No factories, builders, dependency injection, base classes, or generic utility layers.
3. **Small units.** Functions under ~40 lines; files under ~250 lines. When a limit is exceeded, split by responsibility into clearly named files.
4. **Obvious control flow.** Plain `for` loops and early returns. No long `reduce`/`map` chains, no nested ternaries, no one-line tricks.
5. **Named intermediate values.** Put partial results in well-named variables instead of long expressions.
6. **Descriptive names.** Full words (`sectionStart`, not `ss`; `blockIndex`, not `bi`). Boolean names start with `is`/`has`/`should`.
7. **Type safety.**
   - `strict` mode; no `any`; no non-null assertions (`!`); no `as` casts except where unavoidable, with a one-line comment giving the reason.
   - Explicit parameter and return types on all exported functions.
   - Generics only where the public API or the registry needs them.
8. **Readability test:** if a function needs a comment to explain *how* it works, rewrite it to be simpler.

### 1.2 Comments

1. **File header:** one line at the top of every file stating what the file does.
   `// Splits a document into chunks at heading boundaries.`
2. **Function comment:** one line above every function, as single-line JSDoc, stating what it does.
   `/** Returns the heading path for each block. */`
3. **Public option and output properties:** one-line JSDoc each, including the unit and default.
   `/** Maximum characters per chunk. Default 1500. */`
4. **Inside functions:** at most one or two short lines, only where the *reason* for the code is not obvious.
5. **Never:** multi-paragraph comments, comments that repeat the code, commented-out code, or `TODO`s without an issue reference.

### 1.3 File naming

- `kebab-case.ts`, named after what the file contains: `split-table.ts`, `merge-small-chunks.ts`, `detect-format.ts`.
- One strategy per file, named after the strategy: `src/strategies/sentence-window.ts`.
- No `utils.ts`, `helpers.ts`, `misc.ts`, or `index.ts` barrels inside folders. Only `src/index.ts` (the public API) re-exports.

## 2. Build guide for the agent (Claude Code)

### 2.1 Working rules

1. **`docs/PRD.md` is the source of truth.** Do not add features listed in PRD section 3 or marked P2.
2. **One phase at a time.** Complete a phase (`docs/PLAN.md`, build phases), including its tests, then **stop and summarize the files created or changed** so the maintainer can review before the next phase.
3. **If the PRD is ambiguous,** choose the simplest option consistent with it, record it in `docs/DECISIONS.md` (question, decision, reason), and continue. Stop and ask only for decisions that change public names or behavior.
4. **Verify third-party APIs, do not assume them.** Before writing the anydoc adapter, read the installed package's README and type definitions in `node_modules/@firecrawl/anydoc`. Pin the exact version. Never pass its OCR option.
5. **No network code** in `src/`. No telemetry, no update checks.
6. **Strategy `split` functions only return ranges** (`RawChunk[]`). They never create chunk text, IDs, or hashes; `finalize-chunks.ts` does.
7. **All size checks use `measure`.** Never call `.length` on chunk text inside strategies.
8. **Tests with each change.** A task is done only when `bun run typecheck && bun run lint && bun run test` pass locally. Before ending a phase, also run the tests under Node (`bun run test:node`), since users run the library on Node.
9. **No commits.** Never run `git commit`. After each step, list the changed files and give the step's commit message from `docs/PLAN.md`; the maintainer reviews and commits.
10. **No new dependencies** beyond PRD section 9 and section 2.2 without an entry in `docs/DECISIONS.md`.
11. **Follow section 1 for every file.**

### 2.2 Tooling

- **Bun** for development: package manager (`bun install`, lockfile `bun.lock`), running scripts (`bun run <script>`), and running TypeScript files directly during development (`bun run src/some-file.ts`).
- Language: TypeScript (strict), target ES2023, Node ≥ 22.12 (the CJS build needs `require()` of ESM packages; see `docs/DECISIONS.md` 6).
- Build: `tsup` (ESM + CJS + `.d.ts`); entries `src/index.ts` and `src/cli.ts` (`bin`). The published package contains compiled JavaScript and `.d.ts` files, never raw `.ts`. Do not replace `tsup` with `bun build`, because the package must ship `.d.ts` files.
- Tests: `vitest` + `fast-check`. Vitest is the one test framework, because the same tests must run under both Node and Bun (CI, PRD section 11.1). Do not use `bun:test` imports.
- `package.json` scripts:

| Script | Command | Purpose |
|---|---|---|
| `test` | `bun --bun vitest run` | Tests under Bun (fast, local default) |
| `test:node` | `vitest run` | Tests under Node |
| `typecheck` | `tsc --noEmit` | Type checking |
| `lint` | `biome check .` | Lint and format check |
| `build` | `tsup` | Build for publishing |
| `bench` | `bun run bench/run.ts` | Benchmarks |
| `check:network` | `bun run scripts/check-no-network.ts` | Fails if `src/` imports a network module or uses `fetch` |

- Lint/format: `biome`
- Benchmarks: `tinybench`
- Releases: `changesets`

### 2.3 Implementation notes

- Get block offsets from mdast `position.start.offset` / `position.end.offset`. Use only top-level blocks for the IR; read list items and table rows from their children's positions.
- Heading text for `headingPath`: plain text of the heading node (strip inline Markdown).
- Create `Intl.Segmenter` instances once (module-level constants). No locale option in v1.
- Sentence units: a function that computes them on first call and stores them on the IR object; later calls return the stored array.
- In `structure`, measure each block once and reuse the number when packing.
- Sort final chunks by `start`, then `level`, then `end`, before assigning `index`.
- `chunkDocuments`: run at most `concurrency` documents at a time using a plain loop over a queue; do not add a dependency.
- Respect `signal`: check `signal.aborted` between documents and between hierarchical levels; throw `ABORTED`.
