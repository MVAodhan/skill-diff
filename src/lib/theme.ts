export type Theme = 'light' | 'dark' | 'system'

export const THEME_STORAGE_KEY = 'theme'

const prefersDark = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches

export const getStoredTheme = (): Theme => {
  if (typeof window === 'undefined') {
    return 'system'
  }
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

/** Toggles the `dark` class on `<html>` (and native color-scheme) for a theme. */
export const applyTheme = (theme: Theme): void => {
  if (typeof document === 'undefined') {
    return
  }
  const dark = theme === 'system' ? prefersDark() : theme === 'dark'
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

/** Persists the theme and applies it immediately. */
export const setStoredTheme = (theme: Theme): void => {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // localStorage unavailable (private mode, etc.) — still apply for the session.
  }
  applyTheme(theme)
}
