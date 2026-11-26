import { Link, createFileRoute } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'
import { ArrowRight, Braces, FileDiff, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { NavBar } from '#/components/nav-bar'
import { buttonVariants } from '#/components/ui/button'

export const Route = createFileRoute('/')({ component: Landing })

const FEATURES: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Sparkles,
    title: 'Prompt-driven edits',
    description: 'Describe the change you want in plain language and get a full revision.',
  },
  {
    icon: FileDiff,
    title: 'Line & word diffs',
    description: 'Every added and removed line highlighted, down to individual words.',
  },
  {
    icon: Braces,
    title: 'JSON compare',
    description: 'Diff two JSON values while ignoring formatting differences.',
  },
]

const FeatureCard = ({ icon: Icon, title, description }: (typeof FEATURES)[number]) => (
  <div className="rounded-xl border border-border bg-card p-4 text-left">
    <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
      <Icon className="size-4 text-muted-foreground" />
    </div>
    <h3 className="mt-3 text-sm font-medium">{title}</h3>
    <p className="mt-1 text-xs text-muted-foreground">{description}</p>
  </div>
)

function Landing() {
  const { isLoading, isAuthenticated } = useConvexAuth()

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <NavBar />
      <main className="flex flex-1 items-center justify-center overflow-y-auto p-4">
        <div className="flex w-full max-w-2xl flex-col items-center gap-8 py-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
            <FileDiff className="size-6 text-muted-foreground" />
          </div>
          <div className="flex flex-col items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-balance">
              Refine skills, see exactly what changed
            </h1>
            <p className="max-w-lg text-pretty text-sm text-muted-foreground sm:text-base">
              Skill Diff turns a plain-language prompt into a revised agent skill, then shows
              you the diff — so every edit is reviewable before you keep it.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isLoading ? null : isAuthenticated ? (
              <Link to="/dashboard" className={buttonVariants({ size: 'lg' })}>
                Open dashboard
                <ArrowRight data-icon="inline-end" />
              </Link>
            ) : (
              <>
                <Link to="/signUp" className={buttonVariants({ size: 'lg' })}>
                  Get started
                </Link>
                <Link to="/login" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
                  Sign in
                </Link>
              </>
            )}
          </div>
          <div className="grid w-full gap-4 sm:grid-cols-3">
            {FEATURES.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
