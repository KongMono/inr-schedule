'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { contactGroups, type ContactRole } from '@/data/contacts'

const THEME_KEY = 'inr-schedule:theme'

const ROLE_META: Record<ContactRole, { label: string; icon: string; avatar: string; badge: string }> = {
  doctor: {
    label: 'แพทย์', icon: '🩺',
    avatar: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    badge: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
  },
  nurse: {
    label: 'พยาบาล', icon: '💉',
    avatar: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
    badge: 'bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300',
  },
  tech: {
    label: 'นักเทคโน', icon: '🩻',
    avatar: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
  },
  maid: {
    label: 'แม่บ้าน', icon: '🧹',
    avatar: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
    badge: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300',
  },
}

const ROLE_ORDER: ContactRole[] = ['doctor', 'nurse', 'tech', 'maid']
const allContacts = contactGroups.flatMap(g => g.contacts)

function telHref(phone: string) {
  return `tel:${phone.replace(/[^0-9+]/g, '')}`
}

// ตัด prefix (นพ. น.ส. นาย นาง) แล้วเอาตัวอักษรแรกของชื่อจริงเป็น avatar
function initial(name: string) {
  const stripped = name.replace(/^(นพ\.|พญ\.|น\.ส\.|นาย|นาง(สาว)?|ดร\.)\s*/, '')
  return stripped.trim().charAt(0) || name.charAt(0)
}

export default function ContactPage() {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY)
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = saved ? saved === 'dark' : prefersDark
    document.documentElement.classList.toggle('dark', isDark)
    setHydrated(true)
  }, [])

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[var(--md-background)] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--md-background)] transition-colors duration-300 p-2 sm:p-4">
      <div className="max-w-2xl mx-auto">

        {/* Top app bar */}
        <div className="relative bg-[var(--md-surface)] md-elev-1 rounded-t-2xl px-4 py-6 sm:px-6 sm:py-7 transition-colors duration-300">
          <div className="absolute top-4 left-4 z-10">
            <Link
              href="/"
              className="md-state md-label-l inline-flex items-center gap-1 h-10 px-4 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 transition-all duration-200 active:scale-95"
            >
              ‹ ตารางเวร
            </Link>
          </div>
          <div className="text-center">
            <div className="anim-header-1 flex items-center justify-center gap-2 mb-3">
              <span className="grid place-items-center w-9 h-9 rounded-full bg-[var(--md-primary-container)] text-teal-700 dark:text-teal-200 shadow-sm">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.07 9.81 19.79 19.79 0 0 1 1 1.18 2 2 0 0 1 2.92 0h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 7.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 15l.92 1.92z" /></svg>
              </span>
              <span className="md-title-m sm:md-title-l tracking-wide text-teal-700 dark:text-teal-300 font-semibold">ข้อมูลติดต่อ</span>
            </div>
            <p className="anim-header-2 md-body-m text-[var(--md-on-surface-var)]">แตะรายชื่อเพื่อโทรออก</p>
          </div>
        </div>

        {/* Contact groups — จัดกลุ่มตาม role */}
        <div className="rounded-b-2xl space-y-6 pt-4 pb-4">
          {ROLE_ORDER.map((roleKey, gi) => {
            const list = allContacts.filter(c => c.role === roleKey)
            if (!list.length) return null
            const role = ROLE_META[roleKey]
            return (
            <section key={roleKey} className="anim-fade-up" style={{ animationDelay: `${gi * 80}ms` }}>
              <h2 className="md-title-m text-teal-700 dark:text-teal-300 font-semibold px-1 mb-3 flex items-center gap-2">
                <span>{role.icon}</span>
                {role.label}
                <span className="font-normal opacity-60">({list.length})</span>
              </h2>
              <div className="space-y-2.5">
                {list.map((c, ci) => (
                  <a
                    key={ci}
                    href={telHref(c.phone)}
                    className="md-state flex items-center justify-between gap-3 rounded-2xl bg-[var(--md-surface)] md-elev-1 border border-gray-100 dark:border-gray-700/50 px-4 py-3.5 transition-all duration-150 active:scale-[0.98] hover:md-elev-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`relative grid place-items-center w-11 h-11 shrink-0 rounded-full md-title-m font-semibold ${role.avatar}`}>
                        {initial(c.name)}
                        <span className="absolute -bottom-1 -right-1 grid place-items-center w-5 h-5 rounded-full bg-[var(--md-surface)] text-[11px] leading-none">{role.icon}</span>
                      </span>
                      <span className="md-body-l text-[var(--md-on-surface)] truncate">{c.name}</span>
                    </div>
                    <span className="flex items-center gap-2 shrink-0 text-teal-700 dark:text-teal-300">
                      <span className="md-body-m tabular-nums hidden sm:inline">{c.phone}</span>
                      <span className="grid place-items-center w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-500 text-teal-700 dark:text-white">
                        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.07 9.81 19.79 19.79 0 0 1 1 1.18 2 2 0 0 1 2.92 0h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 7.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 15l.92 1.92z" /></svg>
                      </span>
                    </span>
                  </a>
                ))}
              </div>
            </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
