import { useCallback, useEffect, useState } from 'react'
import { api, type AcademicRecord, type AlumniRecord, type SchoolClass, type Student, type StudentDetail, type StudentWithAlumni } from '../../services/api'
import { useLoadEffect } from '../../hooks/useLoadEffect'
import { Detail, DetailCard, EmptyState, ErrorState, Loading, PageHeading, Pagination } from '../../components/feedback'
import { pageSize } from '../../constants'
import { display } from '../../utils/format'
import { fullName } from '../../utils/student'
import { YearSelect } from '../../components/YearSelect'

export function StudentList({
  onOpen,
  onCreate,
  onCreateAlumni,
  refreshKey,
}: {
  onOpen: (student: Student) => void
  onCreate: () => void
  onCreateAlumni: () => void
  refreshKey: number
}) {
  const [studentGroup, setStudentGroup] = useState<'current' | 'alumni' | 'all'>('current')
  const [students, setStudents] = useState<Student[]>([])
  const [alumniStudents, setAlumniStudents] = useState<StudentWithAlumni[]>([])
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [className, setClassName] = useState('')
  const [academicYear, setAcademicYear] = useState('')
  const [guardianName, setGuardianName] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [studentIdFilter, setStudentIdFilter] = useState('')
  const [alumniIdFilter, setAlumniIdFilter] = useState('')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [classError, setClassError] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setSubmittedQuery(query.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [query])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const filters = {
        query: submittedQuery || undefined,
        class_name: className || undefined,
        academic_year: academicYear.trim() || undefined,
        guardian_name: guardianName.trim() || undefined,
        guardian_phone: guardianPhone.trim() || undefined,
        student_id: studentIdFilter ? Number(studentIdFilter) : undefined,
        alumni_id: alumniIdFilter ? Number(alumniIdFilter) : undefined,
      }
      if (studentGroup === 'all') {
        setStudents(await api.listStudents({ ...filters, skip: page * pageSize, limit: pageSize }))
        setAlumniStudents([])
      } else {
        const entries = await api.listStudentsWithAlumni(filters)
        const matches = entries.filter((entry) => studentGroup === 'alumni' ? entry.alumni !== null : entry.alumni === null)
        setStudents([])
        setAlumniStudents(matches)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load students.')
    } finally {
      setLoading(false)
    }
  }, [academicYear, alumniIdFilter, className, guardianName, guardianPhone, page, studentGroup, studentIdFilter, submittedQuery])

  const loadClasses = useCallback(async () => {
    try {
      setClasses(await api.listAllClasses())
      setClassError('')
    } catch (reason) {
      setClassError(reason instanceof Error ? reason.message : 'Could not load the class filter.')
    }
  }, [])

  useLoadEffect(load, refreshKey)
  useLoadEffect(loadClasses, 0)

  const filtersChanged = (update: () => void) => {
    update()
    setPage(0)
  }
  const clearFilters = () => {
    setQuery('')
    setSubmittedQuery('')
    setClassName('')
    setAcademicYear('')
    setGuardianName('')
    setGuardianPhone('')
    setStudentIdFilter('')
    setAlumniIdFilter('')
    setPage(0)
  }
  const hasFilters = Boolean(query || className || academicYear || guardianName || guardianPhone || studentIdFilter || alumniIdFilter)
  const additionalFilterCount = [guardianName, guardianPhone, studentIdFilter, alumniIdFilter].filter(Boolean).length
  const activeFilters = [
    query && { label: `Search: ${query}`, clear: () => { setQuery(''); setSubmittedQuery('') } },
    className && { label: `Class: ${className}`, clear: () => setClassName('') },
    academicYear && { label: `Year: ${academicYear}`, clear: () => setAcademicYear('') },
    guardianName && { label: `Guardian: ${guardianName}`, clear: () => setGuardianName('') },
    guardianPhone && { label: `Phone: ${guardianPhone}`, clear: () => setGuardianPhone('') },
    studentIdFilter && { label: `Student ID: ${studentIdFilter}`, clear: () => setStudentIdFilter('') },
    alumniIdFilter && { label: `Alumni ID: ${alumniIdFilter}`, clear: () => setAlumniIdFilter('') },
  ].filter((filter): filter is { label: string; clear: () => void } => Boolean(filter))
  const visibleStudents = studentGroup === 'all'
    ? students.map((student) => ({ student, alumni: null }))
    : alumniStudents.slice(page * pageSize, (page + 1) * pageSize)
  const totalInGroup = studentGroup === 'all' ? undefined : alumniStudents.length

  return (
    <>
      <PageHeading
        eyebrow="People · student records"
        title="Students"
        description="Search the registry, explore academic records, and keep family details current."
        action={<div className="button-row"><button className="button button-outline" onClick={onCreateAlumni}><span aria-hidden="true">＋</span> Add alumni</button><button className="button button-primary" onClick={onCreate}><span aria-hidden="true">＋</span> Add student</button></div>}
      />
      <div className="student-groups" role="group" aria-label="Student record views">
        {([
          ['current', 'Current student'],
          ['alumni', 'Alumni record'],
          ['all', 'All student'],
        ] as const).map(([group, label]) => (
          <button
            key={group}
            className={studentGroup === group ? 'student-group active' : 'student-group'}
            aria-pressed={studentGroup === group}
            onClick={() => filtersChanged(() => setStudentGroup(group))}
          >
            {label}
            {group === studentGroup && !loading && group !== 'all' && <span className="group-count">{alumniStudents.length}</span>}
          </button>
        ))}
      </div>
      {studentGroup !== 'all' && <p className="student-group-help">Views are based on the student's alumni record: current students have none; alumni have one.</p>}
      <section className="filter-panel" aria-label="Student search and filters">
        <div className="filter-panel-heading">
          <div>
            <h2>Find a student</h2>
            <p>Search by name or narrow the list with class and year filters.</p>
          </div>
          {hasFilters && <button className="filter-reset" onClick={clearFilters}>Clear all</button>}
        </div>
        <div className="filter-bar">
          <div className="filter-control filter-search-control">
            <label className="filter-label" htmlFor="student-search">Search students</label>
            <span className="filter-input-shell">
              <span className="filter-search-icon" aria-hidden="true">⌕</span>
              <input id="student-search" type="search" value={query} onChange={(event) => filtersChanged(() => setQuery(event.target.value))} placeholder="Name or guardian" />
              {query && <button className="search-clear" type="button" aria-label="Clear student search" onClick={() => filtersChanged(() => { setQuery(''); setSubmittedQuery('') })}>×</button>}
            </span>
          </div>
          <div className="filter-control">
            <label className="filter-label" htmlFor="student-class-filter">Class</label>
            <span className="filter-select-shell">
              <select id="student-class-filter" value={className} onChange={(event) => filtersChanged(() => setClassName(event.target.value))}>
                <option value="">All classes</option>
                {classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.name}>{schoolClass.name}</option>)}
              </select>
              <span className="filter-select-caret" aria-hidden="true">⌄</span>
            </span>
          </div>
          <div className="filter-control">
            <label className="filter-label" htmlFor="student-year-filter">Academic year</label>
            <span className="filter-select-shell">
              <YearSelect id="student-year-filter" className="student-year-select" includeAny value={academicYear} onChange={(value) => filtersChanged(() => setAcademicYear(value))} />
              <span className="filter-select-caret" aria-hidden="true">⌄</span>
            </span>
          </div>
          <details className="advanced-filters" onToggle={(event) => {
            const details = event.currentTarget
            if (details.open) window.setTimeout(() => details.querySelector('input')?.focus(), 0)
          }}>
            <summary>
              <span className="advanced-filter-icon" aria-hidden="true">＋</span>
              <span>More filters</span>
              {additionalFilterCount > 0 && <span className="advanced-filter-count">{additionalFilterCount}</span>}
              <span className="advanced-filter-caret" aria-hidden="true">⌄</span>
            </summary>
            <div className="advanced-filter-panel" aria-label="Additional student filters">
              <label>Guardian name<input value={guardianName} onChange={(event) => filtersChanged(() => setGuardianName(event.target.value))} placeholder="Enter a name" /></label>
              <label>Guardian phone<input type="tel" value={guardianPhone} onChange={(event) => filtersChanged(() => setGuardianPhone(event.target.value))} placeholder="Enter a phone number" /></label>
              <label>Student ID<input type="number" value={studentIdFilter} onChange={(event) => filtersChanged(() => setStudentIdFilter(event.target.value))} placeholder="Enter student ID" /></label>
              <label>Alumni ID<input type="number" value={alumniIdFilter} onChange={(event) => filtersChanged(() => setAlumniIdFilter(event.target.value))} placeholder="Enter alumni ID" /></label>
            </div>
          </details>
        </div>
        {activeFilters.length > 0 && (
          <div className="active-filter-list" aria-label="Active filters">
            {activeFilters.map((filter) => (
              <span className="active-filter-chip" key={filter.label}>
                {filter.label}
                <button type="button" aria-label={`Remove ${filter.label} filter`} onClick={() => filtersChanged(filter.clear)}>×</button>
              </span>
            ))}
          </div>
        )}
        <p className="filter-summary" aria-live="polite">
          Showing {visibleStudents.length} student{visibleStudents.length === 1 ? '' : 's'}
          {className ? ` · Class ${className}` : ''}
          {academicYear ? ` · ${academicYear}` : ''}
          {query ? ` · Search: “${query}”` : ''}
        </p>
      </section>
      {classError && <ErrorState message={`Class filters are unavailable: ${classError}`} onRetry={() => void loadClasses()} />}
      {error && <ErrorState message={error} onRetry={() => void load()} />}
      {loading ? <Loading label={studentGroup === 'all' ? 'Loading student records…' : 'Checking student alumni records…'} /> : visibleStudents.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'No matching records' : studentGroup === 'alumni' ? 'No alumni records yet' : studentGroup === 'current' ? 'No current students' : 'No students yet'}
          detail={hasFilters ? 'Try adjusting the search or filters.' : studentGroup === 'alumni' ? 'Students with an alumni record will appear here.' : studentGroup === 'current' ? 'Students without an alumni record will appear here.' : 'Add a student to start building your school registry.'}
          action={studentGroup === 'all' && !hasFilters && <button className="button button-primary" onClick={onCreate}>Add the first student</button>}
        />
      ) : (
        <>
          <div className="table-card">
            <div className="table-overflow">
              <table>
                <thead><tr><th>Student</th><th>Guardian</th><th>Guardian phone</th><th>Admission year</th>{studentGroup === 'alumni' && <><th>Passing year</th><th>Tag</th></>}<th>Actions</th></tr></thead>
                <tbody>
                  {visibleStudents.map(({ student, alumni }) => (
                    <tr key={student.id}>
                      <td><button className="person-link" onClick={() => onOpen(student)}><span className="avatar">{fullName(student).charAt(0).toUpperCase()}</span><span><strong>{fullName(student)}</strong><small>Student #{student.id}</small></span></button></td>
                      <td>{display(student.guardian_name)}</td>
                      <td>{display(student.guardian_phone)}</td>
                      <td>{display(student.admission_year)}</td>
                      {studentGroup === 'alumni' && <><td>{display(alumni?.passing_year)}</td><td>{display(alumni?.tag)}</td></>}
                      <td><button className="button button-quiet" onClick={() => onOpen(student)}>View <span aria-hidden="true">→</span></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={page} count={visibleStudents.length} onChange={setPage} />
          {totalInGroup !== undefined && <p className="student-group-summary">{totalInGroup} {studentGroup === 'alumni' ? 'alumni record' : 'current student'}{totalInGroup === 1 ? '' : 's'} matched</p>}
        </>
      )}
    </>
  )
}

