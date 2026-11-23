import { Extension } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { Editor } from '@tiptap/react'
import { diffWords, type DiffKind, type DiffLine, type WordDiffSegment } from './diff'

export type DiffSide = 'original' | 'revised'

interface TextBlockInfo {
  /** Start of the block's inline content. */
  from: number
  /** End of the block's inline content. */
  to: number
  /** Start of the block node itself (for node-level decorations). */
  nodeFrom: number
  /** End of the block node itself. */
  nodeTo: number
  /** Normalized text used for matching against diff lines. */
  norm: string
  isCode: boolean
}

interface SequenceEntry {
  norm: string
  kind: DiffKind
  /** Word-level segments for lines paired with their counterpart side. */
  words?: WordDiffSegment[]
  /**
   * Fence-marker line kept as a free entry carrying its info string. The
   * editor usually renders no text for it, but when the parse diverges (e.g.
   * shredded or nested fences) the info string can surface as a text block —
   * keeping the entry lets the alignment still match it.
   */
  fence?: boolean
}

/** Max consecutive diff lines that may map onto a single text block. */
const MAX_RUN_LENGTH = 64

const collapseWhitespace = (text: string): string => text.replace(/\s+/g, ' ').trim()

const isWhitespace = (char: string): boolean => /\s/.test(char)

/** Common named entities the markdown parser decodes when rendering text. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

/**
 * Decodes HTML entities the way the markdown parser does when rendering, so
 * raw diff lines (`&amp;`) can be compared with the parsed text (`&`).
 */
const decodeEntities = (text: string): string =>
  text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (raw: string, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? raw)

/**
 * Strips common Markdown syntax tokens so raw diff lines can be compared with
 * the plain text ProseMirror produces after parsing (e.g. `## Setup` vs `Setup`).
 */
const stripInlineMarkdown = (text: string): string =>
  text
    .replace(/\\([\\`*_[\]~])/g, '$1')
    .replace(/`+([^`]*)`+/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<(https?:\/\/[^>]+)>/g, '$1')
    .replace(/(\*{1,3})(?=\S)([\s\S]*?\S)\1/g, '$2')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '$1')
    .replace(/==(?=\S)([\s\S]*?\S)==/g, '$1')

const normalizeMarkdownLine = (line: string): string => {
  let s = line.replace(/\t/g, '  ').trim()
  if (s === '') {
    return ''
  }
  s = s.replace(/^(?:>\s?)+/, '')
  s = s.replace(/^#{1,6}\s+/, '')
  s = s.replace(/\s+#+\s*$/, '')
  s = s.replace(/^[-*+]\s+/, '')
  s = s.replace(/^\d{1,9}[.)]\s+/, '')
  s = s.replace(/^\[[ xX]\]\s+/, '')
  s = s.replace(/\|/g, ' ')
  return decodeEntities(stripInlineMarkdown(s)).trim()
}

const normalizeMarkdown = (text: string): string =>
  text.split('\n').map(normalizeMarkdownLine).join('\n')

/** Per-line fence state (the state a non-fence line at that index sits in). */
const fenceStates = (diffLines: DiffLine[]): boolean[] => {
  const states: boolean[] = []
  let inFence = false
  for (const line of diffLines) {
    const trimmed = line.text.trim()
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inFence = !inFence
    }
    states.push(inFence)
  }
  return states
}

const normalizeDiffLine = (line: DiffLine, inFence: boolean): string =>
  inFence ? collapseWhitespace(line.text) : normalizeMarkdownLine(line.text)

const collectTextBlocks = (doc: ProseMirrorNode): TextBlockInfo[] => {
  const blocks: TextBlockInfo[] = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) {
      return
    }
    const from = pos + 1
    const to = pos + node.nodeSize - 1
    const text = to > from ? doc.textBetween(from, to, '\n', '\n') : ''
    const isCode = node.type.name === 'codeBlock'
    blocks.push({
      from,
      to,
      nodeFrom: pos,
      nodeTo: pos + node.nodeSize,
      norm: isCode ? text : normalizeMarkdown(text),
      isCode,
    })
  })
  return blocks
}

