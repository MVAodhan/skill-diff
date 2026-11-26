import { Link } from '@tanstack/react-router'
import { FileDiff } from 'lucide-react'
import type { ReactNode } from 'react'
import { ModeToggle } from '#/components/mode-toggle'

export interface AuthLayoutProps {
  title: string
  description: string
  children: ReactNode
}

/**
 * Shared shell for the auth pages: the app header, a centered card with a
 * titled header section, and the form slot below it.
 */
export const AuthLayout = ({ title, description, children }: AuthLayoutProps) => (
  <div className="flex h-dvh flex-col overflow-hidden bg-background">
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-4 py-2.5">
      <Link to="/" className="flex items-center gap-2">
        <FileDiff className="size-4 text-muted-foreground" />
        <h1 className="text-sm font-semibold tracking-tight">Skill Diff</h1>
      </Link>
      <ModeToggle />
    </header>

    <main className="flex flex-1 items-center justify-center overflow-y-auto p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>
    </main>
  </div>
)
