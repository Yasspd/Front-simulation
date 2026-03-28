import { MODE_HINTS, PROFILE_HINTS } from '../config.js';
import {
  formatDecimal,
  humanizeBackendStatus,
  humanizeBackendStatusShort,
} from '../utils/formatters.js';

export class ControlPanel {
  constructor(root, store, session) {
    this.root = root;
    this.store = store;
    this.session = session;
    this.elements = this.captureElements();
    this.bindEvents();

    store.subscribe(() => this.render());
    session.subscribe(() => this.render());
  }

  captureElements() {
    return {
      backendStatusText: document.getElementById('backendStatusText'),
      backendStatusPill: document.getElementById('backendStatusPill'),
      floatingHint: document.getElementById('floatingHint'),
      errorPanel: document.getElementById('errorPanel'),
      modeChips: this.root.querySelectorAll('[data-settings-level]'),
      settingsPanels: this.root.querySelectorAll('[data-panel]'),
      modeSelect: document.getElementById('modeSelect'),
      profileSelect: document.getElementById('profileSelect'),
      entitiesRange: document.getElementById('entitiesRange'),
      entitiesValue: document.getElementById('entitiesValue'),
      speedRange: document.getElementById('speedRange'),
      speedValue: document.getElementById('speedValue'),
      scenarioSelect: document.getElementById('scenarioSelect'),
      stepsRange: document.getElementById('stepsRange'),
      stepsValue: document.getElementById('stepsValue'),
      seedInput: document.getElementById('seedInput'),
      entityLimitInput: document.getElementById('entityLimitInput'),
      eventIntensityRange: document.getElementById('eventIntensityRange'),
      eventIntensityValue: document.getElementById('eventIntensityValue'),
      eventRelevanceRange: document.getElementById('eventRelevanceRange'),
      eventRelevanceValue: document.getElementById('eventRelevanceValue'),
      eventScopeRange: document.getElementById('eventScopeRange'),
      eventScopeValue: document.getElementById('eventScopeValue'),
      eventStartStepInput: document.getElementById('eventStartStepInput'),
      eventDurationInput: document.getElementById('eventDurationInput'),
      eventXInput: document.getElementById('eventXInput'),
      eventYInput: document.getElementById('eventYInput'),
      showLinksToggle: document.getElementById('showLinksToggle'),
      showTrailsToggle: document.getElementById('showTrailsToggle'),
      showLabelsToggle: document.getElementById('showLabelsToggle'),
      showIdsToggle: document.getElementById('showIdsToggle'),
      showEventAuraToggle: document.getElementById('showEventAuraToggle'),
      showClusterRingToggle: document.getElementById('showClusterRingToggle'),
      showResidualToggle: document.getElementById('showResidualToggle'),
      showVelocityToggle: document.getElementById('showVelocityToggle'),
      loopToggle: document.getElementById('loopToggle'),
      armInjectToggle: document.getElementById('armInjectToggle'),
      linkDistanceRange: document.getElementById('linkDistanceRange'),
      linkDistanceValue: document.getElementById('linkDistanceValue'),
      nodeScaleRange: document.getElementById('nodeScaleRange'),
      nodeScaleValue: document.getElementById('nodeScaleValue'),
      startButton: document.getElementById('startButton'),
      pauseButton: document.getElementById('pauseButton'),
      resetButton: document.getElementById('resetButton'),
      restartButton: document.getElementById('restartButton'),
      latestButton: document.getElementById('latestButton'),
      injectButton: document.getElementById('injectButton'),
      centerEventButton: document.getElementById('centerEventButton'),
      randomEventButton: document.getElementById('randomEventButton'),
      stepBackButton: document.getElementById('stepBackButton'),
      stepForwardButton: document.getElementById('stepForwardButton'),
      profileHintCard: document.getElementById('profileHintCard'),
    };
  }