/**
 * Pairs adjacent removed/added runs (modifications) and computes word-level
 * segments for each pair, keyed by diff-line index. The removed line maps to
 * the old projection of the word diff, the added line to the new projection.
 */
const computeWordDiffPairs = (diffLines: DiffLine[]): Map<number, WordDiffSegment[]> => {
  const pairs = new Map<number, WordDiffSegment[]>()
  const states = fenceStates(diffLines)

  const runEnd = (start: number): number => {
    const kind = diffLines[start].kind
    let end = start
    while (end < diffLines.length && diffLines[end].kind === kind) {
      end++
    }
    return end
  }

  let i = 0
  while (i < diffLines.length) {
    const kind = diffLines[i].kind
    const end = runEnd(i)
    const opposite: DiffKind = kind === 'removed' ? 'added' : 'removed'
    if (kind !== 'unchanged' && end < diffLines.length && diffLines[end].kind === opposite) {
      const oppositeEnd = runEnd(end)
      const pairCount = Math.min(end - i, oppositeEnd - end)
      for (let k = 0; k < pairCount; k++) {
        const firstIndex = i + k
        const secondIndex = end + k
        const segments = diffWords(
          normalizeDiffLine(diffLines[firstIndex], states[firstIndex]),
          normalizeDiffLine(diffLines[secondIndex], states[secondIndex]),
        )
        const firstIsOld = kind === 'removed'
        pairs.set(firstIsOld ? firstIndex : secondIndex, segments.filter((s) => s.kind !== 'added'))
        pairs.set(firstIsOld ? secondIndex : firstIndex, segments.filter((s) => s.kind !== 'removed'))
      }
      i = oppositeEnd
      continue
    }
    i = end
  }

  return pairs
}

/**
 * Turns diff lines into a matching sequence for one side: the lines that make
 * up that side's document (unchanged + removed for `original`, unchanged +
 * added for `revised`) in document order. Lines inside a fence are compared
 * as raw code rather than Markdown. Fence markers are kept as free entries
 * carrying their info string (see `SequenceEntry.fence`) so the alignment can
 * skip them when the editor consumed the fence, and still match them when a
 * divergent parse surfaces the info string as visible text.
 */
