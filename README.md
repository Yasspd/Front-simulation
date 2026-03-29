# Front Simulation

Фронтенд-визуализация для backend-проекта `business _model`.

Это не второй движок симуляции в браузере. Фронт запускает backend run, получает полный timeline и затем локально проигрывает его на canvas с интерполяцией между шагами.

## Что умеет интерфейс

- fullscreen canvas в тёмном neon/glass стиле
- запуск backend simulation
- local playback: пуск, пауза, сброс, scrubber, шаг назад/вперёд
- injection события в текущий playback-step
- analysis controls для `causal`, `robust`, `uncertainty`
- analysis / decision panel
- runs browser для последних запусков и загрузки `latest`

## Архитектура

- `app/api/simulation-api.js`
  HTTP transport layer
- `app/state/session-store.js`
  маленькое хранилище состояния
- `app/session/simulation-session.js`
  session manager, backend requests, playback state, recent runs
- `app/session/playback-selectors.js`
  строит interpolated playback snapshot
- `app/renderer/canvas-renderer.js`
  отвечает только за canvas rendering и camera controls
- `app/ui/control-panel.js`
  параметры запуска, analysis controls, runs browser
- `app/ui/stats-overlay.js`
  compact telemetry HUD
- `app/ui/analysis-panel.js`
  robust / causal / uncertainty explanation layer
- `app/ui/timeline-panel.js`
  local playback timeline

## Backend contract

Фронт ожидает backend endpoints:

- `GET /simulation/scenarios`
- `GET /simulation/latest`
- `GET /simulation/runs`
- `GET /simulation/runs/:runId`
- `POST /simulation/run`

`analysisOptions` отправляются только если пользователь их включил. Без analysis flags backend вызывается как раньше.

## Как запускать локально

Backend:

```bash
cd "d:\It_package\Project\business _model"
npm run start:dev
```

Frontend:

```bash
cd "d:\It_package\Project\Front-simulation"
node server.js
```

или:

```bash
npm start
```

По умолчанию фронт открывается на:

```text
http://127.0.0.1:4173
```

Backend origin берётся из:

- `window.__SIMULATION_BACKEND_ORIGIN__`
- или `<meta name="simulation-backend-origin" ...>`

Для static deploy достаточно выставить backend URL в `index.html`.

## Честная semantics UI

- recommendation — это `simulation recommendation`, а не real-world guarantee
- causal panel — это `interventional estimate inside model`, а не external causal proof
- uncertainty — это `empirical interval` / `seeded simulation spread`, а не strict confidence proof
- analysis panel не меняет raw simulation result, а только объясняет уже построенный run
