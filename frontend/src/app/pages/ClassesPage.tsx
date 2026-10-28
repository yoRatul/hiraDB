import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, type SchoolClass, type Student } from '../../services/api'
import { useLoadEffect } from '../../hooks/useLoadEffect'
import { EmptyState, ErrorState, Loading, PageHeading, Pagination } from '../../components/feedback'
import { pageSize } from '../../constants'
import { display } from '../../utils/format'
import { fullName } from '../../utils/student'
import { YearSelect } from '../../components/YearSelect'

const currentAcademicYear = String(new Date().getFullYear())

export function ClassList({
  onOpen,
  onCreate,
  onPromote,
  refreshKey,
}: {
  onOpen: (schoolClass: SchoolClass) => void
  onCreate: () => void
  onPromote: () => void
  refreshKey: number
}) {
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [rosterCounts, setRosterCounts] = useState<Record<number, number>>({})
  const [rosterErrors, setRosterErrors] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setClasses(await api.listAllClasses())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load classes.')
    } finally {
      setLoading(false)
    }
  }, [])
  useLoadEffect(load, refreshKey)

  const matchingClasses = useMemo(() => classes.filter((schoolClass) => (
    `${schoolClass.name} ${schoolClass.description ?? ''} ${schoolClass.id}`.toLowerCase().includes(query.trim().toLowerCase())
  )), [classes, query])
  const visibleClasses = useMemo(() => matchingClasses.slice(page * 100, (page + 1) * 100), [matchingClasses, page])

  useEffect(() => {
    let active = true
    void Promise.all(visibleClasses.map(async (schoolClass) => {
      let count = 0
      try {
        for (let skip = 0; ; skip += 100) {
          const students = await api.listStudents({
            class_name: schoolClass.name,
            academic_year: currentAcademicYear,
            skip,
            limit: 100,
          })
          count += students.length
          if (students.length < 100) break
        }
        return { id: schoolClass.id, count, error: '' }
      } catch (reason) {
        return { id: schoolClass.id, count: null, error: `${schoolClass.name}: ${reason instanceof Error ? reason.message : 'Could not load student count.'}` }
      }
    })).then((results) => {
      if (!active) return
      setRosterCounts((previous) => ({
        ...previous,
        ...Object.fromEntries(results.filter((item) => item.count !== null).map(({ id, count }) => [id, count])),
      }))
      setRosterErrors(results.flatMap((item) => item.error ? [item.error] : []))
    })
    return () => { active = false }
  }, [visibleClasses])

  return (
    <>
      <PageHeading
        eyebrow="Academics · class groups"
        title="Classes"
        description="Manage the class directory and see students by class and academic year."
        action={<div className="button-row"><button className="button button-outline" onClick={onCreate}>＋ Add class</button><button className="button button-primary" onClick={onPromote}>Promote students <span aria-hidden="true">↗</span></button></div>}
      />
      <div className="inline-note"><span className="note-icon" aria-hidden="true">i</span><span>Class groups are managed by the classes API. Student membership is recorded separately in each academic-history entry.</span></div>
      <section className="directory-filter-panel" aria-label="Class search">
        <label className="directory-search-control" htmlFor="class-directory-search">
          <span className="directory-search-icon" aria-hidden="true">⌕</span>
          <span className="sr-only">Search classes</span>
          <input id="class-directory-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0) }} placeholder="Search classes by name or description" />
          {query && <button className="search-clear" type="button" aria-label="Clear class search" onClick={() => { setQuery(''); setPage(0) }}>×</button>}
        </label>
        <span className="directory-result-count" aria-live="polite">{matchingClasses.length} {matchingClasses.length === 1 ? 'class' : 'classes'}</span>
      </section>
      {error && <ErrorState message={error} onRetry={() => void load()} />}
      {rosterErrors.map((message) => <ErrorState key={message} message={`Some current-year class counts are unavailable: ${message}`} onRetry={() => void load()} />)}
      {loading ? <Loading label="Loading classes…" /> : classes.length === 0 ? (
        <EmptyState title="No classes yet" detail="Create the class directory before assigning students to classes." action={<button className="button button-primary" onClick={onCreate}>Create a class</button>} />
      ) : matchingClasses.length === 0 ? (
        <EmptyState title="No matching classes" detail="Try another name or clear the search." action={<button className="button button-outline" onClick={() => setQuery('')}>Clear search</button>} />
      ) : (
        <>
          <div className="class-grid">
            {visibleClasses.map((schoolClass) => <button className="class-card" key={schoolClass.id} onClick={() => onOpen(schoolClass)} aria-label={`View ${schoolClass.name} students`}>
              <div className="class-card-top"><span className="class-symbol" aria-hidden="true">▦</span><span className="class-id">CLASS {schoolClass.id}</span></div>
              <h2>{schoolClass.name}</h2>
              <p>{display(schoolClass.description)}</p>
              <div className="class-current-count"><strong>{rosterCounts[schoolClass.id] ?? '—'}</strong><span>students · {currentAcademicYear}</span></div>
              <div className="class-card-actions"><span className="button button-quiet">View students <span aria-hidden="true">→</span></span></div>
            </button>)}
          </div>
          <div className="pagination"><span>Showing {page * 100 + 1}–{page * 100 + visibleClasses.length} of {matchingClasses.length} classes</span><div><button className="button button-outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><button className="button button-outline" disabled={(page + 1) * 100 >= matchingClasses.length} onClick={() => setPage(page + 1)}>Next</button></div></div>
        </>
      )}
    </>
  )
}

