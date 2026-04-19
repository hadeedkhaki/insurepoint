# inSUREd

ER insurance management platform for verifying patient coverage, estimating costs, and streamlining intake at the point of care.

## Features

- **Insurance card capture** — OCR-powered scanning (Tesseract.js) plus manual entry fallback
- **Patient registration & directory** — intake forms with draft persistence
- **Coverage lookup** — match scanned cards against the mock insurance database, surface copay/deductible for check-in collection
- **Patient queue & scan history** — track active visits and prior scans
- **Role-based auth** — session-timed login with audit logging
- **AI assist** — Anthropic SDK integration for card parsing and workflow help

## Tech Stack

- **Frontend:** React 19, React Router 7, Vite 8
- **Backend:** Express 5 (Node), Multer for uploads, Sharp for image processing
- **OCR:** Tesseract.js (`eng.traineddata` bundled)
- **AI:** `@anthropic-ai/sdk`
- **Lint:** ESLint 9

## Getting Started

```bash
npm install
npm run dev
```

This runs the Express API server and the Vite dev client concurrently.

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start API server + Vite client together |
| `npm run dev:client` | Vite client only |
| `npm run dev:server` | Express server only |
| `npm run build` | Production build |
| `npm run preview` | Preview built bundle |
| `npm run lint` | Run ESLint |

### Environment

Create a `.env` file in the project root:

```
ANTHROPIC_API_KEY=your_key_here
```

## Project Structure

```
server/           Express API (auth, uploads, coverage lookup, audit)
src/
  components/    UI (Dashboard, Scan, Registration, Queue, ...)
  context/       AuthContext — session + role state
  data/          Mock users and insurance cards
public/          Static assets
```

## Data

The app ships with mock datasets used for development and demo:

- `src/data/mockUsers.json` — staff accounts and roles
- `src/data/cards_by_member_id.json` — sample member card lookups with coverage details

## License

Private / unreleased.