  bindEvents() {
    this.elements.modeChips.forEach((button) => {
      button.addEventListener('click', () => {
        this.session.updateConfig({
          ui: {
            settingsLevel: button.dataset.settingsLevel,
          },
        });
      });
    });

    this.elements.modeSelect.addEventListener('change', (event) => {
      this.session.updateConfig({ mode: event.target.value });
    });
    this.elements.profileSelect.addEventListener('change', (event) => {
      this.session.updateConfig({ profile: event.target.value });
    });
    this.elements.entitiesRange.addEventListener('input', (event) => {
      this.session.updateConfig({ entitiesCount: Number(event.target.value) });
    });
    this.elements.speedRange.addEventListener('input', (event) => {
      this.session.updateConfig({ speed: Number(event.target.value) });
    });
    this.elements.scenarioSelect.addEventListener('change', (event) => {
      this.session.updateConfig({ scenarioKey: event.target.value });
    });
    this.elements.stepsRange.addEventListener('input', (event) => {
      this.session.updateConfig({ steps: Number(event.target.value) });
    });
    this.elements.seedInput.addEventListener('change', (event) => {
      this.session.updateConfig({ seed: Number(event.target.value) });
    });
    this.elements.entityLimitInput.addEventListener('change', (event) => {
      this.session.updateConfig({ visibleEntityLimit: Number(event.target.value) });
    });

    this.bindEventOverrideInputs();
    this.bindRenderToggles();

    this.elements.startButton.addEventListener('click', () => {
      this.session.startSimulation();
    });
    this.elements.pauseButton.addEventListener('click', () => {
      this.session.togglePause();
    });
    this.elements.resetButton.addEventListener('click', () => {
      this.session.reset();
    });
    this.elements.restartButton.addEventListener('click', () => {
      this.session.restartSimulation();
    });
    this.elements.latestButton.addEventListener('click', () => {
      this.session.loadLatestRun();
    });
    this.elements.injectButton.addEventListener('click', () => {
      this.session.updateConfig({
        render: {
          armInject: !this.store.getState().config.render.armInject,
        },
      });
    });
    this.elements.centerEventButton.addEventListener('click', () => {
      this.session.injectEventAt({ x: 0.5, y: 0.5 });
    });
    this.elements.randomEventButton.addEventListener('click', () => {
      this.session.injectEventAt({ x: 0.5, y: 0.5 }, true);
    });
    this.elements.stepBackButton.addEventListener('click', () => {
      this.session.stepBy(-1);
    });
    this.elements.stepForwardButton.addEventListener('click', () => {
      this.session.stepBy(1);
    });
  }

  bindEventOverrideInputs() {
    const updateEventOverride = (patch) => {
      this.session.updateConfig({
        activeEventOverride: patch,
      });
    };

    this.elements.eventIntensityRange.addEventListener('input', (event) => {
      updateEventOverride({ intensity: Number(event.target.value) });
    });
    this.elements.eventRelevanceRange.addEventListener('input', (event) => {
      updateEventOverride({ relevance: Number(event.target.value) });
    });
    this.elements.eventScopeRange.addEventListener('input', (event) => {
      updateEventOverride({ scope: Number(event.target.value) });
    });
    this.elements.eventStartStepInput.addEventListener('change', (event) => {
      updateEventOverride({ startStep: Number(event.target.value) });
    });
    this.elements.eventDurationInput.addEventListener('change', (event) => {
      updateEventOverride({ duration: Number(event.target.value) });
    });
    this.elements.eventXInput.addEventListener('change', (event) => {
      updateEventOverride({ x: Number(event.target.value) });
    });
    this.elements.eventYInput.addEventListener('change', (event) => {
      updateEventOverride({ y: Number(event.target.value) });
    });
  }

