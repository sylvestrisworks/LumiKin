'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PLATFORM_OPTIONS, SKILL_OPTIONS } from '@/lib/childProfileOptions'
import { calcAge } from '@/lib/age'

type Profile = {
  id: number
  name: string
  birthYear: number
  birthDate: string | null
  platforms: string[]
  focusSkills: string[]
}

type Props = {
  initialProfiles: Profile[]
}

const today = new Date().toISOString().slice(0, 10)
// Default: child born 8 years ago today
const defaultBirthDate = (() => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 8)
  return d.toISOString().slice(0, 10)
})()

const EMPTY_FORM = { name: '', birthDate: defaultBirthDate, platforms: [] as string[], focusSkills: [] as string[] }

export default function ProfileManager({ initialProfiles }: Props) {
  const router = useRouter()
  const t = useTranslations('profileManager')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError('')
    setShowForm(true)
  }

  function openEdit(p: Profile) {
    setEditing(p)
    setForm({
      name:        p.name,
      birthDate:   p.birthDate ?? `${p.birthYear}-01-01`,
      platforms:   p.platforms,
      focusSkills: p.focusSkills,
    })
    setError('')
    setShowForm(true)
  }

  function toggleMulti(key: 'platforms' | 'focusSkills', val: string) {
    setForm(f => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter(x => x !== val) : [...f[key], val],
    }))
  }

  async function save() {
    if (!form.name.trim()) { setError(t('name') + ' is required'); return }
    if (!form.birthDate)   { setError(t('dateOfBirth') + ' is required'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(
        editing ? `/api/child-profiles/${editing.id}` : '/api/child-profiles',
        {
          method: editing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        }
      )
      if (!res.ok) { setError('Save failed'); setSaving(false); return }
      setShowForm(false)
      router.refresh()
    } catch {
      setError('Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number, name: string) {
    if (!confirm(t('deleteConfirm', { name }))) return
    await fetch(`/api/child-profiles/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div>
      {/* Profile chips */}
      <div className="flex flex-wrap gap-3 items-center">
        {initialProfiles.map(p => {
          const age = calcAge(p.birthDate, p.birthYear)
          return (
            <div
              key={p.id}
              className="flex items-center gap-2 bg-paper border border-rule rounded-xl px-4 py-2.5 shadow-sm"
            >
              <div className="w-7 h-7 rounded-full bg-ink/10 flex items-center justify-center text-xs font-serif text-ink shrink-0">
                {p.name[0].toUpperCase()}
              </div>
              <div className="text-sm">
                <span className="font-semibold text-ink">{p.name}</span>
                <span className="text-muted ml-1.5 text-xs">{age}y</span>
              </div>
              <button
                onClick={() => openEdit(p)}
                className="text-xs text-muted hover:text-accent transition-colors ml-1"
              >
                Edit
              </button>
              <button
                onClick={() => remove(p.id, p.name)}
                className="text-xs text-rule hover:text-accent transition-colors"
              >
                ✕
              </button>
            </div>
          )
        })}

        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2.5 border-2 border-dashed border-rule
            text-sm text-muted hover:border-ink hover:text-accent transition-colors"
        >
          {t('addButton')}
        </button>
      </div>

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-paper rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-ink">
              {editing ? t('editProfile', { name: editing.name }) : t('addProfile')}
            </h2>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-ink/80 mb-1">{t('name')}</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={t('namePlaceholder')}
                className="w-full px-3 py-2 rounded-lg border border-rule bg-paper text-ink text-sm focus:outline-none focus:ring-1 focus:ring-ink focus:border-ink placeholder:text-muted"
              />
            </div>

            {/* Birth date */}
            <div>
              <label className="block text-sm font-medium text-ink/80 mb-1">{t('dateOfBirth')}</label>
              <input
                type="date"
                value={form.birthDate}
                max={today}
                min="2000-01-01"
                onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))}
                className="w-full px-3 py-2 border border-rule bg-paper text-ink text-sm focus:outline-none focus:ring-1 focus:ring-ink focus:border-ink"
              />
              {form.birthDate && (
                <p className="text-xs text-muted mt-1">
                  Age: {calcAge(form.birthDate)} years old
                </p>
              )}
            </div>

            {/* Platforms */}
            <div>
              <label className="block text-sm font-medium text-ink/80 mb-2">{t('platforms')}</label>
              <div className="flex flex-wrap gap-2">
                {PLATFORM_OPTIONS.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggleMulti('platforms', p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      form.platforms.includes(p)
                        ? 'bg-ink text-paper border-ink'
                        : 'bg-paper text-ink/80 border-rule hover:border-ink'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Focus skills */}
            <div>
              <label className="block text-sm font-medium text-ink/80 mb-2">
                {t('focusSkills')} <span className="text-muted font-normal">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {SKILL_OPTIONS.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => toggleMulti('focusSkills', s.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      form.focusSkills.includes(s.value)
                        ? 'bg-ivy text-paper border-ivy'
                        : 'bg-paper text-ink/80 border-rule hover:border-ivy'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-accent">{error}</p>}

            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-ink/80 hover:text-ink transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-5 py-2 bg-ink hover:bg-accent text-paper text-kicker uppercase font-semibold transition-colors disabled:opacity-60"
                style={{ fontVariantCaps: 'all-small-caps' }}
              >
                {saving ? t('saving') : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
