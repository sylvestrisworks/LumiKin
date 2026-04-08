// Locale-aware navigation helpers — use these instead of next/link and next/navigation
// throughout the app to get automatic locale prefix handling.
import { createNavigation } from 'next-intl/navigation'
import { routing } from './i18n/routing'

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)
