import { motion } from 'motion/react'
import { SectionHeader } from '@/components/SectionHeader'

export function CoreUtilizationPanel({ coresUsed, totalCores }: { coresUsed: number; totalCores: number | null }) {
  const total = Math.max(totalCores ?? coresUsed, coresUsed)
  const utilPct = total > 0 ? Math.round((coresUsed / total) * 100) : 100
  const displayTotal = Math.min(total, 32)
  const displayUsed = Math.min(coresUsed, displayTotal)

  return (
    <div className="flex flex-col shrink-0" style={{ borderBottom: '1px solid var(--g4)' }}>
      <SectionHeader
        accent="var(--cyan)"
        title="Core Utilisation"
        right={<span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.48rem', color: 'var(--g6)' }}>{coresUsed} / {total} cores · {utilPct}%</span>}
      />
      <div className="flex items-center gap-5 px-5 py-3">
        <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {Array.from({ length: displayTotal }, (_, i) => {
            const inUse = i < displayUsed
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.03 * i, duration: 0.2 }}
                style={{
                  width: 18, height: 18,
                  background: inUse ? 'var(--cyan-dim)' : 'var(--g3)',
                  border: `1px solid ${inUse ? 'var(--cyan)' : 'var(--g4)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)', fontSize: '0.38rem',
                  color: inUse ? 'var(--cyan)' : 'var(--g5)',
                  cursor: 'default',
                }}
                title={inUse ? `Core ${i + 1}: running Job ${i + 1}` : `Core ${i + 1}: idle`}
              >
                {inUse ? i + 1 : ''}
              </motion.div>
            )
          })}
        </div>
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.8rem', lineHeight: 1, color: 'var(--g7)' }}>
            {utilPct}%
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.46rem', color: 'var(--g6)', marginTop: 4 }}>
            utilization
          </div>
        </div>
      </div>
    </div>
  )
}
