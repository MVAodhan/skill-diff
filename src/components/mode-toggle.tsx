import { useEffect, useState } from 'react'
import { MoonIcon, SunIcon } from 'lucide-react'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { applyTheme, getStoredTheme, setStoredTheme, type Theme } from '#/lib/theme'

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

export const ModeToggle = () => {
  const [theme, setTheme] = useState<Theme>('system')

  useEffect(() => {
    setTheme(getStoredTheme())
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (getStoredTheme() === 'system') {
        applyTheme('system')
      }
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const select = (next: Theme) => {
    setTheme(next)
    setStoredTheme(next)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="relative" aria-label="Toggle theme">
            <SunIcon className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <MoonIcon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-24 min-w-24">
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => select(value as Theme)}
        >
          {THEME_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
