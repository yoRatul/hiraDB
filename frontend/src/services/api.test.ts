import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('typed API client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('uses the verified student list filters and bounded pagination', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]))

    await api.listStudents({
      skip: 25,
      limit: 25,
      query: 'Amina Rahman',
      class_name: 'Class 4',
      academic_year: '2025-2026',
      student_id: 17,
      alumni_id: 3,
      guardian_name: 'Samira',
      guardian_phone: '555 0100',
    })

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/students/?skip=25&limit=25&query=Amina+Rahman&class_name=Class+4&academic_year=2025-2026&student_id=17&alumni_id=3&guardian_name=Samira&guardian_phone=555+0100',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('sends the promotion fields as the required query parameters', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]))

    await api.promoteStudents({
      current_class: 'Class 3',
      next_class: 'Class 4',
      current_year: '2025-2026',
      next_year: '2026-2027',
    })

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/students/promote?current_class=Class+3&next_class=Class+4&current_year=2025-2026&next_year=2026-2027',
      expect.objectContaining({ method: 'POST', body: undefined }),
    )
  })

  it('treats a 204 delete response as a successful empty result', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))

    await expect(api.deleteStudent(12)).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/students/12',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('surfaces FastAPI field validation details', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({
      detail: [{ loc: ['body', 'email'], msg: 'value is not a valid email address', type: 'value_error' }],
    }, 422))

    await expect(api.login({ email: 'bad', password: 'pass' })).rejects.toThrow('email: value is not a valid email address')
  })

  it('uses the registration contract without adding token behavior', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ id: 8, email: 'admin@example.com', is_active: true }, 201))

    await api.register({ email: 'admin@example.com', password: 'secret' })

    expect(fetch).toHaveBeenCalledWith('/api/v1/auth/register', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'secret' }),
    }))
  })

  it('does not send a bearer token to routes the OpenAPI leaves unprotected', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]))

    await api.listClasses()

    const [, options] = vi.mocked(fetch).mock.calls[0]
    expect(options?.headers).toBeUndefined()
  })

  it('reports network failures with an actionable message', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('fetch failed'))

    await expect(api.listClasses()).rejects.toThrow('Check that the backend is running.')
  })

  it('covers every operation declared by the FastAPI OpenAPI document', async () => {
    vi.mocked(fetch).mockImplementation(async (_input, init) => {
      if (init?.method === 'DELETE') return new Response(null, { status: 204 })
      const status = init?.method === 'POST' && !String(_input).includes('/students/promote')
        ? 201
        : 200
      return jsonResponse({}, status)
    })

    const calls: Array<[string, () => Promise<unknown>]> = [
      ['POST /api/v1/auth/register', () => api.register({ email: 'a@b.test', password: 'pass' })],
      ['POST /api/v1/auth/login', () => api.login({ email: 'a@b.test', password: 'pass' })],
      ['POST /api/v1/students/', () => api.createStudent({ first_name: 'A', last_name: 'B' })],
      ['GET /api/v1/students/', () => api.listStudents()],
      ['GET /api/v1/students/search?q=A', () => api.searchStudents('A')],
      ['GET /api/v1/students/4', () => api.getStudent(4)],
      ['PATCH /api/v1/students/4', () => api.updateStudent(4, { first_name: 'A' })],
      ['DELETE /api/v1/students/4', () => api.deleteStudent(4)],
      ['GET /api/v1/students/4/academic-history', () => api.listAcademicHistory(4)],
      ['POST /api/v1/students/4/academic-history', () => api.createAcademicRecord(4, {
        student_id: 4, academic_year: '2025-2026', class_name: 'Class 4',
      })],
      ['PATCH /api/v1/students/academic-history/8', () => api.updateAcademicRecord(8, { status: 'active' })],
      ['DELETE /api/v1/students/academic-history/8', () => api.deleteAcademicRecord(8)],
      ['GET /api/v1/students/4/alumni', () => api.getAlumni(4)],
      ['POST /api/v1/students/4/alumni', () => api.createAlumni(4, { student_id: 4 })],
      ['PATCH /api/v1/students/4/alumni', () => api.updateAlumni(4, { tag: 'alumni' })],
      ['POST /api/v1/students/promote?current_class=Class+3&next_class=Class+4&current_year=2025-2026&next_year=2026-2027', () => api.promoteStudents({
        current_class: 'Class 3', next_class: 'Class 4', current_year: '2025-2026', next_year: '2026-2027',
      })],
      ['POST /api/v1/teachers/', () => api.createTeacher({ full_name: 'A B', email: 'a@b.test' })],
      ['GET /api/v1/teachers/?skip=0&limit=100', () => api.listTeachers()],
      ['GET /api/v1/teachers/9', () => api.getTeacher(9)],
      ['PATCH /api/v1/teachers/9', () => api.updateTeacher(9, { full_name: 'A B' })],
      ['DELETE /api/v1/teachers/9', () => api.deleteTeacher(9)],
      ['POST /api/v1/classes/', () => api.createClass({ name: 'Class 4' })],
      ['GET /api/v1/classes/?skip=0&limit=100', () => api.listClasses()],
      ['GET /api/v1/classes/2', () => api.getClass(2)],
      ['PATCH /api/v1/classes/2', () => api.updateClass(2, { name: 'Class 5' })],
      ['DELETE /api/v1/classes/2', () => api.deleteClass(2)],
      ['GET /health', () => api.healthCheck()],
    ]

    for (const [, call] of calls) await call()

    const actual = vi.mocked(fetch).mock.calls.map(([url, init]) =>
      `${init?.method ?? 'GET'} ${String(url)}`,
    )
    expect(actual).toEqual(calls.map(([contract]) => contract))

    const expectedBodies = new Map<number, object>([
      [0, { email: 'a@b.test', password: 'pass' }],
      [1, { email: 'a@b.test', password: 'pass' }],
      [2, { first_name: 'A', last_name: 'B' }],
      [6, { first_name: 'A' }],
      [9, { student_id: 4, academic_year: '2025-2026', class_name: 'Class 4' }],
      [10, { status: 'active' }],
      [13, { student_id: 4 }],
      [14, { tag: 'alumni' }],
      [16, { full_name: 'A B', email: 'a@b.test' }],
      [19, { full_name: 'A B' }],
      [21, { name: 'Class 4' }],
      [24, { name: 'Class 5' }],
    ])
    for (const [index, [, init]] of vi.mocked(fetch).mock.calls.entries()) {
      const expected = expectedBodies.get(index)
      expect(init?.body).toBe(expected === undefined ? undefined : JSON.stringify(expected))
    }
  })

  it('requests health from the API host root, outside the /api/v1 prefix', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ status: 'ok' }))

    await expect(api.healthCheck()).resolves.toEqual({ status: 'ok' })
    expect(fetch).toHaveBeenCalledWith('/health', expect.objectContaining({ method: 'GET' }))
  })

  it('resolves alumni status per student using bounded list pages, not an invented global route', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input)
      if (url === '/api/v1/students/?skip=0&limit=100') {
        return jsonResponse([
          { id: 1, first_name: 'Current', last_name: 'Student' },
        ])
      }
      if (url === '/api/v1/students/1/alumni') {
        return jsonResponse({ student_id: 1, passing_year: null, tag: null, comment: null })
      }
      throw new Error(`Unexpected request: ${url}`)
    })

    await expect(api.listStudentsWithAlumni()).resolves.toEqual([
      {
        student: { id: 1, first_name: 'Current', last_name: 'Student' },
        alumni: { student_id: 1, passing_year: null, tag: null, comment: null },
      },
    ])
    expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/students/?skip=0&limit=100',
      '/api/v1/students/1/alumni',
    ])
  })
})
