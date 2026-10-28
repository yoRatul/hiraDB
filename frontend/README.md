# hiraDB frontend

Responsive React + TypeScript + Vite workspace styled with Tailwind CSS for the existing hiraDB API. The browser talks to FastAPI over HTTP; it does not connect to PostgreSQL.

## Run locally

1. Start the existing FastAPI backend on `http://localhost:8000` using the backend project's usual run command.
2. In this directory, install dependencies and start Vite:

   ```sh
   npm ci
   cp .env.example .env.local
   npm run dev
   ```

3. Open the Vite URL printed in the terminal (normally `http://localhost:5173`).

Vite proxies `/api/v1` to `http://localhost:8000` in development. This keeps local browser requests same-origin and avoids requiring a backend CORS change. The health endpoint remains available at `http://localhost:8000/health`, and the backend API docs are at `http://localhost:8000/docs`.

## Configuration

`VITE_API_BASE_URL` sets the API base URL, including `/api/v1`. The development default is `/api/v1`, which uses the Vite proxy above. To call a different backend directly, set the variable in `.env.local`, for example:

```dotenv
VITE_API_BASE_URL=https://api.example.test/api/v1
```

For a deployed frontend, configure an API URL reachable from the browser and ensure the backend permits that frontend origin, or serve the frontend and API behind the same origin. Vite's development proxy is not a production proxy.

## Project structure

```text
src/
  app/
    pages/      Overview, students, classes, teachers, and auth screens
    App.tsx     App-level navigation, dialogs, and cross-page actions
    types.ts    Shared page/navigation types
  components/   Shared UI, account control, year selectors, header and navigation
  hooks/        Reusable React hooks
  services/     Typed API client and API tests
  styles/       Tailwind entry point and application theme
  utils/        Shared formatting helpers
  main.tsx      React entry point
```

Each screen is maintained independently in `src/app/pages/`: `OverviewPage.tsx`, `StudentsPage.tsx`, `ClassesPage.tsx`, `TeachersPage.tsx`, and `AuthPage.tsx` (login and registration). Account actions are in `src/components/AccountMenu.tsx`; workspace navigation and the header are separate shared components.

Tailwind CSS v4 is enabled by the Vite plugin. Global styles import Tailwind in `src/styles/index.css`; reusable visual primitives use Tailwind utilities, while `src/styles/app.css` contains the existing responsive school-management theme.

## Features

- API-backed overview counts, fetched by paging through students, classes, and teachers.
- Sign-in and registration using `POST /auth/login` and `POST /auth/register`.
- Student search and filters, profile CRUD, academic-history CRUD, and alumni create/update. Add student can optionally assign a class and academic year in the same workflow, with the next numeric roll number suggested from that class/year's existing academic records. The Add alumni flow collects a full student profile plus passing year, tag, and comment, then creates the student and attaches its alumni record.
- Academic years use dropdowns with single-year values (for example, `2025`, `2026`, `2027`), including upcoming and previous years; admission and passing years use calendar-year dropdowns. The selected values are still sent using the backend's existing string and integer fields.
- Student directory views for current students (no alumni record), alumni records, and all students. Search is debounced, filters can be cleared together, and class/year filters are visible in the filter panel. Since the API has no global alumni list, filtered views page through students and check each student's alumni endpoint.
- Class CRUD through the standalone `/classes/` API. Each class card opens its roster directly and shows a current-calendar-year student count. Class rosters default to the current academic year and use the student list filters `class_name` and `academic_year`.
- Unsigned visitors only see the sign-in/registration landing page. Successful sign-in opens the overview; successful registration automatically signs in and opens the overview. The signed-in email is remembered in local storage so reopening the app does not require another sign-in; sign-out clears it. This is a frontend access gate only: the verified backend OpenAPI has no protected routes, so it is not a security boundary for direct API access.
- Responsive navigation moves to a labeled bottom bar on phones; the workspace keeps the sidebar on larger screens. Class roster pages have a horizontally scrollable class switcher for quick movement between classes.
- Student promotion previews the full source-class/year roster, suggests unique next-class roll numbers, and lets staff edit them before saving. It creates a new academic-history record for each student using the existing per-student academic-history endpoint; the prior class/year entry is left intact as history. Existing destination records are detected and skipped, and partial failures can be retried without duplicating successful entries. The API client's verified `POST /students/promote` route remains available, but this custom-roll workflow uses academic-history creation because the promotion route has no per-student roll-number input.
- Teacher list, detail, create, update, and delete.
- Backend health status through `GET /health`.

API list requests use `skip`/`limit` and never request more than 100 records per page. Deletes handle `204 No Content`; FastAPI validation details and network errors are shown in the UI.

## Authentication and API limitations

The verified OpenAPI defines login as returning an access token, but declares no security schemes, protected operations, or documented session expiration. The frontend does not persist or send that token. It remembers only the sign-in email until explicit sign-out; direct API access is not protected by the backend.

After a successful sign-in, the Account page shows the email submitted at login and the remembered sign-in status. The backend has no current-user/profile endpoint, so no additional profile details are available. The top account menu includes a sign-out action.

The verified API exposes alumni data only through per-student `GET /students/{student_id}/alumni`, `POST`, and `PATCH` routes. It has no global alumni-list endpoint, so no backend route was added; query a student's detail/alumni endpoint or use the existing student `alumni_id` filter instead. Alumni also has no delete endpoint.

The class directory is a separate API resource from courses. Student-to-class membership is not a class foreign-key relation; it is represented by academic-history `class_name` and `academic_year` fields, so roster views use those existing student filters. The interface does not offer unsupported operations or invent class data.

## Checks

```sh
npm run typecheck
npm test
npm run lint
npm run build
```
