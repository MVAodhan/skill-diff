import { useAuthActions } from '@convex-dev/auth/react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { FileDiff, LogOut, Pencil } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { Doc, Id } from '../../convex/_generated/dataModel'
import { ModeToggle } from '#/components/mode-toggle'
import { Button } from '#/components/ui/button'
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
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '#/components/ui/sidebar'

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/compare', label: 'JSON compare' },
] as const

export interface AppSidebarProps {
  /** When set, the sidebar lists that skill's revisions below the nav. */
  skillId?: Id<'skills'>
}

export const AppSidebar = ({ skillId }: AppSidebarProps) => {
  const { signOut } = useAuthActions()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const search = useRouterState({
    select: (state) => state.location.search,
  }) as { revision?: string }
  const user = useQuery(api.users.getCurrentUser)

  return (
    <Sidebar>
      <SidebarHeader className="p-3">
        <Link to="/" className="flex items-center gap-2 px-2 py-1">
          <FileDiff className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold tracking-tight">Skill Diff</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_LINKS.map((link) => {
                const isActive = pathname === link.to || pathname.startsWith(`${link.to}/`)
                return (
                  <SidebarMenuItem key={link.to}>
                    <SidebarMenuButton render={<Link to={link.to} />} isActive={isActive}>
                      {link.label}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {skillId ? (
          <RevisionsGroup skillId={skillId} activeRevisionId={search.revision} />
        ) : null}
      </SidebarContent>
      <SidebarFooter className="gap-1 p-3">
        {user ? (
          <div className="flex items-center gap-2 px-2 py-1">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium uppercase">
              {user.username?.slice(0, 1)}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{user.username}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {user.credits} {user.credits === 1 ? 'credit' : 'credits'}
              </span>
            </div>
            <ModeToggle />
          </div>
        ) : null}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                void navigate({ to: '/' })
                void signOut()
              }}
            >
              <LogOut />
              Sign out
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

const RevisionsGroup = ({
  skillId,
  activeRevisionId,
}: {
  skillId: Id<'skills'>
  activeRevisionId?: string
}) => {
  const revisions = useQuery(api.revisions.listForSkill, { skillId })

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Revisions</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {revisions === undefined ? null : revisions.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">No revisions yet</p>
          ) : (
            revisions.map((revision) => (
              <RevisionMenuItem
                key={revision._id}
                revision={revision}
                skillId={skillId}
                active={activeRevisionId === revision._id}
              />
            ))
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

const RevisionMenuItem = ({
  revision,
  skillId,
  active,
}: {
  revision: Doc<'revisions'>
  skillId: Id<'skills'>
  active: boolean
}) => {
  const rename = useMutation(api.revisions.rename)
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState('')

  const save = async () => {
    await rename({ id: revision._id, name: draft.trim() })
    setRenaming(false)
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={
          <Link
            to="/skills/$skillId"
            params={{ skillId }}
            search={{ revision: revision._id }}
          />
        }
        isActive={active}
      >
        <span className="truncate">{revision.name ?? revision.prompt}</span>
      </SidebarMenuButton>
      <SidebarMenuAction
        aria-label="Rename revision"
        onClick={() => {
          setDraft(revision.name ?? '')
          setRenaming(true)
        }}
      >
        <Pencil />
      </SidebarMenuAction>
      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Name revision</DialogTitle>
            <DialogDescription>A short label to recognize it by in the list.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={draft}
            maxLength={80}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void save()
              }
            }}
          />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setRenaming(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void save()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarMenuItem>
  )
}
