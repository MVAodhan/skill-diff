import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ChevronsDownUp, ChevronsUpDown, FileText, Play } from 'lucide-react'
import { NavBar } from '#/components/nav-bar'
import { Button } from '#/components/ui/button'
import { Collapsible, CollapsibleContent } from '#/components/ui/collapsible'
import { ScrollArea } from '#/components/ui/scroll-area'
import {
  computeDiff,
  diffTokens,
  type DiffKind,
  type DiffLine,
  type DiffResult,
} from '#/lib/diff'

export const Route = createFileRoute('/compare')({ component: ComparePage })

type CompareOutcome =
  | { status: 'ok'; diff: DiffResult }
  | { status: 'error'; side: 'original' | 'revised'; message: string }

interface DiffRowModel {
  line: DiffLine
  /** Per-token kinds when the line is word-diffed against its counterpart. */
  tokenKinds: DiffKind[] | null
}

const SAMPLE_ORIGINAL = `{
  "name": "pdf-document-reader",
  "version": "1.2.0",
  "options": {
    "maxPages": 50,
    "ocr": false
  },
  "tags": ["pdf", "extract"],
  "authors": ["Ada", "Grace"]
}`

const SAMPLE_REVISED = `{
  "name": "pdf-document-reader",
  "version": "1.3.0",
  "options": {
    "maxPages": 100,
    "ocr": false,
    "password": null
  },
  "tags": ["pdf", "extract", "tables"],
  "authors": ["Ada", "Grace", "Alan"]
}`

/**
 * Parses JSON the way config files are actually written (JSONC): line and
 * block comments and trailing commas are allowed. Comments and trailing
 * commas are stripped in a single scan that tracks string state, so comments
 * or commas inside string values are preserved. Structural mistakes still
 * fail — this only relaxes syntax, not shape.
 */
const parseLenientJson = (text: string): unknown => {
  let out = ''
  let i = 0
  let inString = false
  while (i < text.length) {
    const char = text[i]
    if (inString) {
      out += char
      if (char === '\\' && i + 1 < text.length) {
        out += text[i + 1]
        i += 2
        continue
      }
      if (char === '"') {
        inString = false
      }
      i++
      continue
    }
    if (char === '"') {
      inString = true
      out += char
      i++
      continue
    }
    if (char === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') {
        i++
      }
      continue
    }
    if (char === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2)
      i = end === -1 ? text.length : end + 2
      continue
    }
    if (char === ',') {
      let j = i + 1
      while (j < text.length && /\s/.test(text[j])) {
        j++
      }
      if (text[j] === '}' || text[j] === ']') {
        i++
        continue
      }
    }
    out += char
    i++
  }
  return JSON.parse(out)
}

const tryPrettyPrint = (
  text: string,
): { ok: true; value: string } | { ok: false; message: string } => {
  if (text.trim() === '') {
    return { ok: false, message: 'This side is empty — paste JSON to compare.' }
  }
  try {
    // Pretty-printing both sides makes the diff independent of the pasted
    // formatting: `{"a":1}` and `{ "a": 1 }` compare as identical.
    return { ok: true, value: JSON.stringify(parseLenientJson(text), null, 2) }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Invalid JSON.' }
  }
}

/**
 * Pairs adjacent removed/added runs and computes per-token diff kinds for each
 * pair, so modified lines can be highlighted word-by-word (same pairing rule
 * as the skill diff's word highlighting, minus the Markdown fence handling).
 */
const buildRows = (lines: DiffLine[]): DiffRowModel[] => {
  const rows: DiffRowModel[] = lines.map((line) => ({ line, tokenKinds: null }))
  let i = 0
  while (i < lines.length) {
    const kind = lines[i].kind
    if (kind === 'unchanged') {
      i++
      continue
    }
    let end = i
    while (end < lines.length && lines[end].kind === kind) {
      end++
    }
    const opposite: DiffKind = kind === 'removed' ? 'added' : 'removed'
    if (end < lines.length && lines[end].kind === opposite) {
      let oppositeEnd = end
      while (oppositeEnd < lines.length && lines[oppositeEnd].kind === opposite) {
        oppositeEnd++
      }
      const pairCount = Math.min(end - i, oppositeEnd - end)
      for (let k = 0; k < pairCount; k++) {
        const tokens = diffTokens(lines[i + k].text, lines[end + k].text)
        rows[i + k].tokenKinds = tokens.old
        rows[end + k].tokenKinds = tokens.new
      }
      i = oppositeEnd
      continue
    }
    i = end
  }
  return rows
}