  bindRenderToggles() {
    const toggleMap = [
      ['showLinksToggle', 'showLinks'],
      ['showTrailsToggle', 'showTrails'],
      ['showLabelsToggle', 'showLabels'],
      ['showIdsToggle', 'showIds'],
      ['showEventAuraToggle', 'showEventAura'],
      ['showClusterRingToggle', 'showClusterRing'],
      ['showResidualToggle', 'showResidualHints'],
      ['showVelocityToggle', 'showVelocityVectors'],
      ['loopToggle', 'loopPlayback'],
      ['armInjectToggle', 'armInject'],
    ];

    toggleMap.forEach(([elementKey, renderKey]) => {
      this.elements[elementKey].addEventListener('change', (event) => {
        this.session.updateConfig({
          render: {
            [renderKey]: event.target.checked,
          },
        });
      });
    });

    this.elements.linkDistanceRange.addEventListener('input', (event) => {
      this.session.updateConfig({
        render: {
          linkDistance: Number(event.target.value),
        },
      });
    });
    this.elements.nodeScaleRange.addEventListener('input', (event) => {
      this.session.updateConfig({
        render: {
          nodeScale: Number(event.target.value),
        },
      });
    });
  }

  render() {
    const state = this.store.getState();
    const playback = this.session.getPlaybackState();
    const { config } = state;

    this.elements.backendStatusText.textContent = humanizeBackendStatus(state.backendStatus);
    this.elements.backendStatusPill.textContent = humanizeBackendStatusShort(state.backendStatus);
    this.elements.backendStatusPill.dataset.status = state.backendStatus;

    this.elements.modeChips.forEach((button) => {
      button.classList.toggle('active', button.dataset.settingsLevel === config.ui.settingsLevel);
    });
    this.elements.settingsPanels.forEach((panel) => {
      panel.classList.toggle('hidden', panel.dataset.panel !== config.ui.settingsLevel);
    });

    this.elements.modeSelect.value = config.mode;
    this.elements.profileSelect.value = config.profile;
    this.elements.entitiesRange.value = String(config.entitiesCount);
    this.elements.entitiesValue.textContent = String(config.entitiesCount);
    this.elements.speedRange.value = String(config.speed);
    this.elements.speedValue.textContent = `${formatDecimal(config.speed, 2)}x`;
    this.elements.stepsRange.value = String(config.steps);
    this.elements.stepsValue.textContent = String(config.steps);
    this.elements.seedInput.value = String(config.seed);
    this.elements.entityLimitInput.value = String(config.visibleEntityLimit);
    this.elements.eventIntensityRange.value = String(config.activeEventOverride.intensity);
    this.elements.eventIntensityValue.textContent = formatDecimal(config.activeEventOverride.intensity, 2);
    this.elements.eventRelevanceRange.value = String(config.activeEventOverride.relevance);
    this.elements.eventRelevanceValue.textContent = formatDecimal(config.activeEventOverride.relevance, 2);
    this.elements.eventScopeRange.value = String(config.activeEventOverride.scope);
    this.elements.eventScopeValue.textContent = formatDecimal(config.activeEventOverride.scope, 2);
    this.elements.eventStartStepInput.value = String(config.activeEventOverride.startStep);
    this.elements.eventDurationInput.value = String(config.activeEventOverride.duration);
    this.elements.eventXInput.value = String(config.activeEventOverride.x);
    this.elements.eventYInput.value = String(config.activeEventOverride.y);

    this.elements.showLinksToggle.checked = config.render.showLinks;
    this.elements.showTrailsToggle.checked = config.render.showTrails;
    this.elements.showLabelsToggle.checked = config.render.showLabels;
    this.elements.showIdsToggle.checked = config.render.showIds;
    this.elements.showEventAuraToggle.checked = config.render.showEventAura;
    this.elements.showClusterRingToggle.checked = config.render.showClusterRing;
    this.elements.showResidualToggle.checked = config.render.showResidualHints;
    this.elements.showVelocityToggle.checked = config.render.showVelocityVectors;
    this.elements.loopToggle.checked = config.render.loopPlayback;
    this.elements.armInjectToggle.checked = config.render.armInject;
    this.elements.linkDistanceRange.value = String(config.render.linkDistance);
    this.elements.linkDistanceValue.textContent = formatDecimal(config.render.linkDistance, 2);
    this.elements.nodeScaleRange.value = String(config.render.nodeScale);
    this.elements.nodeScaleValue.textContent = formatDecimal(config.render.nodeScale, 2);

    this.renderScenarioOptions(state.scenarios, config.scenarioKey);
    this.renderProfileHint(config.profile, config.mode, state.run);
    this.renderButtons(playback);
    this.renderError(state.error);
  }

