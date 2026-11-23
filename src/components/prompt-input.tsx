import { useEffect, useRef, useState } from 'react'
import { CornerDownLeft, Sparkles } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Spinner } from '#/components/ui/spinner'

export interface PromptInputProps {
  onSubmit: (prompt: string) => void | Promise<void>
  isLoading: boolean
  disabled?: boolean
  error?: string | null
}

export const PromptInput = ({ onSubmit, isLoading, disabled = false, error }: PromptInputProps) => {
  const [value, setValue] = useState('')
  // Detected after mount so SSR and the first client render agree.
  const [isMacLike, setIsMacLike] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const platform = `${navigator.platform} ${navigator.userAgent}`
    setIsMacLike(/Mac|iP(hone|ad|od)/.test(platform))
  }, [])

  const canSubmit = !disabled && !isLoading && value.trim().length > 0

  const submit = async () => {
    if (!canSubmit) {
      return
    }
    try {
      await onSubmit(value.trim())
      // Clear only on success so a failed generation keeps the prompt text.
      setValue('')
    } catch {
      // The parent surfaces the failure through the `error` prop.
    }
  }



  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={disabled || isLoading}
        placeholder="Describe changes to the skill…"
        rows={2}
        className="w-full resize-none rounded-t-xl bg-transparent px-3.5 pt-3 pb-1 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
      />
      <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2.5">
        <div className="ml-auto flex items-center gap-2.5">
          <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
            {isMacLike ? '⌘' : 'Ctrl+'}
            <CornerDownLeft className="size-3" />
            to submit
          </span>
          <Button size="sm" onClick={() => void submit()} disabled={!canSubmit}>
            {isLoading ? <Spinner /> : <Sparkles data-icon="inline-start" />}
            {isLoading ? 'Generating…' : 'Generate'}
          </Button>
        </div>
      </div>
      {error ? (
        <div className="border-t border-destructive/20 px-3.5 py-2 text-xs text-destructive" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  )
}
