import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Gauge, Timer, Share2, AlertTriangle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import './App.css'
import Overview from './pages/Overview'
import { Durations } from './pages/Durations'

type Page = 'overview' | 'durations' | 'scheduling' | 'instability'

interface NavItem {
  id: Page
  label: string
  icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: Gauge },
  { id: 'durations', label: 'Durations', icon: Timer },
  { id: 'scheduling', label: 'Scheduling', icon: Share2 },
  { id: 'instability', label: 'Instability', icon: AlertTriangle },
]

interface SidebarProps {
  page: Page
  onNavigate: (p: Page) => void
}

function Sidebar({ page, onNavigate }: SidebarProps) {
  return (
    <aside
      className="w-[200px] shrink-0 flex flex-col"
      style={{ background: 'var(--g2)', borderRight: '1px solid var(--g4)' }}
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="px-4 py-5" style={{ borderBottom: '1px solid var(--g4)' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 flex items-center justify-center shrink-0"
            style={{ background: 'var(--orange-dim)', border: '1px solid var(--orange)' }}
          >
            <span style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '0.68rem',
              letterSpacing: '0.04em',
              color: 'var(--orange)',
            }}>
              TS
            </span>
          </div>
          <div>
            <p style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '0.65rem',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--g7)',
            }}>
              TestSplit
            </p>
            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.52rem',
              color: 'var(--g6)',
              letterSpacing: '0.04em',
            }}>
              CI Profiler
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 flex flex-col gap-0.5" role="navigation">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = page === id
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              aria-current={active ? 'page' : undefined}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors duration-100"
              style={{
                background: active ? 'var(--orange-dim)' : 'transparent',
                borderLeft: `2px solid ${active ? 'var(--orange)' : 'transparent'}`,
              }}
            >
              <Icon
                size={13}
                aria-hidden="true"
                style={{ color: active ? 'var(--orange)' : 'var(--g6)' }}
              />
              <span style={{
                fontFamily: 'var(--font-display)',
                fontWeight: active ? 600 : 400,
                fontSize: '0.64rem',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: active ? 'var(--orange)' : 'var(--g6)',
              }}>
                {label}
              </span>
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid var(--g4)' }}>
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.52rem',
          color: 'var(--g5)',
          letterSpacing: '0.06em',
        }}>
          v1.0.0 — TestSplit
        </p>
      </div>
    </aside>
  )
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <p style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: '0.7rem',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--g5)',
        }}>
          {title}
        </p>
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.6rem',
          color: 'var(--g5)',
          marginTop: '0.5rem',
        }}>
          — in progress —
        </p>
      </div>
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState<Page>('overview')

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar page={page} onNavigate={setPage} />
      <main className="flex-1 overflow-auto" role="main">
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="h-full"
          >
            {page === 'overview' && <Overview/>}
            {page === 'durations' && <Durations />}
            {page === 'scheduling' && <ComingSoon title="Scheduling" />}
            {page === 'instability' && <ComingSoon title="Instability" />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
