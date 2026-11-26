import { useAuthActions } from '@convex-dev/auth/react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useConvexAuth, useQuery } from 'convex/react'
import { FileDiff, LogIn, LogOut, UserPlus } from 'lucide-react'
import type { ReactNode } from 'react'
import { api } from '../../convex/_generated/api'
import { ModeToggle } from '#/components/mode-toggle'
import { Button, buttonVariants } from '#/components/ui/button'

const NAV_LINKS = [
  { to: '/compare', label: 'JSON compare' },
] as const

/** The signed-in user's name and remaining credits; nothing while unknown. */
const CurrentUser = () => {
  const user = useQuery(api.users.getCurrentUser)
  if (!user) {
    return null
  }
  return (
    <div className="flex items-center gap-2 pr-1">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium uppercase">
        {user.username?.slice(0, 1)}
      </span>
      <span className="hidden text-sm text-muted-foreground sm:inline">{user.username}</span>
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
        {user.credits} {user.credits === 1 ? "credit" : "credits"}
      </span>
    </div>
  )
}

export interface NavBarProps {
  /** Page-specific actions rendered before the auth buttons. */
  actions?: ReactNode
}

export const NavBar = ({ actions }: NavBarProps) => {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const { signOut } = useAuthActions()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  // The dashboard requires auth, so it's only linked for signed-in users.
  const navLinks = isAuthenticated
    ? [{ to: '/dashboard' as const, label: 'Dashboard' }, ...NAV_LINKS]
    : NAV_LINKS

  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-4 py-2.5">
      <div className="flex items-center gap-2">
        <Link to="/" className="flex items-center gap-2">
          <FileDiff className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold tracking-tight">Skill Diff</span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.to || pathname.startsWith(`${link.to}/`)
            return (
              <Link
                key={link.to}
                to={link.to}
                aria-current={isActive ? 'page' : undefined}
                className={buttonVariants({
                  variant: isActive ? 'secondary' : 'ghost',
                  size: 'sm',
                })}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>
      </div>
      <div className="flex items-center gap-1.5">
        {actions}
        {isLoading ? null : isAuthenticated ? (
          <>
            <CurrentUser />
            {/* Leave the gated page before the session clears so the auth
                gate doesn't bounce to the login page mid-sign-out. */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigate({ to: '/' })
                void signOut()
              }}
            >
              <LogOut data-icon="inline-start" />
              Sign out
            </Button>
          </>
        ) : (
          <>
            <Link to="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              <LogIn data-icon="inline-start" />
              Sign in
            </Link>
            <Link to="/signUp" className={buttonVariants({ variant: 'default', size: 'sm' })}>
              <UserPlus data-icon="inline-start" />
              Sign up
            </Link>
          </>
        )}
        <ModeToggle />
      </div>
    </header>
  )
}
