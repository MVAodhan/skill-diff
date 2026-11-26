import { useSignUpWithUsernamePassword } from "@convex-dev/auth/methods/username-password/react";
import { DEFAULT_MIN_PASSWORD_LENGTH } from "@convex-dev/auth/methods/username-password";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { UserPlus } from 'lucide-react'
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { AuthLayout } from '#/components/auth-layout'
import { safeRedirectPath } from '#/lib/redirect'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'

export const Route = createFileRoute('/signUp')({
  component: SignUp,
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
})

function SignUp() {
  const { signUp, pending } = useSignUpWithUsernamePassword(api.auth);
  const navigate = useNavigate()
  const { redirect } = useSearch({ from: Route.id })
  const syncUsername = useMutation(api.users.syncUsername)
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <AuthLayout title="Sign up" description="Create an account to get started.">
      <form
        className="flex flex-col gap-4 px-5 py-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          const result = await signUp({ username, password });
          if (result.status === "complete") {
            // Best-effort: the username also syncs on the next sign-in.
            await syncUsername().catch(() => undefined);
            await navigate({ to: safeRedirectPath(redirect) });
            return;
          }
          setError(() => {
            switch (result.userError.error) {
              case "USERNAME_TAKEN":
                return "That username is already taken.";
              case "USERNAME_TOO_SHORT":
                return `Username must be at least ${result.userError.minimumLength} characters.`;
              case "USERNAME_TOO_LONG":
                return `Username must be at most ${result.userError.maximumLength} characters.`;
              case "USERNAME_HAS_SURROUNDING_WHITESPACE":
                return "Username can't start or end with whitespace.";
              case "USERNAME_HAS_INVALID_CHARACTERS":
                return "Username contains characters that aren't allowed.";
              case "PASSWORD_TOO_SHORT":
                return `Password must be at least ${result.userError.minimumLength} characters.`;
              case "PASSWORD_TOO_LONG":
                return `Password must be at most ${result.userError.maximumLength} characters.`;
              case "PASSWORD_HAS_SURROUNDING_WHITESPACE":
                return "Password can't start or end with whitespace.";
              case "PASSWORD_TOO_COMMON":
                return "This password is one of the most commonly used passwords. Please choose a different one.";
              case "OTHER_ERROR":
                // The mutation threw unexpectedly; the original error is
                // available on `cause` if you want to log or inspect it.
                console.error("Sign-up failed:", result.userError.cause);
                return "Something went wrong. Please try again.";
              default:
                result.userError satisfies never;
                console.error("Sign-up failed:", result.userError);
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
            autoComplete="new-password"
            minLength={DEFAULT_MIN_PASSWORD_LENGTH}
            required
            disabled={pending}
          />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? <Spinner /> : <UserPlus data-icon="inline-start" />}
          {pending ? "Creating account…" : "Create account"}
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
        Already have an account?{' '}
        <Link
          to="/login"
          search={{ redirect }}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Log in
        </Link>
      </div>
    </AuthLayout>
  );
}