/**
 * Renders a line as its exact original text, wrapping each token whose diff
 * kind matches the row's kind in a highlight span. Whitespace runs stay plain.
 */
const renderLineText = (
  text: string,
  tokenKinds: DiffKind[] | null,
  highlightKind: DiffKind,
): ReactNode[] => {
  const parts: ReactNode[] = []
  let lastIndex = 0
  let tokenIndex = 0
  for (const match of text.matchAll(/\S+/g)) {
    const start = match.index ?? 0
    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start))
    }
    if (
      highlightKind !== 'unchanged' &&
      (tokenKinds?.[tokenIndex] ?? 'unchanged') === highlightKind
    ) {
      parts.push(
        <span
          key={tokenIndex}
          className={
            highlightKind === 'added'
              ? 'rounded bg-(--diff-added-bg) px-0.5'
              : 'rounded bg-(--diff-removed-bg) px-0.5'
          }
        >
          {match[0]}
        </span>,
      )
    } else {
      parts.push(match[0])
    }
    lastIndex = start + match[0].length
    tokenIndex++
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts
}

interface JsonInputProps {
  title: string
  value: string
  onChange: (value: string) => void
  error: string | null
  collapsed: boolean
}

const JsonInput = ({ title, value, onChange, error, collapsed }: JsonInputProps) => (
  <Collapsible
    open={!collapsed}
    className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card"
  >
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3.5 py-2">
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
      <button
        type="button"
        onClick={() => onChange('')}
        disabled={value === ''}
        className="text-xs text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        Clear
      </button>
    </header>
    <CollapsibleContent>
      <ScrollArea className="h-[30vh]">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          rows={Math.max(8, value.split('\n').length)}
          placeholder={'{\n  "paste": "JSON here"\n}'}
          className="block w-full resize-none bg-transparent p-3 font-mono text-sm outline-none placeholder:text-muted-foreground"
        />
      </ScrollArea>
      {error ? (
        <div className="border-t border-destructive/20 px-3.5 py-2 text-xs text-destructive" role="alert">
          {error}
        </div>
      ) : null}
    </CollapsibleContent>
  </Collapsible>
)

const DiffSummaryPill = ({ diff }: { diff: DiffResult }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium tabular-nums">
    <span className="text-(--diff-added-fg)">+{diff.summary.added}</span>
    <span className="text-(--diff-removed-fg)">-{diff.summary.removed}</span>
    <span className="text-muted-foreground">lines</span>
  </span>
)

const DiffRowView = ({ row }: { row: DiffRowModel }) => {
  const { line, tokenKinds } = row
  const rowTint =
    line.kind === 'added'
      ? 'bg-(--diff-added-bg)/40'
      : line.kind === 'removed'
        ? 'bg-(--diff-removed-bg)/40'
        : ''
  return (
    <div className={`flex ${rowTint}`}>
      <span className="w-10 shrink-0 select-none pr-2 text-right text-muted-foreground/60 tabular-nums">
        {line.oldLineNumber ?? ''}
      </span>
      <span className="w-10 shrink-0 select-none pr-2 text-right text-muted-foreground/60 tabular-nums">
        {line.newLineNumber ?? ''}
      </span>
      <span
        className={`w-4 shrink-0 select-none ${line.kind === 'added'
          ? 'text-(--diff-added-fg)'
          : line.kind === 'removed'
            ? 'text-(--diff-removed-fg)'
            : 'text-transparent'
          }`}
      >
        {line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : ' '}
      </span>
      <span className="whitespace-pre pr-4">{renderLineText(line.text, tokenKinds, line.kind)}</span>
    </div>
  )
}

