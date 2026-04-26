# Smart Garden — Frontend App

## Stack

- **Build tool:** Vite
- **UI framework:** React 18
- **Estils:** TailwindCSS
- **Gràfics:** Recharts
- **Estat servidor:** React Query (TanStack Query)
- **HTTP client:** Axios
- **Routing:** React Router DOM
- **Estil visual:** Inspirat en TailAdmin — paleta verda/natura, dark mode opcional

---

## Pàgines (`src/pages/`)

### `Dashboard.jsx`
Estat en temps real de totes les zones via WebSocket (`/ws/status`):
- Humitat actual de cada zona (indicadors visuals)
- Temperatura i humitat ambient
- Botó de reg manual per zona
- Indicador d'últim reg i proper reg programat

### `History.jsx`
Gràfics interactius (Recharts) de:
- Lectures d'humitat de terra per zona i rang de dates
- Events de reg (durada, trigger)
- Filtres per zona i període de temps

### `Zones.jsx`
Configuració de cada zona:
- Nom i estat (activa/inactiva)
- Sensors associats
- Llindar d'humitat mínim i màxim
- Temperatura màxima per regar
- Programes de reg (horari, dies, durada)
- Cooldown entre regs

### `Alerts.jsx`
- Llistat d'alertes actives i resoltes
- Configuració de notificacions (email / Telegram)
- Marcar alertes com a resoltes

---

## Client API (`src/api/`)

Totes les crides al backend centralitzades aquí:
- `httpClient.js` — instància Axios configurada amb base URL i interceptors
- `wsClient.js` — client WebSocket amb reconnexió automàtica
- `zones.js`, `sensors.js`, `schedules.js`, `alerts.js` — funcions per endpoint

---

## Variables d'entorn

```
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws/status
```
