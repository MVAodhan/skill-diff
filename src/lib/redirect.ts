/** Where auth pages send the user after success when no redirect was asked for. */
export const DEFAULT_AUTH_REDIRECT = "/dashboard"

/**
 * Picks a safe post-auth destination: only internal paths qualify, so a
 * crafted `redirect` value can't bounce the user off-site.
 */
export const safeRedirectPath = (redirect: string | undefined): string => {
  if (redirect !== undefined && redirect.startsWith("/") && !redirect.startsWith("//")) {
    return redirect
  }
  return DEFAULT_AUTH_REDIRECT
}
