#!/usr/bin/env node
// One-shot: add Phase E meta-verdict keys to all five locale message files.
// Idempotent — re-running won't duplicate or overwrite existing values.
//
// Adds to roblox and fortnite namespaces:
//   - metaVerdictGreat / Good / Caution / Avoid  (verdict labels for meta titles)
//   - metaTitleVerdict                            (template: {title} {verdict} {score})
//   - metaDescVerdict                             (template: {parts} {title})
//
// EN and SV get proper localized copy; FR/DE/ES get English placeholders.
// FR/DE/ES localization is a follow-up.

import { readFileSync, writeFileSync } from 'node:fs'

const TARGETS = {
  en: {
    roblox: {
      metaVerdictGreat:   'Great for kids',
      metaVerdictGood:    'Good with guidance',
      metaVerdictCaution: 'Use caution',
      metaVerdictAvoid:   'Not recommended',
      metaTitleVerdict:   '{title} — {verdict} · LumiScore {score}/100',
      metaDescVerdict:    '{parts}. Parent verdict and risk breakdown for {title} on Roblox.',
      metaAgeSuffix:      'Age {age}+',
    },
    fortnite: {
      metaVerdictGreat:   'Great for kids',
      metaVerdictGood:    'Good with guidance',
      metaVerdictCaution: 'Use caution',
      metaVerdictAvoid:   'Not recommended',
      metaTitleVerdict:   '{title} — {verdict} · LumiScore {score}/100',
      metaDescVerdict:    '{parts}. Parent verdict and risk breakdown for {title} on Fortnite Creative.',
      metaAgeSuffix:      'Age {age}+',
    },
  },
  sv: {
    roblox: {
      metaVerdictGreat:   'Bra för barn',
      metaVerdictGood:    'Okej med vägledning',
      metaVerdictCaution: 'Försiktighet krävs',
      metaVerdictAvoid:   'Rekommenderas ej för barn',
      metaTitleVerdict:   'Åldersgräns för {title} — {verdict} · LumiScore {score}/100',
      metaDescVerdict:    '{parts}. Föräldraomdöme och riskanalys för {title} på Roblox.',
      metaAgeSuffix:      'Åldersgräns {age}+',
    },
    fortnite: {
      metaVerdictGreat:   'Bra för barn',
      metaVerdictGood:    'Okej med vägledning',
      metaVerdictCaution: 'Försiktighet krävs',
      metaVerdictAvoid:   'Rekommenderas ej för barn',
      metaTitleVerdict:   'Åldersgräns för {title} — {verdict} · LumiScore {score}/100',
      metaDescVerdict:    '{parts}. Föräldraomdöme och riskanalys för {title} på Fortnite Creative.',
      metaAgeSuffix:      'Åldersgräns {age}+',
    },
  },
}

// English placeholders for the locales we haven't translated yet. Phase E
// follow-up should replace these with proper FR/DE/ES copy.
const PLACEHOLDER_LOCALES = ['fr', 'de', 'es']
for (const loc of PLACEHOLDER_LOCALES) TARGETS[loc] = TARGETS.en

let changed = 0
for (const [loc, namespaces] of Object.entries(TARGETS)) {
  const path = `messages/${loc}.json`
  const json = JSON.parse(readFileSync(path, 'utf8'))
  for (const [ns, keys] of Object.entries(namespaces)) {
    if (!json[ns]) { console.warn(`!! ${loc}.json: missing namespace ${ns}, skipping`); continue }
    for (const [k, v] of Object.entries(keys)) {
      if (json[ns][k] === undefined) {
        json[ns][k] = v
        changed++
      }
    }
  }
  // Preserve indentation style of the source files (2 spaces, trailing newline).
  writeFileSync(path, JSON.stringify(json, null, 2) + '\n', 'utf8')
  console.log(`✓ ${path}`)
}
console.log(`\n${changed} keys added across all locale files.`)
