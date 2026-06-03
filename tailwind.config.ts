import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Enhanced dark mode colors
        slate: {
          850: '#1a202e',
          950: '#0f1419',
        },
        // Editorial palette — paper-and-ink, used by EditorialMasthead + /design-preview.
        // Backed by CSS variables in globals.css so `.evening` can scope-invert
        // without touching `next-themes` or legacy `dark:` classes. Triplet form
        // keeps Tailwind opacity modifiers (`bg-ink/10`, `border-ink/30`) working.
        paper:  'rgb(var(--paper)  / <alpha-value>)',
        ink:    'rgb(var(--ink)    / <alpha-value>)',
        rule:   'rgb(var(--rule)   / <alpha-value>)',
        muted:  'rgb(var(--muted)  / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        ivy:    'rgb(var(--ivy)    / <alpha-value>)',
        warm:   'rgb(var(--warm)   / <alpha-value>)',
      },
      fontFamily: {
        // `font-serif` pulls Fraunces (loaded as a CSS var in app/layout.tsx).
        // Existing `font-sans` continues to inherit Inter from the body className.
        serif: ['var(--font-fraunces)', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
        hand:  ['var(--font-caveat)', 'Caveat', 'Bradley Hand', 'cursive'],
      },
      fontSize: {
        // Editorial display sizes — used for headlines, not body copy.
        'display-sm': ['2.5rem',  { lineHeight: '1.08', letterSpacing: '-0.015em' }],
        'display':    ['3.5rem',  { lineHeight: '1.05', letterSpacing: '-0.02em'  }],
        'display-lg': ['5rem',    { lineHeight: '1.02', letterSpacing: '-0.025em' }],
        'kicker':     ['0.75rem', { lineHeight: '1.2',  letterSpacing: '0.12em'   }],
      },
      maxWidth: {
        prose: '65ch',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
