import { SimulationApiClient } from './api/simulation-api.js';
import { INITIAL_APP_STATE } from './config.js';
import { CanvasRenderer } from './renderer/canvas-renderer.js';
import { buildPlaybackSnapshot } from './session/playback-selectors.js';
import { SimulationSession } from './session/simulation-session.js';
import { SessionStore } from './state/session-store.js';
import { ControlPanel } from './ui/control-panel.js';
import { StatsOverlay } from './ui/stats-overlay.js';
import { TimelinePanel } from './ui/timeline-panel.js';

const store = new SessionStore();
store.update(structuredClone(INITIAL_APP_STATE));

const session = new SimulationSession(store, new SimulationApiClient());
const renderer = new CanvasRenderer(document.getElementById('simulation-canvas'), (coordinates) => {
  if (!store.getState().config.render.armInject) {
    return;
  }

  session.injectEventAt(coordinates);
});

const controlPanel = new ControlPanel(document.getElementById('controlPanel'), store, session);
const statsOverlay = new StatsOverlay();
const timelinePanel = new TimelinePanel(session);

void session.bootstrap();

function frame(now) {
  session.update(now);

  const state = store.getState();
  const playback = session.getPlaybackState();
  const viewState = {
    ...state,
    playback,
  };
  const playbackSnapshot = buildPlaybackSnapshot(state.run, playback.currentStepFloat);

  renderer.render(viewState, playbackSnapshot);
  statsOverlay.render(viewState, playbackSnapshot);
  timelinePanel.render(viewState, playbackSnapshot);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

window.frontSimulation = {
  store,
  session,
  renderer,
  controlPanel,
};
