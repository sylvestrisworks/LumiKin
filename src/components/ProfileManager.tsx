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
              className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 shadow-sm"
            >
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">
                {p.name[0].toUpperCase()}
              </div>
              <div className="text-sm">
                <span className="font-semibold text-slate-800 dark:text-slate-100">{p.name}</span>
                <span className="text-slate-400 dark:text-slate-500 ml-1.5 text-xs">{age}y</span>
              </div>
              <button
                onClick={() => openEdit(p)}
                className="text-xs text-slate-400 dark:text-slate-500 hover:text-indigo-600 transition-colors ml-1"
              >
                Edit
              </button>
              <button
                onClick={() => remove(p.id, p.name)}
                className="text-xs text-slate-300 hover:text-red-500 transition-colors"
              >
                ✕
              </button>
            </div>
          )
        })}

        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600
            text-sm text-slate-500 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
        >
          {t('addButton')}
        </button>
      </div>

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {editing ? t('editProfile', { name: editing.name }) : t('addProfile')}
            </h2>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('name')}</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={t('namePlaceholder')}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>

            {/* Birth date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('dateOfBirth')}</label>
              <input
                type="date"
                value={form.birthDate}
                max={today}
                min="2000-01-01"
                onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {form.birthDate && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Age: {calcAge(form.birthDate)} years old
                </p>
              )}
            </div>

            {/* Platforms */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('platforms')}</label>
              <div className="flex flex-wrap gap-2">
                {PLATFORM_OPTIONS.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggleMulti('platforms', p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      form.platforms.includes(p)
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-500 hover:border-indigo-400'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Focus skills */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('focusSkills')} <span className="text-slate-400 dark:text-slate-500 font-normal">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {SKILL_OPTIONS.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => toggleMulti('focusSkills', s.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      form.focusSkills.includes(s.value)
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-500 hover:border-emerald-400'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
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
