import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute, Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import { DiffWorkspace } from '#/components/diff-workspace'
import { AppSidebar } from '#/components/app-sidebar'
import { RequireAuth } from '#/components/require-auth'
import { computeDiff } from '#/lib/diff'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '#/components/ui/sidebar'
import { Spinner } from '#/components/ui/spinner'

export const Route = createFileRoute('/skills/$skillId')({
  component: SkillPage,
  validateSearch: (search: Record<string, unknown>): { revision?: string } => ({
    revision: typeof search.revision === 'string' ? search.revision : undefined,
  }),
})

function SkillPage() {
  const { skillId } = Route.useParams()
  return (
    <RequireAuth>
      <SkillWorkspace skillId={skillId as Id<'skills'>} />
    </RequireAuth>
  )
}

/** ConvexError payloads carry the user-facing message; prefer them. */
const errorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    const data = (error as { data?: unknown }).data
    if (typeof data === 'string' && data.length > 0) {
      return data
    }
    return error.message
  }
  return 'Failed to generate a revision. Try again.'
}

function SkillWorkspace({ skillId }: { skillId: Id<'skills'> }) {
  const skill = useQuery(api.skills.get, { id: skillId })
  const generateDiff = useAction(api.ai.generateDiff)
  const updateContent = useMutation(api.skills.updateContent)
  const navigate = useNavigate()
  const { revision: revisionId } = useSearch({ from: Route.id })
  // Search params arrive as plain strings; a malformed value fails the
  // query's id validator and surfaces through the route error boundary.
  const revision = useQuery(
    api.revisions.get,
    revisionId ? { id: revisionId as Id<'revisions'> } : 'skip',
  )

  // null until the skill's working copy has been hydrated into local state.
  const [original, setOriginal] = useState<string | null>(null)
  const [revised, setRevised] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [promptError, setPromptError] = useState<string | null>(null)
  const appliedRevision = useRef<Id<'revisions'> | null>(null)
  const lastSaved = useRef<string | null>(null)

  // Hydrate the working copy once, when the skill first loads.
  useEffect(() => {
    if (skill && original === null) {
      lastSaved.current = skill.content
      setOriginal(skill.content)
    }
  }, [skill, original])

  // Load a specific revision when requested (from the sidebar list).
  useEffect(() => {
    if (!revision || appliedRevision.current === revision._id) {
      return
    }
    appliedRevision.current = revision._id
    lastSaved.current = revision.original
    setOriginal(revision.original)
    setRevised(revision.revised)
    void navigate({ to: '/skills/$skillId', params: { skillId }, search: {}, replace: true })
  }, [revision, navigate, skillId])

  // Auto-save the working copy shortly after edits settle.
  useEffect(() => {
    if (original === null || original === lastSaved.current) {
      return
    }
    const timer = setTimeout(() => {
      lastSaved.current = original
      void updateContent({ id: skillId, content: original })
    }, 800)
    return () => clearTimeout(timer)
  }, [original, skillId, updateContent])

  const diff = useMemo(
    () => (revised === null || original === null ? null : computeDiff(original, revised)),
    [original, revised],
  )

  const handleSubmitPrompt = useCallback(
    async (prompt: string) => {
      if (original === null) {
        return
      }
      setIsGenerating(true)
      setPromptError(null)
      try {
        const revisedMarkdown = await generateDiff({ skillId, markdown: original, prompt })
        setRevised(revisedMarkdown)
      } catch (error) {
        setPromptError(errorMessage(error))
        // Rethrow so PromptInput keeps the prompt text for editing.
        throw error
      } finally {
        setIsGenerating(false)
      }
    },
    [generateDiff, skillId, original],
  )

  const handleUseAsOriginal = useCallback(() => {
    if (revised === null) {
      return
    }
    lastSaved.current = revised
    void updateContent({ id: skillId, content: revised })
    setOriginal(revised)
    setRevised(null)
    setPromptError(null)
  }, [revised, skillId, updateContent])

  if (skill === undefined || original === null) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    )
  }

  if (skill === null) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background p-4">
        <Card className="max-w-sm text-center">
          <CardHeader>
            <CardTitle>Skill not found</CardTitle>
          </CardHeader>
          <CardContent>
            <Button render={<Link to="/dashboard" />} size="sm" variant="outline">
              Back to dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar skillId={skillId} />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger />
          <h1 className="truncate text-sm font-semibold tracking-tight">{skill.name}</h1>
        </header>
        <div className="min-h-0 flex-1">
          <DiffWorkspace
            original={original}
            onOriginalChange={setOriginal}
            revised={revised}
            diff={diff}
            isGenerating={isGenerating}
            promptError={promptError}
            onSubmitPrompt={handleSubmitPrompt}
            onUseAsOriginal={handleUseAsOriginal}
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
