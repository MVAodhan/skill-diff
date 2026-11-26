export type DiffKind = 'unchanged' | 'added' | 'removed'

export interface DiffLine {
  kind: DiffKind
  text: string
  /** 1-based line number in the original text, or null for added lines. */
  oldLineNumber: number | null
  /** 1-based line number in the revised text, or null for removed lines. */
  newLineNumber: number | null
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

export const readlines = (fileText: string): string[] => {
  const text = fileText.replace(/\r\n/g, '\n').replace(/\n$/, '')
  if (text === '') {
    return []
  }

  return text.split('\n')
}

type DiffVisitor = (
  kind: DiffKind,
  text: string,
  oldLineNumber: number | null,
  newLineNumber: number | null,
) => void

/**
 * Walks the LCS table for `m` (original) vs `n` (revised) and calls `visit`
 * for every line in diff order. Shared by `computeDiff` and `diffLines`.
 */
const walkLcsDiff = (m: string[], n: string[], visit: DiffVisitor): void => {
  const lcs: number[][] = Array.from({ length: m.length + 1 }, () =>
    new Array<number>(n.length + 1).fill(0)
  );
  for (let i = m.length - 1; i >= 0; i--) {
    for (let j = n.length - 1; j >= 0; j--) {
      if (m[i] === n[j]) {
        lcs[i][j] = lcs[i + 1][j + 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      }
    }
  }

  let i = 0;
  let j = 0;

  while (i < m.length && j < n.length) {
    if (m[i] === n[j]) {
      visit('unchanged', m[i], i + 1, j + 1)
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      visit('removed', m[i], i + 1, null)
      i++;
    } else {
      visit('added', n[j], null, j + 1)
      j++;
    }
  }
  for (; i < m.length; i++) {
    visit('removed', m[i], i + 1, null)
  }
  for (; j < n.length; j++) {
    visit('added', n[j], null, j + 1)
  }
}

/**
 * Computes a line-level diff between the original and revised texts.
 */
export const computeDiff = (original: string, revised: string): DiffResult => {
  const lines: DiffLine[] = []
  const summary: DiffSummary = { added: 0, removed: 0, unchanged: 0 }

  walkLcsDiff(readlines(original), readlines(revised), (kind, text, oldLineNumber, newLineNumber) => {
    lines.push({ kind, text, oldLineNumber, newLineNumber })
    summary[kind] += 1
  })

  return { lines, summary }
}

/**
 * Legacy string-based diff kept for compatibility: returns lines prefixed
 * with `'  '` (unchanged), `'- '` (removed) or `'+ '` (added).
 */
export const diffLines = (m: string[], n: string[]): string[] => {
  const out: string[] = []
  walkLcsDiff(m, n, (kind, text) => {
    out.push((kind === 'added' ? '+ ' : kind === 'removed' ? '- ' : '  ') + text)
  })
  return out
}

/**
 * Indices (into `result.lines`) of lines that were added in the revision.
 */
export const getAddedLineIndices = (result: DiffResult): Set<number> => {
  const indices = new Set<number>()
  result.lines.forEach((line, index) => {
    if (line.kind === 'added') {
      indices.add(index)
    }
  })
  return indices
}

/**
 * Indices (into `result.lines`) of lines that were removed from the original.
 */
export const getRemovedLineIndices = (result: DiffResult): Set<number> => {
  const indices = new Set<number>()
  result.lines.forEach((line, index) => {
    if (line.kind === 'removed') {
      indices.add(index)
    }
  })
  return indices
}

export interface WordDiffSegment {
  kind: DiffKind
  text: string
}

export interface DiffTokenKinds {
  /** Per-token kinds for the old text's tokens, in token order. */
  old: DiffKind[]
  /** Per-token kinds for the new text's tokens, in token order. */
  new: DiffKind[]
}

/**
 * Computes a word-level diff and reports the diff kind of every token
 * (non-whitespace run) on each side, in order. Unlike `diffWords` the tokens
 * are not merged into segments, so callers can map kinds back onto exact
 * character ranges of the original text (tokens appear in the same order as
 * `text.match(/\S+/g)`).
 */
export const diffTokens = (oldText: string, newText: string): DiffTokenKinds => {
  const oldTokens = oldText.match(/\S+/g) ?? []
  const newTokens = newText.match(/\S+/g) ?? []
  const oldKinds: DiffKind[] = []
  const newKinds: DiffKind[] = []

  walkLcsDiff(oldTokens, newTokens, (kind) => {
    if (kind === 'removed') {
      oldKinds.push(kind)
    } else if (kind === 'added') {
      newKinds.push(kind)
    } else {
      oldKinds.push(kind)
      newKinds.push(kind)
    }
  })

  return { old: oldKinds, new: newKinds }
}

/**
 * Computes a word-level diff between two single lines. Tokens are
 * non-whitespace runs, so the result is whitespace-insensitive. The full
 * segment list reads old→new; the old line's projection is the segments
 * without `added`, the new line's projection is the segments without `removed`.
 */
export const diffWords = (oldText: string, newText: string): WordDiffSegment[] => {
  const oldTokens = oldText.match(/\S+/g) ?? []
  const newTokens = newText.match(/\S+/g) ?? []

  const segments: WordDiffSegment[] = []
  const push = (kind: DiffKind, token: string) => {
    const last = segments[segments.length - 1]
    if (last && last.kind === kind) {
      last.text += ' ' + token
    } else {
      segments.push({ kind, text: token })
    }
  }

  walkLcsDiff(oldTokens, newTokens, (kind, token) => push(kind, token))

  return segments
}
