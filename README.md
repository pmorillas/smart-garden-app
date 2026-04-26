# smart-garden-app

Frontend React del sistema de reg automàtic.

## Requisits

- Node.js 20+

## Córrer en local

```bash
npm install
cp .env.example .env.local
npm run dev
```

L'app queda disponible a `http://localhost:5173`.

## Build de producció

```bash
npm run build
```

O via Docker (servit per nginx al port 3000):

```bash
cd smart-garden/
docker compose up app
```

## Estructura

```
src/
├── main.jsx         — entrypoint
├── App.jsx          — routing
├── pages/           — Dashboard, History, Zones, Alerts
├── components/      — components reutilitzables
└── api/             — clients HTTP i WebSocket
```

Veure `CLAUDE.md` per a la documentació completa.
