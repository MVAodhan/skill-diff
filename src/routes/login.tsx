import { createFileRoute, Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useSignInWithUsernamePassword } from "@convex-dev/auth/methods/username-password/react";
import { LogIn as LogInIcon } from 'lucide-react'
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { AuthLayout } from '#/components/auth-layout'
import { safeRedirectPath } from '#/lib/redirect'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'

export const Route = createFileRoute('/login')({
  component: LogIn,
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
})

function LogIn() {
  const { signIn, pending } = useSignInWithUsernamePassword(api.auth);
  const navigate = useNavigate()
  const { redirect } = useSearch({ from: Route.id })
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <AuthLayout title="Log in" description="Sign in to continue to Skill Diff.">
      <form
        className="flex flex-col gap-4 px-5 py-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          const result = await signIn({ username, password });
          if (result.status === "complete") {
            await navigate({ to: safeRedirectPath(redirect) });
            return;
          }
          setError(() => {
            switch (result.userError.error) {
              case "USER_NOT_FOUND":
                return "No account exists with that username.";
              case "INVALID_CREDENTIALS":
                return "Incorrect username or password.";
              case "PASSWORD_TOO_SHORT":
                return `Password must be at least ${result.userError.minimumLength} characters.`;
              case "PASSWORD_TOO_LONG":
                return `Password must be at most ${result.userError.maximumLength} characters.`;
              case "PASSWORD_HAS_SURROUNDING_WHITESPACE":
                return "Password can't start or end with whitespace.";
              case "RATE_LIMITED":
                return `Too many attempts. Try again in ${Math.ceil(result.userError.retryAfterMs / 1000)} seconds.`;
              case "OTHER_ERROR":
                // The mutation threw unexpectedly; the original error is
                // available on `cause` if you want to log or inspect it.
                console.error("Sign-in failed:", result.userError.cause);
                return "Something went wrong. Please try again.";
              default:
                result.userError satisfies never;
                console.error("Sign-in failed:", result.userError);
                return "Something went wrong. Please try again.";
            }
          });
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="username" className="text-sm font-medium">
            Username
          </label>
          <Input
            // Using a static id to help password managers behave correctly
            id="username"
            name="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            disabled={pending}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <Input
            // Using a static id to help password managers behave correctly
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            disabled={pending}
          />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? <Spinner /> : <LogInIcon data-icon="inline-start" />}
          {pending ? "Logging in…" : "Log in"}
        </Button>
      </form>
      {error ? (
        <div
          className="border-t border-destructive/20 px-5 py-2 text-xs text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      <div className="border-t border-border px-5 py-3 text-center text-xs text-muted-foreground">
        Don't have an account?{' '}
        <Link
          to="/signUp"
          search={{ redirect }}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign up
        </Link>
      </div>
    </AuthLayout>
  );
}
