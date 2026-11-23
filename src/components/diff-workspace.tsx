import { ArrowLeftToLine, FileDiff, FileText, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { ModeToggle } from '#/components/mode-toggle'
import { PromptInput } from '#/components/prompt-input'
import { Tiptap } from '#/components/tiptap'
import { Button } from '#/components/ui/button'
import { ScrollArea } from '#/components/ui/scroll-area'
import type { DiffResult } from '#/lib/diff'

export interface DiffWorkspaceProps {
  original: string
  onOriginalChange: (markdown: string) => void
  revised: string | null
  diff: DiffResult | null
  isGenerating: boolean
  promptError: string | null
  onSubmitPrompt: (prompt: string) => Promise<void>
  onLoadSample: () => void
  onUseAsOriginal: () => void
}

interface EditorPaneProps {
  title: string
  badge?: ReactNode
  action?: ReactNode
  children: ReactNode
}

const EditorPane = ({ title, badge, action, children }: EditorPaneProps) => (
  <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3.5 py-2">
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
      <div className="flex items-center gap-2">
        {action}
        {badge}
      </div>
    </header>
    <ScrollArea className="min-h-0 flex-1">{children}</ScrollArea>
  </section>
)

const DiffSummaryPill = ({ diff }: { diff: DiffResult }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium tabular-nums">
    <span className="text-(--diff-added-fg)">+{diff.summary.added}</span>
    <span className="text-(--diff-removed-fg)">-{diff.summary.removed}</span>
    <span className="text-muted-foreground">lines</span>
  </span>
)

const RevisedEmptyState = () => (
  <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
    <div className="flex size-10 items-center justify-center rounded-full bg-muted">
      <Sparkles className="size-4.5 text-muted-foreground" />
    </div>
    <p className="max-w-64 text-sm text-muted-foreground">
      Submit a prompt above to generate a new version of this skill
    </p>
  </div>
)

export const DiffWorkspace = ({
  original,
  onOriginalChange,
  revised,
  diff,
  isGenerating,
  promptError,
  onSubmitPrompt,
  onLoadSample,
  onUseAsOriginal,
}: DiffWorkspaceProps) => {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-4 py-2.5">
        <div className="flex items-center gap-2">
          <FileDiff className="size-4 text-muted-foreground" />
          <h1 className="text-sm font-semibold tracking-tight">Skill Diff</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <ModeToggle />
          <Button variant="outline" size="sm" onClick={onLoadSample}>
            <FileText data-icon="inline-start" />
            Load sample skill
          </Button>
        </div>
      </header>

      <div className="shrink-0 px-4 pt-4">
        <PromptInput onSubmit={onSubmitPrompt} isLoading={isGenerating} error={promptError} />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-4 p-4 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)]">
        <EditorPane title="Original Skill">
          <Tiptap
            content={original}
            onChange={onOriginalChange}
            diffLines={diff?.lines}
            diffSide="original"
            className="px-4 py-3"
            placeholder="Write or paste your skill Markdown here…"
          />
        </EditorPane>

        <EditorPane
          title="New Version — Diff"
          badge={diff ? <DiffSummaryPill diff={diff} /> : null}
          action={
            revised === null ? undefined : (
              <Button
                variant="outline"
                size="sm"
                onClick={onUseAsOriginal}
                disabled={isGenerating}
              >
                <ArrowLeftToLine data-icon="inline-start" />
                Use as original
              </Button>
            )
          }
        >
          {revised === null ? (
            <RevisedEmptyState />
          ) : (
            <Tiptap
              content={revised}
              editable={false}
              diffLines={diff?.lines}
              diffSide="revised"
              className="px-4 py-3"
            />
          )}
        </EditorPane>
      </div>
    </div>
  )
}
