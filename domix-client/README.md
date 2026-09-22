# DOMIX Client

React 19 frontend for the DOMIX platform, built with Vite 8.

## Requirements

- Node.js 20 or newer
- npm

## Development

```bash
npm install
npm run dev
```

Vite prints the local development URL after startup.

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server with hot reload |
| `npm run build` | Create a production build in `dist/` |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview the production build locally |

## Container build

From the repository root:

```bash
docker build -t domix-client ./domix-client
docker run --rm -p 8080:80 domix-client
```

Then open `http://localhost:8080`.

## Project status

The client is currently an early-stage scaffold. Screens, API integration, authentication state, error handling, and automated tests are planned as the product is developed.
