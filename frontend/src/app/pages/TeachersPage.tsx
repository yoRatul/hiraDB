import { useCallback, useState } from 'react'
import { api, type Teacher } from '../../services/api'
import { useLoadEffect } from '../../hooks/useLoadEffect'
import { Detail, DetailCard, EmptyState, ErrorState, Loading, PageHeading } from '../../components/feedback'

const directoryPageSize = 100

export function TeacherList({
  onOpen,
  onCreate,
  refreshKey,
}: {
  onOpen: (teacher: Teacher) => void
  onCreate: () => void
  refreshKey: number
}) {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setTeachers(await api.listAllTeachers())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load teachers.')
    } finally {
      setLoading(false)
    }
  }, [])
  useLoadEffect(load, refreshKey)

  const matchingTeachers = teachers.filter((teacher) => (
    `${teacher.full_name} ${teacher.email} ${teacher.id}`.toLowerCase().includes(query.trim().toLowerCase())
  ))
  const visibleTeachers = matchingTeachers.slice(page * directoryPageSize, (page + 1) * directoryPageSize)

  return (
    <>
      <PageHeading eyebrow="People · staff directory" title="Teachers" description="Keep the teacher directory current and easy to reach." action={<button className="button button-primary" onClick={onCreate}>＋ Add teacher</button>} />
      <section className="directory-filter-panel" aria-label="Teacher search">
        <label className="directory-search-control" htmlFor="teacher-directory-search">
          <span className="directory-search-icon" aria-hidden="true">⌕</span>
          <span className="sr-only">Search teachers</span>
          <input id="teacher-directory-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0) }} placeholder="Search by teacher name or email" />
          {query && <button className="search-clear" type="button" aria-label="Clear teacher search" onClick={() => { setQuery(''); setPage(0) }}>×</button>}
        </label>
        <span className="directory-result-count" aria-live="polite">{matchingTeachers.length} {matchingTeachers.length === 1 ? 'teacher' : 'teachers'}</span>
      </section>
      {error && <ErrorState message={error} onRetry={() => void load()} />}
      {loading ? <Loading label="Loading teachers…" /> : teachers.length === 0 ? <EmptyState title="No teachers yet" detail="Add a teacher to create your staff directory." action={<button className="button button-primary" onClick={onCreate}>Add the first teacher</button>} /> : matchingTeachers.length === 0 ? <EmptyState title="No matching teachers" detail="Try another name or email address, or clear the search." action={<button className="button button-outline" onClick={() => setQuery('')}>Clear search</button>} /> : (
        <>
          <div className="table-card"><div className="table-overflow"><table><thead><tr><th>Teacher</th><th>Email</th><th>ID</th><th>Actions</th></tr></thead><tbody>
            {visibleTeachers.map((teacher) => <tr key={teacher.id}><td><button className="person-link" onClick={() => onOpen(teacher)}><span className="avatar avatar-teacher">{teacher.full_name.charAt(0).toUpperCase()}</span><span><strong>{teacher.full_name}</strong><small>Teacher #{teacher.id}</small></span></button></td><td>{teacher.email}</td><td>#{teacher.id}</td><td><button className="button button-quiet" onClick={() => onOpen(teacher)}>View <span aria-hidden="true">→</span></button></td></tr>)}
          </tbody></table></div></div>
          <div className="pagination">
            <span>Showing {page * directoryPageSize + 1}–{page * directoryPageSize + visibleTeachers.length} of {matchingTeachers.length} teachers</span>
            <div>
              <button className="button button-outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
              <button className="button button-outline" disabled={(page + 1) * directoryPageSize >= matchingTeachers.length} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

export function TeacherDetailPage({
  teacherId,
  onBack,
  onEdit,
  onDelete,
  refreshKey,
}: {
  teacherId: number
  onBack: () => void
  onEdit: (teacher: Teacher) => void
  onDelete: (teacher: Teacher) => void
  refreshKey: number
}) {
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setTeacher(await api.getTeacher(teacherId)) } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load this teacher.')
    } finally { setLoading(false) }
  }, [teacherId])
  useLoadEffect(load, refreshKey)

  return (
    <>
      {loading && <Loading label="Loading teacher…" />}
      {error && <ErrorState message={error} onRetry={() => void load()} />}
      {teacher && <>
        <PageHeading eyebrow={`Teacher directory · #${teacher.id}`} title={teacher.full_name} description="Teacher profile" back={onBack} backLabel="Back to teachers" action={<div className="button-row"><button className="button button-outline" onClick={() => onEdit(teacher)}>Edit teacher</button><button className="button button-danger-outline" onClick={() => onDelete(teacher)}>Delete</button></div>} />
        <DetailCard title="Contact details"><Detail label="Full name" value={teacher.full_name} /><Detail label="Email" value={teacher.email} /><Detail label="Teacher ID" value={teacher.id} /></DetailCard>
      </>}
    </>
  )
}