  renderScenarioOptions(scenarios, selectedKey) {
    if (!scenarios.length) {
      return;
    }

    const currentOptions = Array.from(this.elements.scenarioSelect.options).map(
      (option) => option.value,
    );
    const nextOptions = scenarios.map((scenario) => scenario.key);

    if (currentOptions.join('|') !== nextOptions.join('|')) {
      this.elements.scenarioSelect.innerHTML = scenarios
        .map((scenario) => `<option value="${scenario.key}">${scenario.name}</option>`)
        .join('');
    }

    this.elements.scenarioSelect.value = selectedKey;
  }

  renderProfileHint(profileKey, modeKey, run) {
    const profile = PROFILE_HINTS[profileKey];
    const snapshot = run?.configSnapshot;
    const liveConfig = snapshot
      ? `
      <div class="inline-note" style="margin-top: 10px;">
        Текущий снимок бэкенда: радиус кластера ${formatDecimal(snapshot.clusterRadius, 2)},
        визуальный порог hot ${formatDecimal(snapshot.visualHotThreshold, 2)},
        системный порог hot ${formatDecimal(snapshot.systemHotThreshold, 2)},
        таймлайн ${snapshot.storeTimeline ? 'сохраняется' : 'не сохраняется'}.
      </div>`
      : '';

    this.elements.profileHintCard.innerHTML = `
      <strong>${profile.title}</strong><br />
      ${profile.summary}
      <ul>
        ${profile.details.map((detail) => `<li>${detail}</li>`).join('')}
      </ul>
      <strong>Семантика режима:</strong> ${MODE_HINTS[modeKey]}
      <div class="inline-note" style="margin-top: 10px;">
        Пороги, охлаждение, отложенные эффекты и stress-memory сейчас управляются профилями бэкенда,
        а не публичным API прямых переопределений.
      </div>
      ${liveConfig}
    `;
  }

  renderButtons(playback) {
    const state = this.store.getState();
    const hasRun = Boolean(state.run);
    const injectArmed = state.config.render.armInject;
    const backendLocked = playback.isLoading;

    this.elements.pauseButton.textContent = playback.isPaused ? 'Продолжить' : 'Пауза';
    this.elements.injectButton.textContent = injectArmed
      ? 'Отменить событие'
      : 'Внести событие';
    this.elements.startButton.disabled = backendLocked;
    this.elements.pauseButton.disabled = !hasRun || playback.isLoading;
    this.elements.resetButton.disabled = !hasRun;
    this.elements.restartButton.disabled = backendLocked;
    this.elements.latestButton.disabled = backendLocked;
    this.elements.injectButton.disabled = backendLocked;
    this.elements.centerEventButton.disabled = backendLocked;
    this.elements.randomEventButton.disabled = backendLocked;
    this.elements.injectButton.classList.toggle('primary-button', injectArmed);
    this.elements.floatingHint.textContent = injectArmed
      ? 'Режим внедрения активирован. Клик по полю перезапустит бэкенд с текущего шага проигрывания.'
      : 'Проигрывание выполняется локально и мгновенно. Используйте внедрение события, чтобы перезапустить бэкенд с новым активным событием.';
  }

  renderError(error) {
    this.elements.errorPanel.classList.toggle('hidden', !error);
    this.elements.errorPanel.textContent = error;
  }
}
