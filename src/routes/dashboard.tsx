import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { FileDiff, Plus } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { Doc } from '../../convex/_generated/dataModel'
import { AppSidebar } from '#/components/app-sidebar'
import { RequireAuth } from '#/components/require-auth'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '#/components/ui/sidebar'
import { Skeleton } from '#/components/ui/skeleton'
import { Spinner } from '#/components/ui/spinner'

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <RequireAuth>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
            <SidebarTrigger />
            <h1 className="text-sm font-semibold tracking-tight">Dashboard</h1>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto p-4">
            <SkillsPanel />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </RequireAuth>
  )
}

const formatDate = (time: number) =>
  new Date(time).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

/** First non-empty line of the working copy, as a card preview. */
const previewLine = (content: string): string => {
  const line = content.split('\n').find((candidate) => candidate.trim() !== '')
  return line === undefined ? 'Empty — open it to start writing.' : line.trim()
}

function SkillsPanel() {
  const skills = useQuery(api.skills.list)
  const [creating, setCreating] = useState(false)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">Your skills</h2>
          <p className="text-xs text-muted-foreground">
            Each skill keeps its own working copy and revision history.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus data-icon="inline-start" />
          New skill
        </Button>
      </div>

      {skills === undefined ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((index) => (
            <Skeleton key={index} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : skills.length === 0 ? (
        <Card className="items-center py-10 text-center">
          <p className="text-sm font-medium">No skills yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Create your first skill, then refine it with prompts and review every change as a
            diff.
          </p>
          <Button size="sm" className="mt-4" onClick={() => setCreating(true)}>
            <Plus data-icon="inline-start" />
            New skill
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {skills.map((skill) => (
            <SkillCard key={skill._id} skill={skill} />
          ))}
        </div>
      )}

      <NewSkillDialog open={creating} onOpenChange={setCreating} />
    </div>
  )
}

const SkillCard = ({ skill }: { skill: Doc<'skills'> }) => (
  <Card>
    <CardHeader>
      <CardTitle className="truncate">{skill.name}</CardTitle>
      <CardDescription className="line-clamp-2">{previewLine(skill.content)}</CardDescription>
    </CardHeader>
    <CardFooter>
      <span className="text-xs text-muted-foreground tabular-nums">
        Created {formatDate(skill._creationTime)}
      </span>
      <Link
        to="/skills/$skillId"
        params={{ skillId: skill._id }}
        className="inline-flex"
      >
        <Button variant="outline" size="sm">
          <FileDiff data-icon="inline-start" />
          Open
        </Button>
      </Link>
    </CardFooter>
  </Card>
)

const NewSkillDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) => {
  const create = useMutation(api.skills.create)
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setName('')
      setError(null)
    }
    onOpenChange(next)
  }

  const handleCreate = async () => {
    const trimmed = name.trim()
    if (trimmed === '' || pending) {
      return
    }
    setPending(true)
    setError(null)
    try {
      const skillId = await create({ name: trimmed })
      onOpenChange(false)
      await navigate({ to: '/skills/$skillId', params: { skillId } })
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message.length > 0
          ? cause.message
          : 'Could not create the skill. Try again.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new skill</DialogTitle>
          <DialogDescription>
            Name it now — you'll land in the diff workspace to write or paste its content.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void handleCreate()
          }}
        >
          <Input
            autoFocus
            placeholder="e.g. PDF document reader"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            aria-label="Skill name"
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending || name.trim() === ''}>
              {pending ? <Spinner /> : <Plus data-icon="inline-start" />}
              Create skill
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
