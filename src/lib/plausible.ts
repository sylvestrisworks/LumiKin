declare global {
  interface Window {
    plausible?: (
      event: string,
      options?: { props?: Record<string, string | number | boolean>; callback?: () => void },
    ) => void
  }
}

export type PlausibleGoal =
  | 'partners_page_view'
  | 'partners_form_submit'
  | 'methodology_deep_read'
  | 'press_kit_view'
  | 'game_page_from_search'
  | 'api_sample_copy'

export function trackGoal(
  goal: PlausibleGoal,
  props?: Record<string, string | number | boolean>,
) {
  if (typeof window === 'undefined') return
  // Respect Do-Not-Track; Plausible's own script also honours DNT server-side
  if (navigator.doNotTrack === '1') return
  if (typeof window.plausible === 'function') {
    window.plausible(goal, props ? { props } : undefined)
  }
}
