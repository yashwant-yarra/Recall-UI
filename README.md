# Recall UI

The browser frontend for [Recall](https://github.com/yashwant-yarra/Recall): upload documents, record voice notes, ask questions with cited answers, and run an agent that asks before it acts.

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Firebase Auth

## Screens

- **Library:** upload PDF, DOCX, TXT or audio, or record a voice note in the browser. Files go straight to Cloud Storage through a signed URL; the list refreshes until processing finishes, then shows each voice note's summary, action items and topics.
- **Ask:** streamed answers from your own files, with numbered citations (page, or voice note).
- **Agent:** give a goal and watch each tool step stream in; creating a task or saving a draft waits for your Approve / Reject.
- **Account:** your plan and daily limits; Upgrade to Pro opens Razorpay's hosted checkout and the page updates when the payment webhook lands.

## How it talks to the API

- Every request carries `Authorization: Bearer <Firebase ID token>`; the API verifies it.
- Streams (`/ask`, the agent) are POST requests read with `fetch()` and a stream reader, because `EventSource` can't send POST bodies or an `Authorization` header.
- Uploads are two steps: `POST /api/v1/files` returns a signed URL and the exact headers it was signed with; the browser `PUT`s the bytes to Cloud Storage with those headers.
- The app is a client app (`'use client'`) that calls the API directly from the browser, so long streams never pass through a serverless function's time limit.

## Run locally

```bash
cp .env.example .env.local   # then fill in the values
npm install
npm run dev                  # http://localhost:3000
```

All variables are `NEXT_PUBLIC_` and end up in the browser bundle, so none may be secret (the Firebase web config is public by design). The API must allow the UI's origin in `CORS_ORIGINS`, and the bucket's CORS policy must allow `PUT` from it.

To point at a local API instead: `NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev`.

## Checks

```bash
npx tsc --noEmit && npm run lint && npm run build
```