export function StudentDetailPage({
  studentId,
  onBack,
  onEdit,
  onDelete,
  onAddRecord,
  onEditRecord,
  onDeleteRecord,
  onAddAlumni,
  onEditAlumni,
  refreshKey,
}: {
  studentId: number
  onBack: () => void
  onEdit: (student: StudentDetail) => void
  onDelete: (student: StudentDetail) => void
  onAddRecord: (studentId: number) => void
  onEditRecord: (record: AcademicRecord) => void
  onDeleteRecord: (record: AcademicRecord) => void
  onAddAlumni: (studentId: number) => void
  onEditAlumni: (record: AlumniRecord) => void
  refreshKey: number
}) {
  const [student, setStudent] = useState<StudentDetail | null>(null)
  const [history, setHistory] = useState<AcademicRecord[]>([])
  const [alumni, setAlumni] = useState<AlumniRecord | null>(null)
  const [section, setSection] = useState<'overview' | 'history' | 'alumni'>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [detail, records, alumniRecord] = await Promise.all([
        api.getStudent(studentId),
        api.listAcademicHistory(studentId),
        api.getAlumni(studentId),
      ])
      setStudent(detail)
      setHistory(records)
      setAlumni(alumniRecord)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load this student.')
    } finally {
      setLoading(false)
    }
  }, [studentId])

  useLoadEffect(load, refreshKey)

  return (
    <>
      {loading && <Loading label="Loading student profile…" />}
      {error && <ErrorState message={error} onRetry={() => void load()} />}
      {student && (
        <>
          <PageHeading
            eyebrow={`Student profile · #${student.id}`}
            title={fullName(student)}
            description="Personal information, academic history, and alumni record."
            back={onBack}
            backLabel="Back to students"
            action={<div className="button-row"><button className="button button-outline" onClick={() => onEdit(student)}>Edit profile</button><button className="button button-danger-outline" onClick={() => onDelete(student)}>Delete</button></div>}
          />
          <div className="profile-summary">
            <span className="profile-avatar">{fullName(student).charAt(0).toUpperCase()}</span>
            <div><strong>{fullName(student)}</strong><p>Student ID {student.id} <span className="dot-separator">·</span> Admission {display(student.admission_year)}</p></div>
          </div>
          <nav className="tabs" aria-label="Student record sections">
            {(['overview', 'history', 'alumni'] as const).map((tab) => <button key={tab} className={section === tab ? 'tab active' : 'tab'} aria-current={section === tab ? 'page' : undefined} onClick={() => setSection(tab)}>{tab === 'overview' ? 'Personal details' : tab === 'history' ? 'Academic history' : 'Alumni record'}</button>)}
          </nav>
          {section === 'overview' && (
            <section className="detail-grid">
              <DetailCard title="Student details">
                <Detail label="First name" value={student.first_name} />
                <Detail label="Middle name" value={student.middle_name} />
                <Detail label="Last name" value={student.last_name} />
                <Detail label="Admission year" value={student.admission_year} />
                <Detail label="Address" value={student.address} />
              </DetailCard>
              <DetailCard title="Family & guardian">
                <Detail label="Father's name" value={student.father_name} />
                <Detail label="Mother's name" value={student.mother_name} />
                <Detail label="Guardian" value={student.guardian_name} />
                <Detail label="Guardian phone" value={student.guardian_phone} />
              </DetailCard>
            </section>
          )}
          {section === 'history' && (
            <section className="section-card">
              <div className="section-head"><div><h2>Academic history</h2><p>Class and year are stored on each student academic record.</p></div><button className="button button-primary" onClick={() => onAddRecord(student.id)}>＋ Add record</button></div>
              {history.length === 0 ? <EmptyState title="No academic records" detail="Add a class and academic year to start this student's history." action={<button className="button button-primary" onClick={() => onAddRecord(student.id)}>Add academic record</button>} /> : (
                <div className="record-list">
                  {history.map((record) => <article className="record-row" key={record.id}>
                    <div className="record-mark" aria-hidden="true">▦</div>
                    <div className="record-main"><strong>{record.class_name}</strong><span>{record.academic_year} {record.section ? `· Section ${record.section}` : ''}</span></div>
                    <span className="record-meta">Roll {display(record.roll_number)} · {record.status}</span>
                    <div className="button-row"><button className="button button-quiet" onClick={() => onEditRecord(record)}>Edit</button><button className="button button-quiet danger-text" onClick={() => onDeleteRecord(record)}>Delete</button></div>
                  </article>)}
                </div>
              )}
            </section>
          )}
          {section === 'alumni' && (
            <section className="section-card">
              <div className="section-head"><div><h2>Alumni record</h2><p>Passing year, tag, and comments are maintained by the alumni API.</p></div>
                {alumni ? <button className="button button-outline" onClick={() => onEditAlumni(alumni)}>Edit record</button> : <button className="button button-primary" onClick={() => onAddAlumni(student.id)}>＋ Add alumni record</button>}
              </div>
              {!alumni ? <EmptyState title="No alumni record" detail="Create one when this student has alumni information to record." action={<button className="button button-primary" onClick={() => onAddAlumni(student.id)}>Add alumni record</button>} /> : (
                <div className="detail-grid">
                  <DetailCard title="Alumni information"><Detail label="Passing year" value={alumni.passing_year} /><Detail label="Tag" value={alumni.tag} /></DetailCard>
                  <DetailCard title="Comment"><p className="comment-value">{display(alumni.comment)}</p></DetailCard>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </>
  )
}
