import { Navigate, useRouterState } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'
import type { ReactNode } from 'react'
import { Spinner } from '#/components/ui/spinner'

/**
 * Gates content behind a signed-in session: a centered spinner while auth
 * state resolves, a bounce to the login page (preserving the attempted path)
 * when signed out, and the children once authenticated.
 */
export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    )
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" search={{ redirect: pathname }} replace />
  }
  return <>{children}</>
}
