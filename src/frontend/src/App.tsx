import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Sidebar } from '@/components/Sidebar'
import type { Page } from '@/components/Sidebar'
import './App.css'
import Overview from './pages/Overview'
import { Durations } from './pages/Durations'
import { Scheduling } from './pages/Scheduling'
import { Instability } from './pages/Instability'

/**
 * References:
 * https://www.youtube.com/watch?v=B7k5rOgmOGY
 */

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
            {page === 'overview' && <Overview />}
            {page === 'durations' && <Durations />}
            {page === 'scheduling' && <Scheduling />}
            {page === 'instability' && <Instability />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
