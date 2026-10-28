import { useState, type FormEvent } from 'react'
import { api, type AcademicRecord, type SchoolClass, type Student, type StudentDetail } from '../../services/api'
import { useDialogFocus } from '../../hooks/useDialogFocus'
import { EmptyState, ErrorState } from '../../components/feedback'
import { YearSelect } from '../../components/YearSelect'
import { fullName } from '../../utils/student'

type PromotionRow = {
  student: StudentDetail
  sourceRecord: AcademicRecord
  nextRoll: string
  status: 'ready' | 'done' | 'already'
}

async function getClassRoster(className: string, academicYear: string): Promise<StudentDetail[]> {
  const summaries: Student[] = []
  for (let skip = 0; ; skip += 100) {
    const page = await api.listStudents({ class_name: className, academic_year: academicYear, skip, limit: 100 })
    summaries.push(...page)
    if (page.length < 100) break
  }

  const details: StudentDetail[] = []
  for (let index = 0; index < summaries.length; index += 20) {
    const batch = summaries.slice(index, index + 20)
    details.push(...await Promise.all(batch.map((student) => api.getStudent(student.id))))
  }

  return details
}

export function PromotionModal({
  classes,
  onClose,
  onComplete,
}: {
  classes: SchoolClass[]
  onClose: () => void
  onComplete: (count: number) => void
}) {
  const [currentClass, setCurrentClass] = useState('')
  const [nextClass, setNextClass] = useState('')
  const [currentYear, setCurrentYear] = useState('')
  const [nextYear, setNextYear] = useState('')
  const [rows, setRows] = useState<PromotionRow[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loadingRoster, setLoadingRoster] = useState(false)
  const [existingRolls, setExistingRolls] = useState<Set<string>>(new Set())
  const dialogRef = useDialogFocus(busy || loadingRoster, onClose)

  async function loadPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (currentClass === nextClass && currentYear === nextYear) {
      setError('Choose a different class or academic year for the new record.')
      return
    }

    setLoadingRoster(true)
    setError('')
    setRows(null)
    try {
      const [sourceStudents, nextClassStudents] = await Promise.all([
        getClassRoster(currentClass, currentYear),
        getClassRoster(nextClass, nextYear),
      ])
      const targetRecords = nextClassStudents.flatMap((student) => student.academic_records.filter(
        (record) => record.class_name === nextClass && record.academic_year === nextYear,
      ))
      const targetByStudent = new Map(targetRecords.map((record) => [record.student_id, record]))
      const usedRolls = new Set(targetRecords.map((record) => record.roll_number?.trim()).filter((roll): roll is string => Boolean(roll)))
      setExistingRolls(usedRolls)

      const sourceRecords = sourceStudents.flatMap((student) => {
        const record = student.academic_records.find((item) => item.class_name === currentClass && item.academic_year === currentYear)
        return record ? [{ student, record }] : []
      }).sort((left, right) => {
        const leftRoll = Number(left.record.roll_number)
        const rightRoll = Number(right.record.roll_number)
        const bothNumeric = Number.isSafeInteger(leftRoll) && Number.isSafeInteger(rightRoll)
        return bothNumeric && leftRoll !== rightRoll
          ? leftRoll - rightRoll
          : fullName(left.student).localeCompare(fullName(right.student))
      })

      const numericRolls = targetRecords.map((record) => Number(record.roll_number)).filter(Number.isSafeInteger)
      let nextRoll = numericRolls.length ? Math.max(...numericRolls) + 1 : 1
      setRows(sourceRecords.map(({ student, record }) => {
        const existing = targetByStudent.get(student.id)
        return {
          student,
          sourceRecord: record,
          nextRoll: existing?.roll_number ?? String(nextRoll++),
          status: existing ? 'already' : 'ready',
        }
      }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load the source and next-class rosters.')
    } finally {
      setLoadingRoster(false)
    }
  }

  async function submitPromotion() {
    if (!rows) return
    const pending = rows.filter((row) => row.status === 'ready')
    if (pending.length === 0) {
      onComplete(rows.length)
      return
    }

    const assignedRolls = pending.map((row) => row.nextRoll.trim())
    if (assignedRolls.some((roll) => !roll)) {
      setError('Enter a roll number for each student before promoting.')
      return
    }
    if (new Set(assignedRolls).size !== assignedRolls.length) {
      setError('Each student must have a unique next-class roll number.')
      return
    }
    if (assignedRolls.some((roll) => existingRolls.has(roll))) {
      setError('One or more assigned roll numbers are already used in the next class and year.')
      return
    }

    setBusy(true)
    setError('')
    let completed = 0
    try {
      for (const row of pending) {
        const latest = await api.getStudent(row.student.id)
        const existing = latest.academic_records.find(
          (record) => record.class_name === nextClass && record.academic_year === nextYear,
        )
        if (existing) {
          setRows((current) => current?.map((item) => item.student.id === row.student.id
            ? { ...item, nextRoll: existing.roll_number ?? item.nextRoll, status: 'already' }
            : item) ?? null)
          if (existing.roll_number?.trim()) {
            setExistingRolls((current) => new Set(current).add(existing.roll_number!.trim()))
          }
          continue
        }

        await api.createAcademicRecord(row.student.id, {
          student_id: row.student.id,
          class_name: nextClass,
          academic_year: nextYear,
          roll_number: row.nextRoll.trim(),
          section: null,
          status: 'active',
        })
        completed += 1
        setRows((current) => current?.map((item) => item.student.id === row.student.id
          ? { ...item, status: 'done' }
          : item) ?? null)
        setExistingRolls((current) => new Set(current).add(row.nextRoll.trim()))
      }

      onComplete(completed)
    } catch (reason) {
      setError(`Promotion stopped after ${completed} new record${completed === 1 ? '' : 's'} were saved. The previous class records are unchanged. Retry to continue with the remaining students. ${reason instanceof Error ? reason.message : 'Could not create an academic record.'}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy && !loadingRoster) onClose() }}>
      <section ref={dialogRef} className="modal-card" role="dialog" aria-modal="true" aria-labelledby="promotion-title">
        <div className="modal-head">
          <div><span className="eyebrow">Academic year transition</span><h2 id="promotion-title">Promote students</h2></div>
          <button className="icon-button" aria-label="Close dialog" disabled={busy || loadingRoster} onClick={onClose}>×</button>
        </div>
        {rows === null ? (
          <form className="form-stack" onSubmit={(event) => void loadPreview(event)}>
            <p className="modal-description">Choose the source and destination class/year to review the full roster and assign next-class roll numbers.</p>
            <div className="modal-fields promotion-fields">
              <label>Current class<select required value={currentClass} onChange={(event) => setCurrentClass(event.target.value)}><option value="">Choose a class</option>{classes.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
              <label>Next class<select required value={nextClass} onChange={(event) => setNextClass(event.target.value)}><option value="">Choose a class</option>{classes.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
              <label>Current academic year<YearSelect required value={currentYear} onChange={setCurrentYear} /></label>
              <label>Next academic year<YearSelect required value={nextYear} onChange={setNextYear} /></label>
            </div>
            {error && <ErrorState message={error} />}
            <div className="modal-actions"><button type="button" className="button button-outline" disabled={loadingRoster} onClick={onClose}>Cancel</button><button className="button button-primary" disabled={loadingRoster}>{loadingRoster ? 'Loading roster…' : 'Review students'}</button></div>
          </form>
        ) : (
          <div className="form-stack">
            <p className="modal-description">
              {currentClass} · {currentYear} → {nextClass} · {nextYear}. The source academic records will be kept; promotion adds a separate record for the next class.
            </p>
            {rows.length === 0 ? (
              <EmptyState title="No students to promote" detail={`No students were found in ${currentClass} for ${currentYear}.`} />
            ) : (
              <div className="table-overflow">
                <table>
                  <thead><tr><th>Student</th><th>Current roll</th><th>Next-class roll</th><th>Status</th></tr></thead>
                  <tbody>
                    {rows.map((row) => <tr key={row.student.id}>
                      <td><strong>{fullName(row.student)}</strong><small className="block text-[#929d96]">ID #{row.student.id}</small></td>
                      <td>{row.sourceRecord.roll_number || '—'}</td>
                      <td>{row.status === 'ready'
                        ? <label><span className="sr-only">Next roll number for {fullName(row.student)}</span><input className="w-24 rounded border border-[#e2e8e2] px-2 py-1" inputMode="numeric" value={row.nextRoll} onChange={(event) => setRows((current) => current?.map((item) => item.student.id === row.student.id ? { ...item, nextRoll: event.target.value } : item) ?? null)} /></label>
                        : row.nextRoll || '—'}</td>
                      <td>{row.status === 'already' ? 'Already in next class' : row.status === 'done' ? 'Promoted' : 'Ready'}</td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
            )}
            {error && <ErrorState message={error} />}
            <div className="modal-actions">
              <button type="button" className="button button-outline" disabled={busy} onClick={() => { setRows(null); setError('') }}>Change classes / years</button>
              {rows.length === 0
                ? <button type="button" className="button button-primary" onClick={onClose}>Done</button>
                : rows.some((row) => row.status === 'ready')
                  ? <button type="button" className="button button-primary" disabled={busy} onClick={() => void submitPromotion()}>{busy ? 'Promoting…' : 'Promote reviewed students'}</button>
                  : <button type="button" className="button button-primary" onClick={onClose}>Done</button>}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