const DiffView = ({ diff, className }: { diff: DiffResult; className?: string }) => {
  const rows = useMemo(() => buildRows(diff.lines), [diff])
  const identical = diff.summary.added === 0 && diff.summary.removed === 0
  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card ${className ?? ''}`}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3.5 py-2">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Diff</h2>
        <div className="flex items-center gap-2">
          {identical ? (
            <span className="text-xs text-muted-foreground">Identical</span>
          ) : (
            <DiffSummaryPill diff={diff} />
          )}
        </div>
      </header>
      {identical ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          The two JSON values are identical.
        </p>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div className="w-fit min-w-full py-2 font-mono text-[0.8rem] leading-relaxed">
            {rows.map((row, index) => (
              <DiffRowView key={index} row={row} />
            ))}
          </div>
        </ScrollArea>
      )}
    </section>
  )
}

function ComparePage() {
  const [originalText, setOriginalText] = useState('')
  const [revisedText, setRevisedText] = useState('')
  const [outcome, setOutcome] = useState<CompareOutcome | null>(null)
  const [inputsCollapsed, setInputsCollapsed] = useState(false)

  const handleCompare = useCallback(() => {
    const originalCheck = tryPrettyPrint(originalText)
    if (!originalCheck.ok) {
      setInputsCollapsed(false)
      setOutcome({ status: 'error', side: 'original', message: originalCheck.message })
      return
    }
    const revisedCheck = tryPrettyPrint(revisedText)
    if (!revisedCheck.ok) {
      setInputsCollapsed(false)
      setOutcome({ status: 'error', side: 'revised', message: revisedCheck.message })
      return
    }
    setOutcome({ status: 'ok', diff: computeDiff(originalCheck.value, revisedCheck.value) })
  }, [originalText, revisedText])

  // Editing an input invalidates the shown diff so a stale result can't mislead.
  const updateOriginal = useCallback((value: string) => {
    setOriginalText(value)
    setOutcome(null)
  }, [])
  const updateRevised = useCallback((value: string) => {
    setRevisedText(value)
    setOutcome(null)
  }, [])

  const canCompare = originalText.trim() !== '' || revisedText.trim() !== ''
  const originalError =
    outcome?.status === 'error' && outcome.side === 'original' ? outcome.message : null
  const revisedError =
    outcome?.status === 'error' && outcome.side === 'revised' ? outcome.message : null

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <NavBar />

      <div className="shrink-0 px-4 pt-4">
        <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-sm">
          <p className="text-xs text-muted-foreground">
            Paste JSON on both sides, then compare — formatting differences are ignored.
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInputsCollapsed((collapsed) => !collapsed)}
            >
              {inputsCollapsed ? (
                <ChevronsUpDown data-icon="inline-start" />
              ) : (
                <ChevronsDownUp data-icon="inline-start" />
              )}
              {inputsCollapsed ? 'Show inputs' : 'Hide inputs'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                updateOriginal(SAMPLE_ORIGINAL)
                updateRevised(SAMPLE_REVISED)
              }}
            >
              <FileText data-icon="inline-start" />
              Load example
            </Button>
            <Button size="sm" onClick={handleCompare} disabled={!canCompare}>
              <Play data-icon="inline-start" />
              Compare
            </Button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <div className="grid shrink-0 items-start gap-4 lg:grid-cols-2">
          <JsonInput
            title="Original JSON"
            value={originalText}
            onChange={updateOriginal}
            error={originalError}
            collapsed={inputsCollapsed}
          />
          <JsonInput
            title="Revised JSON"
            value={revisedText}
            onChange={updateRevised}
            error={revisedError}
            collapsed={inputsCollapsed}
          />
        </div>
        {outcome?.status === 'ok' ? (
          <DiffView diff={outcome.diff} className="min-h-0 flex-1" />
        ) : null}
      </div>
    </div >
  )
}
