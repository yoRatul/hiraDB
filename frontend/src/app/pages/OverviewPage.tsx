import { useCallback, useState } from 'react'
import { api } from '../../services/api'
import { useLoadEffect } from '../../hooks/useLoadEffect'
import { ErrorState, Loading, PageHeading } from '../../components/feedback'
import type { Area } from '../types'

export function Dashboard({
  onNavigate,
  refreshKey,
}: {
  onNavigate: (area: Area) => void
  refreshKey: number
}) {
  const [counts, setCounts] = useState<{ students: number | null; classes: number | null; teachers: number | null } | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    setCounts(null)
    const results = await Promise.allSettled([
      api.listAllStudents(),
      api.listAllClasses(),
      api.listAllTeachers(),
    ])
    const countFor = (index: number) => results[index].status === 'fulfilled' ? results[index].value.length : null
    setCounts({ students: countFor(0), classes: countFor(1), teachers: countFor(2) })
    const names = ['student', 'class', 'teacher']
    const failures = results.flatMap((result, index) => result.status === 'rejected'
      ? [`${names[index]} count: ${result.reason instanceof Error ? result.reason.message : 'request failed'}`]
      : [])
    if (failures.length) setError(`Some dashboard data could not be loaded — ${failures.join('; ')}.`)
  }, [])

  useLoadEffect(load, refreshKey)

  return (
    <>
      <PageHeading
        eyebrow="School overview"
        title="A clear view of your school."
        description="A live snapshot based on records currently available from hiraDB."
      />
      {error && <ErrorState message={error} onRetry={() => void load()} />}
      {!counts && !error && <Loading label="Counting records from the API…" />}
      {counts && (
        <>
          <section className="metric-grid" aria-label="School record counts">
            <button className="metric-card metric-students" onClick={() => onNavigate('students')}>
              <span className="metric-icon" aria-hidden="true">♧</span>
              <span className="metric-label">Students</span>
              <strong>{counts.students ?? '—'}</strong>
              <span className="metric-foot">Open student records <span aria-hidden="true">↗</span></span>
            </button>
            <button className="metric-card metric-classes" onClick={() => onNavigate('classes')}>
              <span className="metric-icon" aria-hidden="true">▦</span>
              <span className="metric-label">Classes</span>
              <strong>{counts.classes ?? '—'}</strong>
              <span className="metric-foot">Manage class groups <span aria-hidden="true">↗</span></span>
            </button>
            <button className="metric-card metric-teachers" onClick={() => onNavigate('teachers')}>
              <span className="metric-icon" aria-hidden="true">♙</span>
              <span className="metric-label">Teachers</span>
              <strong>{counts.teachers ?? '—'}</strong>
              <span className="metric-foot">Open teacher directory <span aria-hidden="true">↗</span></span>
            </button>
          </section>
          <section className="welcome-panel">
            <div className="welcome-copy">
              <span className="eyebrow">A better school day starts here</span>
              <h2>Everything in its right place.</h2>
              <p>Keep student histories, class rosters, and staff information easy to find and up to date.</p>
            </div>
            <div className="welcome-links">
              <button onClick={() => onNavigate('students')}>Browse students <span>→</span></button>
              <button onClick={() => onNavigate('classes')}>Explore classes <span>→</span></button>
            </div>
          </section>
        </>
      )}
    </>
  )
}
