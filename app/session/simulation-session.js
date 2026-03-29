import { DEFAULT_CONFIG, MODE_HINTS } from '../config.js';
import { clamp, pickDefinedValues } from '../utils/formatters.js';

const DEFAULT_RATE_LIMIT_DELAY_MS = 5000;
const MAX_RATE_LIMIT_DELAY_MS = 15000;
const DEFAULT_RUNS_LIMIT = 8;

export class SimulationSession {
  constructor(store, apiClient) {
    this.store = store;
    this.apiClient = apiClient;
    this.playback = {
      currentStepFloat: 1,
      isRunning: false,
      isPaused: true,
      isLoading: false,
      isCompleted: false,
      lastFrameAt: 0,
      activeRequestKind: null,
      blockedUntil: 0,
      blockedRequestKind: null,
    };
    this.listeners = new Set();
    this.cooldownTimer = null;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.playback);

    return () => {
      this.listeners.delete(listener);
    };
  }

  notify() {
    this.listeners.forEach((listener) => listener(this.playback));
  }

  getPlaybackState() {
    return { ...this.playback };
  }

  getCooldownRemainingMs(now = Date.now()) {
    return Math.max(0, this.playback.blockedUntil - now);
  }

  hasCooldown(now = Date.now()) {
    return this.getCooldownRemainingMs(now) > 0;
  }

  getCooldownMessage() {
    const retryAfterSeconds = Math.ceil(this.getCooldownRemainingMs() / 1000);

    return `Новый запрос временно заблокирован. Повторите через ${retryAfterSeconds} сек.`;
  }

  scheduleCooldownRelease(delayMs) {
    if (this.cooldownTimer) {
      globalThis.clearTimeout(this.cooldownTimer);
    }

    this.cooldownTimer = globalThis.setTimeout(() => {
      this.cooldownTimer = null;

      if (this.hasCooldown()) {
        return;
      }

      this.playback = {
        ...this.playback,
        blockedUntil: 0,
        blockedRequestKind: null,
      };

      if (this.store.getState().backendStatus === 'rate_limited') {
        this.store.update({
          backendStatus:
            this.store.getState().scenarios.length > 0 || this.store.getState().run
              ? 'online'
              : 'connecting',
        });
      }

      this.notify();
    }, delayMs + 50);
  }

  beginRequest(requestKind) {
    this.playback = {
      ...this.playback,
      isLoading: true,
      isRunning: false,
      isPaused: true,
      isCompleted: false,
      lastFrameAt: 0,
      activeRequestKind: requestKind,
    };
    this.notify();
    this.store.update({
      backendStatus: 'loading',
      error: '',
    });
  }

  finishRequest(patch = {}) {
    this.playback = {
      ...this.playback,
      isLoading: false,
      activeRequestKind: null,
      ...patch,
    };
    this.notify();
  }

  applyRateLimit(error, fallbackMessage) {
    const retryAfterMsRaw =
      error instanceof Error &&
      'retryAfterMs' in error &&
      Number.isFinite(Number(error.retryAfterMs))
        ? Math.max(DEFAULT_RATE_LIMIT_DELAY_MS, Number(error.retryAfterMs))
        : DEFAULT_RATE_LIMIT_DELAY_MS;
    const retryAfterMs = Math.min(MAX_RATE_LIMIT_DELAY_MS, retryAfterMsRaw);
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
    const details =
      error instanceof Error && error.message ? error.message : fallbackMessage;
    const userMessage = `Слишком много запросов. Повторите через ${retryAfterSeconds} сек. ${details}`.trim();

    console.warn('[simulation-session] rate limited', {
      requestKind: this.playback.activeRequestKind,
      retryAfterMs,
      details,
    });

    this.store.update({
      backendStatus: 'rate_limited',
      error: userMessage,
    });

    this.finishRequest({
      isRunning: false,
      isPaused: true,
      blockedUntil: Date.now() + retryAfterMs,
      blockedRequestKind: this.playback.activeRequestKind ?? 'bootstrap',
      lastFrameAt: 0,
    });
    this.scheduleCooldownRelease(retryAfterMs);
  }

  handleRequestError(error, fallbackMessage) {
    const isRateLimited =
      error instanceof Error &&
      'status' in error &&
      Number(error.status) === 429;

    if (isRateLimited) {
      this.applyRateLimit(error, fallbackMessage);
      return;
    }

    this.store.update({
      backendStatus: 'offline',
      error: error instanceof Error ? error.message : fallbackMessage,
    });

    this.finishRequest({
      isRunning: false,
      isPaused: true,
      lastFrameAt: 0,
    });
  }

  canStartBackendRequest(requestKind) {
    if (this.playback.isLoading) {
      return false;
    }

    if (!this.hasCooldown()) {
      return true;
    }

    if (
      this.playback.blockedRequestKind &&
      this.playback.blockedRequestKind !== requestKind
    ) {
      return true;
    }

    this.store.update({
      backendStatus: 'rate_limited',
      error: this.getCooldownMessage(),
    });
    this.notify();

    return false;
  }

  async bootstrap() {
    try {
      const scenarios = await this.apiClient.fetchScenarios();

      this.store.update({
        scenarios,
        backendStatus: 'online',
        error: '',
      });

      if (!this.store.getState().config.scenarioKey && scenarios[0]?.key) {
        this.store.update({
          config: {
            scenarioKey: scenarios[0].key,
          },
        });
      }
    } catch (error) {
      const isRateLimited =
        error instanceof Error &&
        'status' in error &&
        Number(error.status) === 429;

      if (isRateLimited) {
        this.applyRateLimit(error, 'Список сценариев временно ограничен');
        return;
      }

      this.store.update({
        backendStatus: 'offline',
        error:
          error instanceof Error
            ? error.message
            : 'Не удалось связаться с бэкендом',
      });
      return;
    }

    try {
      const recentRuns = await this.apiClient.listRuns(DEFAULT_RUNS_LIMIT);

      this.store.update({
        recentRuns,
      });
    } catch (error) {
      console.warn('[simulation-session] failed to preload recent runs', error);
    }
  }

  updateConfig(patch) {
    this.store.update({
      config: patch,
    });
  }

  async startSimulation() {
    if (!this.canStartBackendRequest('run')) {
      return;
    }

    await this.runSimulation({});
  }

  async restartSimulation() {
    if (!this.canStartBackendRequest('run')) {
      return;
    }

    await this.runSimulation({});
  }

  async loadLatestRun() {
    if (!this.canStartBackendRequest('latest')) {
      return;
    }

    this.beginRequest('latest');

    try {
      const run = await this.apiClient.getLatestRun();

      this.store.update({
        run,
        backendStatus: 'online',
        error: '',
        recentRuns: this.mergeRecentRuns([this.toRunListItem(run)]),
      });

      this.finishRequest({
        currentStepFloat: 1,
        isRunning: true,
        isPaused: false,
        isCompleted: false,
        lastFrameAt: 0,
      });
    } catch (error) {
      this.handleRequestError(error, 'Не удалось загрузить последний запуск');
    }
  }

  async loadRecentRuns(limit = DEFAULT_RUNS_LIMIT) {
    if (!this.canStartBackendRequest('runs')) {
      return;
    }

    this.beginRequest('runs');

    try {
      const recentRuns = await this.apiClient.listRuns(limit);

      this.store.update({
        recentRuns,
        backendStatus: 'online',
        error: '',
      });

      this.finishRequest({
        isRunning: false,
        isPaused: true,
        lastFrameAt: 0,
      });
    } catch (error) {
      this.handleRequestError(error, 'Не удалось загрузить историю запусков');
    }
  }

  async loadRunById(runId) {
    if (!runId || !this.canStartBackendRequest('runById')) {
      return;
    }

    this.beginRequest('runById');

    try {
      const run = await this.apiClient.getRunById(runId);

      this.store.update({
        run,
        backendStatus: 'online',
        error: '',
        recentRuns: this.mergeRecentRuns([this.toRunListItem(run)]),
      });

      this.finishRequest({
        currentStepFloat: 1,
        isRunning: true,
        isPaused: false,
        isCompleted: false,
        lastFrameAt: 0,
      });
    } catch (error) {
      this.handleRequestError(error, 'Не удалось загрузить выбранный запуск');
    }
  }

  pause() {
    if (!this.store.getState().run) {
      return;
    }

    this.playback = {
      ...this.playback,
      isRunning: false,
      isPaused: true,
      lastFrameAt: 0,
    };
    this.notify();
  }

  resume() {
    if (!this.store.getState().run) {
      return;
    }

    this.playback = {
      ...this.playback,
      isRunning: true,
      isPaused: false,
      isCompleted: false,
      lastFrameAt: 0,
    };
    this.notify();
  }

  togglePause() {
    if (this.playback.isPaused) {
      this.resume();
      return;
    }

    this.pause();
  }

  reset() {
    if (!this.store.getState().run) {
      return;
    }

    this.playback = {
      currentStepFloat: 1,
      isRunning: false,
      isPaused: true,
      isLoading: false,
      isCompleted: false,
      lastFrameAt: 0,
      activeRequestKind: null,
      blockedUntil: this.playback.blockedUntil,
      blockedRequestKind: this.playback.blockedRequestKind,
    };
    this.notify();
  }

  seek(stepFloat) {
    const run = this.store.getState().run;

    if (!run) {
      return;
    }

    this.playback = {
      ...this.playback,
      currentStepFloat: clamp(stepFloat, 1, run.requestedSteps),
      isCompleted: false,
      lastFrameAt: 0,
    };
    this.notify();
  }

  stepBy(delta) {
    this.pause();
    this.seek(this.playback.currentStepFloat + delta);
  }

  async injectEventAt(coordinates, randomize = false) {
    if (!this.canStartBackendRequest('inject')) {
      return;
    }

    const run = this.store.getState().run;
    const currentStep = run
      ? Math.max(1, Math.round(this.playback.currentStepFloat))
      : 1;
    const randomCoordinates = {
      x: Math.random() * 0.7 + 0.15,
      y: Math.random() * 0.7 + 0.15,
    };
    const target = randomize ? randomCoordinates : coordinates;

    const hasStartedRun = await this.runSimulation({
      preserveStep: true,
      override: {
        x: target.x,
        y: target.y,
        startStep: currentStep,
      },
    });

    if (!hasStartedRun) {
      return;
    }

    this.updateConfig({
      activeEventOverride: {
        x: Number(target.x.toFixed(2)),
        y: Number(target.y.toFixed(2)),
        startStep: currentStep,
      },
      render: {
        armInject: false,
      },
    });
  }

  update(now) {
    const run = this.store.getState().run;

    if (!run || !this.playback.isRunning || this.playback.isPaused) {
      return;
    }

    if (!this.playback.lastFrameAt) {
      this.playback.lastFrameAt = now;
      return;
    }

    const deltaSeconds = (now - this.playback.lastFrameAt) / 1000;
    const speed = this.store.getState().config.speed;

    this.playback.lastFrameAt = now;
    this.playback.currentStepFloat += deltaSeconds * speed;

    if (this.playback.currentStepFloat >= run.requestedSteps) {
      if (this.store.getState().config.render.loopPlayback) {
        this.playback.currentStepFloat = 1;
        this.playback.isCompleted = false;
        this.playback.lastFrameAt = now;
        return;
      }

      this.playback.currentStepFloat = run.requestedSteps;
      this.playback.isCompleted = true;
      this.playback.isRunning = false;
      this.playback.isPaused = true;
      this.notify();
    }
  }

  async runSimulation({ override = {}, preserveStep = false }) {
    const previousStep = preserveStep ? this.playback.currentStepFloat : 1;

    this.beginRequest(preserveStep ? 'inject' : 'run');

    try {
      const run = await this.apiClient.runSimulation(this.buildRunPayload(override));

      this.store.update({
        run,
        backendStatus: 'online',
        error: '',
        recentRuns: this.mergeRecentRuns([this.toRunListItem(run)]),
      });

      this.finishRequest({
        currentStepFloat: preserveStep ? clamp(previousStep, 1, run.requestedSteps) : 1,
        isRunning: true,
        isPaused: false,
        isCompleted: false,
        lastFrameAt: 0,
      });
      return true;
    } catch (error) {
      this.handleRequestError(error, 'Не удалось запустить симуляцию');
      return false;
    }
  }

  buildRunPayload(override = {}) {
    const { config } = this.store.getState();
    const activeEventOverride = pickDefinedValues({
      ...config.activeEventOverride,
      ...override,
    });
    const analysisOptions = this.buildAnalysisOptionsPayload();

    return pickDefinedValues({
      scenarioKey: config.scenarioKey,
      mode: config.mode,
      profile: config.profile,
      entitiesCount: config.entitiesCount,
      steps: config.steps,
      seed: Number.isFinite(Number(config.seed)) ? Number(config.seed) : undefined,
      activeEventOverride,
      returnEntitiesLimit: Math.min(config.visibleEntityLimit, config.entitiesCount),
      analysisOptions,
    });
  }

  buildAnalysisOptionsPayload() {
    const { analysisOptions } = this.store.getState().config;
    const payload = {};

    if (analysisOptions.causal.enabled) {
      payload.causal = {
        enabled: true,
        targetMetric: analysisOptions.causal.targetMetric,
        maxInterventions: Number(analysisOptions.causal.maxInterventions),
      };
    }

    if (analysisOptions.robust.enabled) {
      payload.robust = {
        enabled: true,
        objective: analysisOptions.robust.objective,
        scenarioCount: Number(analysisOptions.robust.scenarioCount),
      };
    }

    if (analysisOptions.uncertainty.enabled) {
      payload.uncertainty = {
        enabled: true,
        level: Number(analysisOptions.uncertainty.level),
        method: analysisOptions.uncertainty.method,
        resamples: Number(analysisOptions.uncertainty.resamples),
      };
    }

    return Object.keys(payload).length > 0 ? payload : undefined;
  }

  mergeRecentRuns(nextRuns) {
    const merged = [...nextRuns, ...this.store.getState().recentRuns];
    const deduped = [];
    const seen = new Set();

    for (const run of merged) {
      if (!run || seen.has(run.runId)) {
        continue;
      }

      seen.add(run.runId);
      deduped.push(run);
    }

    return deduped.slice(0, DEFAULT_RUNS_LIMIT);
  }

  toRunListItem(run) {
    return {
      runId: run.runId,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      status: run.status,
      scenarioKey: run.scenarioKey,
      mode: run.mode,
      profile: run.profile,
      seed: run.seed,
      entitiesCount: run.entitiesCount,
      requestedSteps: run.requestedSteps,
      summary: structuredClone(run.summary),
      lastStep: structuredClone(run.lastStep),
    };
  }

  getModeHint(mode) {
    return MODE_HINTS[mode] ?? '';
  }

  resetToDefaults() {
    this.store.update({
      config: structuredClone(DEFAULT_CONFIG),
    });
  }
}