const buildSequence = (
  diffLines: DiffLine[],
  side: DiffSide,
  wordPairs: Map<number, WordDiffSegment[]>,
): SequenceEntry[] => {
  const keep = (kind: DiffKind): boolean =>
    kind === 'unchanged' || (side === 'original' ? kind === 'removed' : kind === 'added')

  const states = fenceStates(diffLines)
  const sequence: SequenceEntry[] = []
  for (let index = 0; index < diffLines.length; index++) {
    const line = diffLines[index]
    if (!keep(line.kind)) {
      continue
    }
    const trimmed = line.text.trim()
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      sequence.push({
        norm: collapseWhitespace(trimmed.replace(/^(```+|~~~+)/, '')),
        kind: line.kind,
        words: wordPairs.get(index),
        fence: true,
      })
      continue
    }
    sequence.push({
      norm: normalizeDiffLine(line, states[index]),
      kind: line.kind,
      words: wordPairs.get(index),
    })
  }
  return sequence
}

/**
 * Scoring for the alignment. A match is worth `MATCH_SCORE` and walking past a
 * content line costs 1, so a block still matches when up to `MATCH_SCORE - 1`
 * unmatchable lines (parse-divergent fences, decoded entities, dropped HTML)
 * pile up before its true entry. Matching is text-exact, so a higher reward
 * only decides *whether* a block highlights, never *what* gets highlighted.
 */
const MATCH_SCORE = 16
/** Cost of walking past a content line without matching it. */
const SKIP_LINE_SCORE = -1

const CHOICE_SKIP_LINE = 0
const CHOICE_SKIP_BLOCK = 1
const CHOICE_MATCH = 2

interface BlockMatch {
  start: number
  end: number
}

/**
 * Finds the first run of sequence entries starting at `j` whose text equals
 * `block`'s (same equality rules as the old per-block matcher: code blocks
 * compare per-line, text blocks compare whitespace-collapsed). Returns the
 * index after the run's last entry, or -1. Enumeration is bounded so blank
 * and fence entries (which contribute nothing to the collapsed text) cannot
 * stretch the search.
 */
const runEndFor = (
  blocks: TextBlockInfo[],
  entryTexts: string[],
  blockIndex: number,
  j: number,
): number => {
  const block = blocks[blockIndex]
  const maxK = Math.min(entryTexts.length, j + MAX_RUN_LENGTH)
  if (block.isCode) {
    const blockLines = block.norm.split('\n').map(collapseWhitespace)
    const lines: string[] = []
    for (let k = j; k < maxK; k++) {
      lines.push(entryTexts[k])
      if (lines.length > blockLines.length) {
        return -1
      }
      if (lines.length === blockLines.length) {
        return lines.join('\n') === blockLines.join('\n') ? k + 1 : -1
      }
    }
    return -1
  }
  const target = collapseWhitespace(block.norm)
  let acc = ''
  for (let k = j; k < maxK; k++) {
    const entry = entryTexts[k]
    if (entry !== '') {
      acc = acc === '' ? entry : `${acc} ${entry}`
    }
    if (acc.length > target.length) {
      return -1
    }
    if (acc === target) {
      return k + 1
    }
  }
  return -1
}

/**
 * Aligns every text block to a run of sequence entries with a global monotonic
 * alignment (dynamic program) instead of a greedy first-match walk. A greedy
 * walk cascades: one block whose text cannot match any entry (a parse
 * divergence, an entity the parser decoded, a shredded fence) strands its
 * entries, the cursor stalls, and every following block inside the lookahead
 * window is skipped until a unique line happens to rescue it — diff highlights
 * then go missing in clusters. The DP instead chooses the assignment that
 * maximizes matched blocks while minimizing stranded content lines, so an
 * unmatchable block is skipped in isolation and its neighbors still align.
 *
 * Scoring: +`MATCH_SCORE` per matched block, -`SKIP_LINE_SCORE` per stranded
 * content line, blank and fence entries are free to skip, unmatched blocks are
 * free to skip (a wrong match would paint the wrong lines, so matching is only
 * forced when it is genuinely possible).
 */
const alignBlocks = (
  blocks: TextBlockInfo[],
  sequence: SequenceEntry[],
): Array<BlockMatch | null> => {
  const results: Array<BlockMatch | null> = blocks.map(() => null)
  const m = blocks.length
  const n = sequence.length
  if (m === 0 || n === 0) {
    return results
  }

  const entryTexts = sequence.map((entry) => collapseWhitespace(entry.norm))
  const entryFree = sequence.map(
    (entry, index) => entry.fence === true || entryTexts[index] === '',
  )

  const width = n + 1
  const memoScore = new Float64Array((m + 1) * width).fill(Number.NaN)
  const choice = new Int8Array((m + 1) * width)
  const matchEnd = new Int32Array((m + 1) * width)

  const solve = (i: number, j: number): number => {
    const idx = i * width + j
    if (!Number.isNaN(memoScore[idx])) {
      return memoScore[idx]
    }
    let best: number
    let bestChoice: number
    let bestEnd = -1
    if (i === m) {
      best = 0
      bestChoice = CHOICE_SKIP_BLOCK
    } else if (j === n) {
      best = solve(i + 1, j)
      bestChoice = CHOICE_SKIP_BLOCK
    } else {
      best = solve(i, j + 1) + (entryFree[j] ? 0 : SKIP_LINE_SCORE)
      bestChoice = CHOICE_SKIP_LINE
      const skipBlock = solve(i + 1, j)
      if (skipBlock > best) {
        best = skipBlock
        bestChoice = CHOICE_SKIP_BLOCK
      }
      const end = runEndFor(blocks, entryTexts, i, j)
      if (end > -1) {
        const score = solve(i + 1, end) + MATCH_SCORE
        if (score > best) {
          best = score
          bestChoice = CHOICE_MATCH
          bestEnd = end
        }
      }
    }
    memoScore[idx] = best
    choice[idx] = bestChoice
    matchEnd[idx] = bestEnd
    return best
  }

  solve(0, 0)

  let i = 0
  let j = 0
  while (i < m && j <= n) {
    const idx = i * width + j
    if (choice[idx] === CHOICE_MATCH) {
      results[i] = { start: j, end: matchEnd[idx] }
      j = matchEnd[idx]
      i += 1
    } else if (choice[idx] === CHOICE_SKIP_LINE) {
      j += 1
    } else {
      i += 1
    }
  }
  return results
}

/**
 * Merges the word-level segments of a matched run. Blank lines contribute
 * nothing (they have no visible text, so they must not confer highlight
 * status on the block that absorbs them). Paired lines contribute their word
 * segments; unpaired lines contribute a single full-text segment of their own
 * kind, which degrades gracefully to whole-line highlighting.
 */
const collectRunSegments = (run: SequenceEntry[]): WordDiffSegment[] => {
  const segments: WordDiffSegment[] = []
  for (const entry of run) {
    if (entry.norm === '') {
      continue
    }
    if (entry.words) {
      segments.push(...entry.words)
    } else {
      segments.push({ kind: entry.kind, text: entry.norm })
    }
  }
  return segments
}

interface CharSlot {
  char: string
  pos: number
}

/**
 * Flattens a block's inline content into per-character slots with their
 * ProseMirror positions, so word segments can be mapped back onto document
 * ranges. Inline leaves (hard breaks) become newline separators.
 */
const collectInlineChars = (doc: ProseMirrorNode, block: TextBlockInfo): CharSlot[] => {
  const slots: CharSlot[] = []
  doc.nodesBetween(block.from, block.to, (node, pos) => {
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i++) {
        slots.push({ char: node.text[i], pos: pos + i })
      }
      return false
    }
    if (node.isLeaf && node.isInline) {
      slots.push({ char: '\n', pos })
    }
    return !node.isLeaf
  })
  return slots
}

/**
 * Aligns word segments (normalized text) onto a block's character slots
 * (plain ProseMirror text), matching non-whitespace characters strictly and
 * whitespace loosely. Returns document ranges for every changed segment, or
 * null when the texts cannot be aligned (caller falls back to highlighting
 * the whole block).
 */
const alignSegments = (
  slots: CharSlot[],
  segments: WordDiffSegment[],
): Array<{ from: number; to: number; kind: DiffKind }> | null => {
  const ranges: Array<{ from: number; to: number; kind: DiffKind }> = []
  let cursor = 0

  for (const segment of segments) {
    while (cursor < slots.length && isWhitespace(slots[cursor].char)) {
      cursor++
    }
    let index = 0
    while (index < segment.text.length && isWhitespace(segment.text[index])) {
      index++
    }
    if (index >= segment.text.length) {
      continue
    }
    const start = cursor
    while (index < segment.text.length) {
      const char = segment.text[index]
      if (isWhitespace(char)) {
        while (index < segment.text.length && isWhitespace(segment.text[index])) {
          index++
        }
        while (cursor < slots.length && isWhitespace(slots[cursor].char)) {
          cursor++
        }
        continue
      }
      if (cursor >= slots.length || slots[cursor].char !== char) {
        return null
      }
      cursor++
      index++
    }
    if (segment.kind !== 'unchanged' && cursor > start) {
      ranges.push({ from: slots[start].pos, to: slots[cursor - 1].pos + 1, kind: segment.kind })
    }
  }

  return ranges
}

const diffDecorationKey = new PluginKey<DecorationSet>('diffHighlightDecorations')

const diffDecorationPlugin = new Plugin<DecorationSet>({
  key: diffDecorationKey,
  state: {
    init: () => DecorationSet.empty,
    apply: (tr, decorations) => {
      const next = tr.getMeta(diffDecorationKey)
      if (next !== undefined) {
        return next
      }
      return decorations.map(tr.mapping, tr.doc)
    },
  },
  props: {
    decorations: (state) => diffDecorationKey.getState(state),
  },
})

/**
 * Carries the plugin that stores diff highlight decorations in editor state.
 *
 * All diff highlighting is done with decorations rather than marks: marks are
 * part of the document, so applying them is a doc-changing transaction — it
 * fires `onUpdate`, and the markdown serializer renders highlight marks as
 * `==text==`, so the changed serialization echoes back through `onChange` and
 * re-enters the highlight effect in an infinite loop ("Maximum update depth
 * exceeded", with highlights flickering as they are stripped and re-added).
 * Decorations live in plugin state, never touch the document, and are mapped
 * through subsequent transactions so they survive editing.
 */
export const DiffHighlightDecorations = Extension.create({
  name: 'diffHighlightDecorations',
  addProseMirrorPlugins() {
    return [diffDecorationPlugin]
  },
})

const decorationSpecKey = (decoration: Decoration): string =>
  `${decoration.from}:${decoration.to}:${decoration.spec.type ?? ''}:${decoration.spec.kind ?? ''}`

/**
 * Applies diff highlights as decorations (never document marks — see
 * `DiffHighlightDecorations` for why):
 * - `revised` side: `added` content gets a green highlight.
 * - `original` side: `removed` content gets a red highlight.
 *
 * Modified lines (paired removed/added) are highlighted word-by-word; wholly
 * added/removed content is highlighted as a whole (falling back to the whole
 * block when word segments cannot be aligned). Code blocks additionally get a
 * `data-diff` border via a node decoration. The dispatch is skipped entirely
 * when the decorations would not change, so highlight application can never
 * mutate the document or trigger `onUpdate`.
 */
export const applyDiffHighlights = (
  editor: Editor,
  diffLines: DiffLine[],
  side: DiffSide,
): void => {
  const { state } = editor
  const targetKind: DiffKind = side === 'revised' ? 'added' : 'removed'
  const wordClass = targetKind === 'added' ? 'diff-word-added' : 'diff-word-removed'

  const wordPairs = computeWordDiffPairs(diffLines)
  const blocks = collectTextBlocks(state.doc)
  const sequence = buildSequence(diffLines, side, wordPairs)

  const decorations: Decoration[] = []
  const matches = alignBlocks(blocks, sequence)
  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const match = matches[blockIndex]
    if (!match) {
      continue
    }
    const block = blocks[blockIndex]
    const segments = collectRunSegments(sequence.slice(match.start, match.end))
    if (!segments.some((segment) => segment.kind === targetKind)) {
      continue
    }

    const ranges = alignSegments(collectInlineChars(state.doc, block), segments)
    if (ranges) {
      for (const range of ranges) {
        if (range.kind === targetKind && range.to > range.from) {
          decorations.push(
            Decoration.inline(
              range.from,
              range.to,
              { class: wordClass },
              { kind: targetKind, type: 'word' },
            ),
          )
        }
      }
    } else if (!block.isCode && block.to > block.from) {
      // Word segments could not be aligned — degrade to a whole-block highlight.
      decorations.push(
        Decoration.inline(
          block.from,
          block.to,
          { class: wordClass },
          { kind: targetKind, type: 'block' },
        ),
      )
    }

    if (block.isCode) {
      // Code blocks get a `data-diff` border via a node decoration.
      decorations.push(
        Decoration.node(
          block.nodeFrom,
          block.nodeTo,
          { 'data-diff': targetKind },
          { kind: targetKind, type: 'node' },
        ),
      )
    }
  }

  const currentDecorations = diffDecorationKey.getState(state) ?? DecorationSet.empty
  const currentSpecs = currentDecorations.find().map(decorationSpecKey)
  const nextSpecs = decorations.map(decorationSpecKey)
  const decorationsChanged =
    currentSpecs.length !== nextSpecs.length ||
    currentSpecs.some((spec, index) => spec !== nextSpecs[index])

  if (!decorationsChanged) {
    return
  }
  const tr = state.tr
  tr.setMeta('addToHistory', false)
  tr.setMeta(diffDecorationKey, DecorationSet.create(state.doc, decorations))
  editor.view.dispatch(tr)
}
