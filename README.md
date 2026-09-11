# NomadJarvis

Personal AI production workspace with three launch areas:

- **Chat & Research** — OpenAI Responses API + web search
- **AI Video Studio** — image analysis -> editable cinematic prompt -> approval gate -> provider adapter
- **Motion Studio** — interview upload -> transcription -> timestamped motion-graphic suggestions

## Deploy on Cloudflare Pages

Build command:

    npm run build

Build output:

    dist

Add `OPENAI_API_KEY` as an **encrypted secret** in Cloudflare Pages:
Settings -> Variables and Secrets -> Add -> Encrypt.

Cloudflare Pages automatically maps files under `/functions` to server routes.

## Current API routes

- `POST /api/chat`
- `POST /api/video-prompt`
- `POST /api/motion-plan`
- `POST /api/video-generate`

`video-generate` intentionally returns a setup message until a supported video provider is configured.
