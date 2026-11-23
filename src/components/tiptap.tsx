import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import Highlight from '@tiptap/extension-highlight'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { DiffLine } from '#/lib/diff'
import {
  restoreFrontmatterFromCodeFence,
  splitFrontmatter,
  withFrontmatterAsCodeFence,
} from '#/lib/frontmatter'
import { applyDiffHighlights, DiffHighlightDecorations, type DiffSide } from '#/lib/tiptap-diff'
import { cn } from 'cn'

export interface MarkdownEditorProps {
  content: string
  onChange?: (markdown: string) => void
  editable?: boolean
  diffLines?: DiffLine[]
  diffSide?: DiffSide
  className?: string
  placeholder?: string
}

export const Tiptap = ({
  content,
  onChange,
  editable = true,
  diffLines,
  diffSide = 'revised',
  className,
  placeholder,
}: MarkdownEditorProps) => {
  const [isEmpty, setIsEmpty] = useState(content.trim().length === 0)
  // The content last seen from the parent (gates re-parsing the document).
  const incomingRef = useRef<string | null>(null)
  // The markdown the editor itself last serialized (source of truth for onChange).
  const serializedRef = useRef<string | null>(null)
  const hadFrontmatterRef = useRef(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Stable extension identities so useEditor's option comparison passes on
  // re-renders instead of re-applying options (and a full view state update)
  // on every render.
  const extensions = useMemo(
    () => [StarterKit, Markdown, Highlight.configure({ multicolor: true }), DiffHighlightDecorations],
    [],
  )

  const editor = useEditor({
    extensions,
    contentType: 'markdown',
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      const raw = currentEditor.getMarkdown()
      const markdown =
        hadFrontmatterRef.current && raw.startsWith('```yaml')
          ? restoreFrontmatterFromCodeFence(raw)
          : raw
      // Only echo content back to the parent when the editor's serialized
      // markdown actually changed. Diff highlights are decorations, so
      // applying them never mutates the document and never reaches onUpdate.
      if (markdown === serializedRef.current) {
        return
      }
      serializedRef.current = markdown
      incomingRef.current = markdown
      onChangeRef.current?.(markdown)
    },
    onTransaction: ({ editor: currentEditor }) => {
      setIsEmpty(currentEditor.isEmpty)
    },
  })

  useEffect(() => {
    if (!editor) {
      return
    }
    editor.setEditable(editable)
  }, [editor, editable])

  // Sync external content changes, then (re)apply diff highlights. Only one
  // effect is used so highlights are always applied after the document is
  // up to date. After parsing, `serializedRef` records what the editor actually
  // serialized, so the round trip is never echoed back to the parent as new
  // content. Highlights are decorations (see DiffHighlightDecorations), so
  // applying them never mutates the document and cannot re-enter this effect
  // through `onChange`.
  useEffect(() => {
    if (!editor) {
      return
    }
    if (content !== incomingRef.current) {
      incomingRef.current = content
      hadFrontmatterRef.current = splitFrontmatter(content).frontmatter !== null
      editor.commands.setContent(withFrontmatterAsCodeFence(content), {
        contentType: 'markdown',
        emitUpdate: false,
      })
      const raw = editor.getMarkdown()
      serializedRef.current = hadFrontmatterRef.current ? restoreFrontmatterFromCodeFence(raw) : raw
    }
    applyDiffHighlights(editor, diffLines ?? [], diffSide)
  }, [editor, content, diffLines, diffSide])

  return (
    <div className={cn('relative min-h-full', className)}>
      <EditorContent editor={editor} />
      {placeholder && isEmpty ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 px-4 py-3 text-sm text-muted-foreground select-none">
          {placeholder}
        </div>
      ) : null}
    </div>
  )
}