export function ClassDetailPage({
  classId,
  onBack,
  onSelectClass,
  onEdit,
  onDelete,
  refreshKey,
}: {
  classId: number
  onBack: () => void
  onSelectClass: (schoolClass: SchoolClass) => void
  onEdit: (schoolClass: SchoolClass) => void
  onDelete: (schoolClass: SchoolClass) => void
  refreshKey: number
}) {
  const [schoolClass, setSchoolClass] = useState<SchoolClass | null>(null)
  const [classDirectory, setClassDirectory] = useState<SchoolClass[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [year, setYear] = useState(currentAcademicYear)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const detail = await api.getClass(classId)
      setSchoolClass(detail)
      const studentRows = await api.listStudents({
        class_name: detail.name,
        academic_year: year || undefined,
        skip: page * pageSize,
        limit: pageSize,
      })
      setStudents(studentRows)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load class details.')
    } finally {
      setLoading(false)
    }
  }, [classId, page, year])

  useLoadEffect(load, refreshKey)

  useEffect(() => {
    let active = true
    void api.listAllClasses().then((items) => {
      if (active) setClassDirectory(items)
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? `Could not load class navigation: ${reason.message}` : 'Could not load class navigation.')
    })
    return () => { active = false }
  }, [])

  return (
    <>
      {loading && <Loading label="Loading class and roster…" />}
      {error && <ErrorState message={error} onRetry={() => void load()} />}
      {schoolClass && (
        <>
          <nav className="class-quick-nav" aria-label="Navigate to another class">
            <span className="class-quick-nav-label">Classes</span>
            <div className="class-quick-nav-items">
              {classDirectory.map((item) => <button
                type="button"
                key={item.id}
                className={item.id === schoolClass.id ? 'class-quick-link active' : 'class-quick-link'}
                aria-current={item.id === schoolClass.id ? 'page' : undefined}
                onClick={() => { if (item.id !== classId) onSelectClass(item) }}
              >{item.name}</button>)}
            </div>
          </nav>
          <PageHeading eyebrow={`Class directory · #${schoolClass.id}`} title={schoolClass.name} description={display(schoolClass.description)} back={onBack} backLabel="Back to classes" action={<div className="button-row"><button className="button button-outline" onClick={() => onEdit(schoolClass)}>Edit class</button><button className="button button-danger-outline" onClick={() => onDelete(schoolClass)}>Delete</button></div>} />
          <section className="section-card">
            <div className="section-head"><div><h2>Students in {schoolClass.name}</h2><p>Roster is matched using the academic record's class name and year.</p></div>
              <label className="compact-field"><span className="sr-only">Filter by academic year</span><YearSelect value={year} onChange={(value) => { setPage(0); setYear(value) }} /></label>
            </div>
            {students.length === 0 && !loading ? <EmptyState title={year ? 'No students for this year' : 'No students in this class'} detail="Student rosters come from academic-history records. Create or update a student's academic record to add them." /> : (
              <>
                <div className="table-overflow"><table><thead><tr><th>Student</th><th>Guardian</th><th>Guardian phone</th><th>Admission year</th><th>ID</th></tr></thead><tbody>
                  {students.map((student) => <tr key={student.id}><td><strong>{fullName(student)}</strong></td><td>{display(student.guardian_name)}</td><td>{display(student.guardian_phone)}</td><td>{display(student.admission_year)}</td><td>#{student.id}</td></tr>)}
                </tbody></table></div>
                <Pagination page={page} count={students.length} onChange={setPage} />
              </>
            )}
          </section>
        </>
      )}
    </>
  )
}
