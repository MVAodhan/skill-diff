# Skill Diff Editor — UI Implementation Plan

> **Purpose:** Phased implementation plan for building the UI and client-side diffing of a side-by-side Markdown skill file diff editor with an AI prompt bar. Each phase is designed to be self-contained so different agents can pick up and complete phases independently across sessions.
>
> **Scope & Constraints:**
> - **UI & client-side diffing only.** Server/AI generation will be implemented separately by the user via a clean callback boundary.
> - **Do not install packages, add test suites, or run build commands.** Use the existing dependencies and shadcn primitives already in the repo; the user handles package installation, testing, and builds themselves.

---

## Project Context & Tech Stack

- **Framework:** TanStack Start (`@tanstack/react-start` + `@tanstack/react-router`), Vite 8, React 19, TypeScript 6 (`strict: true`, `verbatimModuleSyntax: true`, `noUnusedLocals: true`, `noUnusedParameters: true`)
- **Styling & UI:** Tailwind CSS v4 (`src/styles.css`), shadcn (`base-nova` style using `@base-ui/react`, `lucide-react`), aliases `#/*` and `@/*` both map to `./src/*`
- **Editor:** Tiptap v3 (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/markdown`, `@tiptap/extension-highlight` configured with `multicolor: true`)
- **Existing Key Files:**
  - `src/lib/diff.ts` — starter LCS line-diff (`readlines`, `diffLines`)
  - `src/components/tiptap.tsx` — starter Tiptap component with `StarterKit`, `Markdown`, and `Highlight`
  - `src/routes/index.tsx` — home route (currently renders `<Tiptap />` with sample diff strings)
  - `src/routes/__root.tsx` — root shell & document metadata
  - `src/components/ui/button.tsx`, `src/components/ui/card.tsx` — existing shadcn primitives

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Top Header: App Title | Load Sample Skill                               │
├─────────────────────────────────────────────────────────────────────────┤
│ Prompt Input: [ Describe changes to the skill... ]        [ Generate ]  │
├───────────────────────────────────┬─────────────────────────────────────┤
│ Left Pane: Original Skill         │ Right Pane: Revised Skill (Diff)    │
│ (Tiptap Editor - Editable)        │ (Tiptap Editor - Diff Highlighted)  │
│ - Markdown source of truth        │ - Full revised Markdown             │
│ - Optional red highlights for     │ - Green highlights for added/       │
│   removed lines                   │   changed lines (+N / -M badge)     │
└───────────────────────────────────┴─────────────────────────────────────┘
```

**Data Flow:**
1. User enters or pastes a Markdown skill file in the **Left Editor** (`originalMarkdown`).
2. User enters an instruction in the **Prompt Input** and submits.
3. An isolated `handleGenerate(originalMarkdown, prompt)` callback (stubbed in the UI, ready to connect to the user's server implementation) returns the full `revisedMarkdown`.
4. The **Diff Engine** (`src/lib/diff.ts`) compares `originalMarkdown` vs `revisedMarkdown` and produces structured diff lines and summary counts.
5. The **Tiptap Highlight Mapper** (`src/lib/tiptap-diff.ts`) applies `@tiptap/extension-highlight` marks to the Right Editor (additions/modifications) and optionally the Left Editor (removals), without corrupting exported Markdown.

---

## Phase Status Tracker

> **Agent Handoff Rule:** Before starting a phase, check its prerequisites. When finishing a phase, update its status below and add any brief notes under the phase's **Handoff Notes** section.

| Phase | Title | Status | Depends On |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Complete the Diff Engine | `Complete` | None |
| **Phase 2** | Reusable Tiptap Markdown + Diff Highlight Editor | `Complete` | Phase 1 |
| **Phase 3** | Split-Pane UI & Prompt Input | `Complete` | Phase 2 |

---

## Phase 1: Complete the Diff Engine

### Goal
Turn the starter `readlines` / `diffLines` functions in `src/lib/diff.ts` into a clean, well-typed diff module that supports line-level diffs and summary statistics (plus optional word-level inline diffs for modified lines).

### Files to Touch
- `src/lib/diff.ts` (modify)

### Tasks
1. **Clean up existing code in `src/lib/diff.ts`:**
   - Remove `console.log("lcs len", lcs)`.
   - Preserve `readlines(fileText: string): string[]` and handle edge cases: empty string, single line, CRLF (`\r\n`), trailing newline, multiple blank lines.
2. **Define structured diff types:**
   ```ts
   export type DiffKind = 'unchanged' | 'added' | 'removed'

   export interface DiffLine {
     kind: DiffKind
     text: string
     oldLineNumber: number | null // 1-based line number in original (null for added)
     newLineNumber: number | null // 1-based line number in revised (null for removed)
   }

   export interface DiffSummary {
     added: number
     removed: number
     unchanged: number
   }

   export interface DiffResult {
     lines: DiffLine[]
     summary: DiffSummary
   }
   ```
3. **Implement `computeDiff(original: string, revised: string): DiffResult`:**
   - Uses `readlines` + the LCS table to produce `DiffLine[]` with accurate `oldLineNumber` and `newLineNumber` tracking.
   - Keep `diffLines` (or refactor it to delegate to `computeDiff`) so nothing breaks in `src/routes/index.tsx`.
4. **Add helpers for changed line sets:**
   - Export helpers such as `getAddedLineIndices(result: DiffResult): Set<number>` and `getRemovedLineIndices(result: DiffResult): Set<number>` so Phase 2 can highlight additions on the right and removals on the left without re-parsing prefixes.
   - *(Optional enhancement)* Add `diffWords(oldLine: string, newLine: string)` for finer-grained inline highlighting when a single line is modified rather than wholly added/removed.

### Acceptance Criteria
- `src/lib/diff.ts` has no debug logs, adheres to strict TypeScript rules (`strict`, `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters`), and exports typed `DiffResult` utilities.

### Handoff Notes

- `computeDiff(original, revised)` produces `DiffLine[]` with accurate 1-based `oldLineNumber` / `newLineNumber` plus summary counts. The LCS walk lives in a shared `walkLcsDiff` helper; `diffLines(m, n)` still works and delegates to it (same `'  '` / `'- '` / `'+ '` prefixed output as before).
- `getAddedLineIndices` / `getRemovedLineIndices` return indices into `result.lines` (not source-document line numbers).
- `diffWords(oldText, newText)` provides word-level segments (token LCS over non-whitespace runs, whitespace-insensitive); the old line's projection filters out `added` segments, the new line's filters out `removed`. It powers the word-level highlighting in Phase 2.
- Verified with `strict`, `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters` — no debug logs, no type errors.

---

## Phase 2: Reusable Tiptap Markdown + Diff Highlight Editor

### Goal
Refactor `src/components/tiptap.tsx` into a reusable Markdown editor component that supports controlled Markdown updates, read-only or editable modes, clean Markdown styling, and applying diff highlights using the `@tiptap/extension-highlight` plugin.

### Prerequisites
- Phase 1 complete (`computeDiff` and `DiffLine` types available in `src/lib/diff.ts`).

### Files to Touch
- `src/components/tiptap.tsx` (refactor)
- `src/lib/tiptap-diff.ts` (create — maps `DiffLine[]` onto Tiptap highlight marks)
- `src/styles.css` (add ProseMirror / Markdown typography and highlight styles)

### Technical Considerations (Important for Implementing Agent)
- **Tiptap v3 + `@tiptap/markdown`:**
  - Verify how `@tiptap/markdown` v3 reads and writes Markdown (e.g., `editor.getMarkdown()` / `editor.commands.setContent(md, { contentType: 'markdown' })`) by inspecting `node_modules/@tiptap/markdown` types rather than guessing v2 APIs.
  - Guard against infinite update loops when syncing `content` prop -> `editor.commands.setContent(...)` -> `onUpdate` -> `onChange`. Only call `setContent` when external `content` differs from the editor's current Markdown.
- **Applying Diff Highlights Safely:**
  - Do **not** naively wrap raw Markdown lines in `<mark>...</mark>` before parsing, as that breaks Markdown syntax (headings `#`, list items `- `, fenced code blocks ```` ``` ````).
  - Instead, in `src/lib/tiptap-diff.ts`, parse the clean Markdown into the Tiptap editor first, then traverse the ProseMirror document (`editor.state.doc.descendants(...)`) to locate textblocks matching the added (right editor) or removed (left editor) lines/segments from `DiffResult`, and apply `Highlight` marks in a single ProseMirror transaction (`tr.addMark(from, to, highlightMark)` with `addToHistory: false`).
  - Use distinct colors via `Highlight.configure({ multicolor: true })`, e.g.:
    - Added lines: soft green (e.g., `var(--diff-added-bg)` or `#dcfce7` / dark-mode aware CSS attribute selector `mark[data-color="added"]` or hex value).
    - Removed lines: soft red (e.g., `#fee2e2`).
  - When reading Markdown back out of the editor, ensure highlight marks do not leak into the Markdown string (either track raw Markdown separately or strip `highlight` marks before serialization).
- **YAML Frontmatter (`SKILL.md`):**
  - Skill files often begin with `---\nname: ...\ndescription: ...\n---`. Check how `@tiptap/markdown` parses frontmatter. If it mangles frontmatter, add a small helper (`splitFrontmatter(md)`) so frontmatter is preserved cleanly or rendered in a collapsible/code block above the body while still participating in the diff.

### Tasks
1. **Refactor `src/components/tiptap.tsx`:**
   - Accept props:
     ```ts
     export interface MarkdownEditorProps {
       content: string
       onChange?: (markdown: string) => void
       editable?: boolean
       diffLines?: DiffLine[]
       diffSide?: 'original' | 'revised'
       className?: string
       placeholder?: string
     }
     ```
   - Keep `immediatelyRender: false` for TanStack Start SSR safety.
   - Sync external `content` changes (e.g., when a new version arrives or a sample is loaded) and re-apply diff highlights whenever `content` or `diffLines` changes.
2. **Create `src/lib/tiptap-diff.ts`:**
   - Implement `applyDiffHighlights(editor: Editor, diffLines: DiffLine[], side: 'original' | 'revised')`.
   - Clear existing `highlight` marks first, then apply `added` highlights on `'revised'` and `removed` highlights on `'original'`.
   - Handle Markdown formatting stripped during parsing (e.g., a diff line `## Setup` becomes heading text `Setup` in ProseMirror, and `**bold**` becomes `bold`) by normalizing/stripping common Markdown syntax tokens when matching ProseMirror textblock content against `DiffLine.text`.
3. **Style the editor in `src/styles.css`:**
   - Add clean `.tiptap` / `.ProseMirror` typography styles for `h1`–`h4`, `p`, `ul`/`ol`, `blockquote`, `pre`/`code`, `hr`, and `mark` highlights (with good contrast in both light and dark themes).

### Acceptance Criteria
- Two `<Tiptap />` instances can render side-by-side with different Markdown strings without SSR hydration errors.
- Diff highlights visibly mark added lines in green on the right editor and removed lines in red on the left editor, including inside headings, paragraphs, and list items.
- Editing the left editor calls `onChange` with clean Markdown (no `<mark>` tags injected).

### Handoff Notes

- **Verified from `@tiptap/markdown` 3.35 source (not guessed):** `editor.getMarkdown()` exists; `setContent(md, { contentType: 'markdown', emitUpdate: false })` is supported; marks without a markdown renderer (like `highlight`) serialize to `""`, so highlight marks never leak into exported Markdown.
- **Frontmatter:** `@tiptap/markdown` has no frontmatter support (raw `---` becomes thematic breaks + paragraphs). Solution in `src/lib/frontmatter.ts`: `splitFrontmatter` splits it off, `withFrontmatterAsCodeFence` injects it as a ` ```yaml ` code fence (CodeBlock v3 has a `language` attr, so it round-trips), and `restoreFrontmatterFromCodeFence` converts the fence back to `---` on read. The component tracks whether the current content had frontmatter; `onChange` always emits raw `---`-delimited markdown. If the user deletes the fence block, frontmatter is dropped (transparent behavior).
- **Diff mapping (`src/lib/tiptap-diff.ts`):** each side is matched against its OWN line sequence (unchanged+removed for original, unchanged+added for revised — this reconstructs that side's document exactly). Markdown syntax is stripped on both sides before comparison (headings, bullets, blockquotes, inline code/bold/links, escapes); whitespace is collapsed so soft-wrapped paragraphs match; code blocks compare line-wise with fence markers dropped. Unmatched blocks are skipped (false negatives only, never false highlights).
- **Update-loop safety (important!):** the editor component gates `onChange` on the editor's OWN last-serialized markdown (`serializedRef`), not the incoming `content` prop. Highlight/decoration transactions never change the serialized markdown, so they can never fire `onChange` — a `Maximum update depth exceeded` loop is structurally impossible. The `extensions` array is memoized so `useEditor`'s per-render option comparison passes (otherwise it re-applies options plus a full ProseMirror view state update on every render).
- Highlights are applied in a single transaction with `addToHistory: false`; dispatch is skipped when nothing would change (loop-safe). Colors are CSS vars (`--diff-added-bg` / `--diff-removed-bg`) defined for light and dark in `styles.css` (dark values are brighter/more chromatic so highlights pop against the dark surface).
- **Code blocks cannot use highlight marks:** the CodeBlock node declares `marks: ""`, so the schema rejects marks on its text. Instead, the `DiffHighlightDecorations` extension (in `tiptap-diff.ts`, built on `@tiptap/pm` state/view plugins) gives changed code blocks a `data-diff="added"|"removed"` **node decoration** rendered as a colored border (`.tiptap pre[data-diff=…]` in `styles.css`), plus **inline word decorations** (`diff-word-added` / `diff-word-removed` classes) highlighting the changed tokens inside via the same word-segment alignment used for text blocks. The decoration set lives in plugin state and is mapped through subsequent transactions so it survives editing.
- **Word-level highlighting:** adjacent removed/added runs are paired as modifications (`computeWordDiffPairs`, fence-state aware normalization), and `diffWords` runs on the normalized pair. Matched text blocks apply per-word `highlight` marks by aligning segments onto the block's characters (`collectInlineChars` + `alignSegments`: strict on non-whitespace chars, loose on whitespace); alignment failure falls back to whole-block highlighting, and unpaired lines degrade to whole-line segments. Wholly added/removed content and markdown-only changes (identical rendered text) highlight accordingly (whole / not at all). Code blocks remain block-level node decorations.
- **Blank lines never confer highlight status:** a block's matching run may absorb adjacent blank diff lines (whitespace-collapse matching), but blanks contribute no word segments — otherwise an added blank line before an unchanged heading would wrongly highlight the heading (e.g. when a new section is inserted above it). The block that actually changed (e.g. an altered code block) still matches its own content lines and gets highlighted.
- **Deviations:** there is no `card.tsx` in the repo (plan assumed one); `placeholder` is implemented via `editor.isEmpty` tracking + an overlay div since `@tiptap/extension-placeholder` is not an installed dependency.

---

## Phase 3: Split-Pane UI & Prompt Input

### Goal
Build the full UI workspace in `src/routes/index.tsx` with a shadcn-styled prompt input at the top and side-by-side Tiptap editors (original on the left, diff-highlighted revision on the right), wired to live diff computation.

### Prerequisites
- Phase 2 complete (`Tiptap` / `MarkdownEditor` component supports `content`, `onChange`, `editable`, and diff highlights).

### Files to Touch
- `src/components/prompt-input.tsx` (create — prompt input bar using existing shadcn primitives & Tailwind)
- `src/components/diff-workspace.tsx` (create — split-pane layout + editor headers + diff stats)
- `src/routes/index.tsx` (update to render the workspace)
- `src/routes/__root.tsx` (update `<title>` to `Skill Diff`)

### Tasks
1. **Build `src/components/prompt-input.tsx`:**
   - Built with existing shadcn `Card` and `Button` (`src/components/ui/card.tsx`, `src/components/ui/button.tsx`), native `<textarea>` styled with Tailwind/shadcn theme tokens, and `lucide-react` icons (`Sparkles`, `Loader2`, `CornerDownLeft`).
   - Props:
     - `onSubmit: (prompt: string) => void | Promise<void>`
     - `isLoading: boolean`
     - `disabled?: boolean`
     - `error?: string | null`
   - Supports `Cmd+Enter` / `Ctrl+Enter` to submit, disables empty submissions, shows a spinner while generating, and displays inline error messages if generation fails.
   - Include a few clickable quick-prompt suggestion pills (e.g., `"Make instructions more concise"`, `"Add concrete examples"`, `"Tighten edge-case handling"`).
2. **Build `src/components/diff-workspace.tsx` and wire `src/routes/index.tsx`:**
   - Top header bar with app title (`Skill Diff`) and a sample skill loader (pre-populate a realistic sample `SKILL.md` so the editor is immediately populated on first load).
   - Top `<PromptInput />` bar spanning the workspace width.
   - Responsive 2-column grid (`grid-cols-1 lg:grid-cols-2 gap-4`) with equal-height scrollable editor panes:
     - **Left Pane ("Original Skill"):** Editable `<Tiptap />`, shows red highlights for removed lines when a revision exists.
     - **Right Pane ("New Version — Diff"):** `<Tiptap />` displaying the full revised Markdown with green highlights for added/changed lines, plus a diff summary pill (`+X / -Y lines` from `computeDiff`).
     - Empty state on the right pane before a revision is generated ("Submit a prompt above to generate a new version of this skill").
   - Expose a clean, isolated `handleGenerate(originalMarkdown: string, prompt: string): Promise<string>` stub in `src/routes/index.tsx` (e.g., returning a sample revised Markdown so the diff UI can be previewed immediately) that can be swapped directly for the user's server implementation.

### Acceptance Criteria
- The page renders cleanly at desktop and narrow viewports with no layout overflow or hydration warnings.
- Typing in the left editor updates the diff immediately when a right-side version is present.
- Submitting the prompt input triggers loading state and displays validation/errors cleanly.

### Handoff Notes

- `handleGenerate(originalMarkdown, prompt)` is exported from `src/routes/index.tsx` as the single swap point for the user's server implementation (a ready-to-adapt `fetch` example is in its JSDoc). The stub contains **no AI logic**: it simulates latency and returns the static `SAMPLE_REVISED_SKILL`.
- A pre-built example pair (`SAMPLE_SKILL` + `SAMPLE_REVISED_SKILL` in `src/lib/sample-skill.ts`) is the initial state, so the diff UI (green/red highlights + `+X / -Y` pill) is visible immediately on open. The right-pane empty state still appears after "Load sample skill" clears the revision, and Generate then works coherently against the pristine sample.
- Error contract: the route's submit handler sets `promptError` then **rethrows**, and `PromptInput` only clears the textarea when the promise resolves — failed generations keep the prompt text for editing.
- Layout: `h-dvh` flex column with `overflow-hidden` — the workspace always fits exactly 100% of the viewport and the page itself never scrolls. Pane rows are constrained at every breakpoint (stacked `minmax(0,1fr)` rows on mobile, a single row side-by-side on `lg`), and each pane scrolls internally through the shadcn `ScrollArea` primitive (`src/components/ui/scroll-area.tsx`).
- The prompt bar is composed from Tailwind theme tokens + the existing `Button`/`Spinner` primitives (no `Card` primitive exists in the repo). Quick-prompt pills set (not submit) the textarea value.
- `__root.tsx` title updated to `Skill Diff`.
