import { useCallback, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { DiffWorkspace } from '#/components/diff-workspace'
import { computeDiff } from '#/lib/diff'
import { SAMPLE_REVISED_SKILL, SAMPLE_SKILL } from '#/lib/sample-skill'
import { promptDiff } from '#/lib/prompt.functions'

export const Route = createFileRoute('/')({ component: Home })

/**
 * Integration point for the real server/AI implementation.
 *
 * Receives the current skill markdown and the user's prompt, and returns the
 * full revised markdown. Swap the stub body for a call to your backend, e.g.:
 *
 *   const response = await fetch('/api/generate', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ originalMarkdown, prompt }),
 *   })
 *   return await response.text()
 */
export const handleGenerate = async (
  _originalMarkdown: string,
  _prompt: string,
): Promise<string> => {
  // Stub: no AI logic here — returns the static example revision so the diff
  // UI can be previewed. Replace this body with your implementation.
  await promptDiff({
    data: {
      markdown: _originalMarkdown,
      prompt: _prompt
    }
  })
  await new Promise((resolve) => setTimeout(resolve, 700))
  return SAMPLE_REVISED_SKILL
}

function Home() {
  // The example revision is pre-loaded so the diff is visible immediately.
  const [original, setOriginal] = useState(SAMPLE_SKILL)
  const [revised, setRevised] = useState<string | null>(SAMPLE_REVISED_SKILL)
  const [isGenerating, setIsGenerating] = useState(false)
  const [promptError, setPromptError] = useState<string | null>(null)

  const diff = useMemo(
    () => (revised === null ? null : computeDiff(original, revised)),
    [original, revised],
  )

  const handleSubmitPrompt = useCallback(
    async (prompt: string) => {
      setIsGenerating(true)
      setPromptError(null)
      try {
        const revisedMarkdown = await handleGenerate(original, prompt)
        setRevised(revisedMarkdown)
      } catch (error) {
        setPromptError(
          error instanceof Error ? error.message : 'Failed to generate a revision. Try again.',
        )
        // Rethrow so PromptInput keeps the prompt text for editing.
        throw error
      } finally {
        setIsGenerating(false)
      }
    },
    [original],
  )

  const handleLoadSample = useCallback(() => {
    setOriginal("")
    setRevised(null)
    setPromptError(null)
  }, [])

  const handleUseAsOriginal = useCallback(() => {
    if (revised === null) {
      return
    }
    setOriginal(revised)
    setRevised(null)
    setPromptError(null)
  }, [revised])

  return (
    <DiffWorkspace
      original={original}
      onOriginalChange={setOriginal}
      revised={revised}
      diff={diff}
      isGenerating={isGenerating}
      promptError={promptError}
      onSubmitPrompt={handleSubmitPrompt}
      onLoadSample={handleLoadSample}
      onUseAsOriginal={handleUseAsOriginal}
    />
  )
}
