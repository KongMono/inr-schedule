'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { contactGroups } from '@/data/contacts'

const THEME_KEY = 'inr-schedule:theme'

function telHref(phone: string) {
  return `tel:${phone.replace(/[^0-9+]/g, '')}`
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
              <span className="grid place-items-center w-9 h-9 rounded-full bg-[var(--md-primary-container)] text-teal-700 dark:text-teal-200 text-lg shadow-sm">📞</span>
              <span className="md-title-m sm:md-title-l tracking-wide text-teal-700 dark:text-teal-300 font-semibold">ข้อมูลติดต่อ</span>
            </div>
            <p className="anim-header-2 md-body-m text-[var(--md-on-surface-var)]">แตะรายชื่อเพื่อโทรออก</p>
          </div>
        </div>

        {/* Contact groups */}
        <div className="rounded-b-2xl space-y-6 pt-4 pb-4">
          {contactGroups.map((group, gi) => (
            <section key={gi} className="anim-fade-up" style={{ animationDelay: `${gi * 80}ms` }}>
              <h2 className="md-title-m text-teal-700 dark:text-teal-300 font-semibold px-1 mb-3">
                {group.title}
              </h2>
              <div className="space-y-2.5">
                {group.contacts.map((c, ci) => (
                  <a
                    key={ci}
                    href={telHref(c.phone)}
                    className="md-state flex items-center justify-between gap-3 rounded-2xl bg-[var(--md-surface)] md-elev-1 border border-gray-100 dark:border-gray-700/50 px-4 py-3.5 transition-all duration-150 active:scale-[0.98] hover:md-elev-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="grid place-items-center w-9 h-9 shrink-0 rounded-full bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 md-label-l font-medium">
                        {ci + 1}
                      </span>
                      <span className="md-body-l text-[var(--md-on-surface)] truncate">{c.name}</span>
                    </div>
                    <span className="flex items-center gap-2 shrink-0 text-teal-700 dark:text-teal-300">
                      <span className="md-body-m tabular-nums">{c.phone}</span>
                      <span className="grid place-items-center w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/60 text-lg">📞</span>
                    </span>
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
