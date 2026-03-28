import { DEFAULT_CONFIG, MODE_HINTS } from '../config.js';
import { clamp, pickDefinedValues } from '../utils/formatters.js';

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
    };
    this.listeners = new Set();
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
      this.store.update({
        backendStatus: 'offline',
        error: error instanceof Error ? error.message : 'Не удалось связаться с бэкендом',
      });
    }
  }

  updateConfig(patch) {
    this.store.update({
      config: patch,
    });
  }

  async startSimulation() {
    if (this.playback.isLoading) {
      return;
    }

    await this.runSimulation({});
  }

  async restartSimulation() {
    if (this.playback.isLoading) {
      return;
    }

    await this.runSimulation({});
  }

  async loadLatestRun() {
    if (this.playback.isLoading) {
      return;
    }

    this.playback = {
      ...this.playback,
      isLoading: true,
      isRunning: false,
      isPaused: true,
      isCompleted: false,
      lastFrameAt: 0,
    };
    this.notify();

    try {
      this.store.update({
        backendStatus: 'loading',
        error: '',
      });
      const run = await this.apiClient.getLatestRun();

      this.store.update({
        run,
        backendStatus: 'online',
        error: '',
      });

      this.playback = {
        ...this.playback,
        currentStepFloat: 1,
        isRunning: true,
        isPaused: false,
        isLoading: false,
        isCompleted: false,
        lastFrameAt: 0,
      };
      this.notify();
    } catch (error) {
      this.store.update({
        backendStatus: 'offline',
        error: error instanceof Error ? error.message : 'Не удалось загрузить последний запуск',
      });
      this.playback = {
        ...this.playback,
        isLoading: false,
        isRunning: false,
        isPaused: true,
      };
      this.notify();
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
    if (this.playback.isLoading) {
      return;
    }

    const run = this.store.getState().run;
    const currentStep = run ? Math.max(1, Math.round(this.playback.currentStepFloat)) : 1;
    const randomCoordinates = {
      x: Math.random() * 0.7 + 0.15,
      y: Math.random() * 0.7 + 0.15,
    };
    const target = randomize ? randomCoordinates : coordinates;

    await this.runSimulation({
      preserveStep: true,
      override: {
        x: target.x,
        y: target.y,
        startStep: currentStep,
      },
    });

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

    this.playback = {
      ...this.playback,
      isLoading: true,
      isRunning: false,
      isPaused: true,
      isCompleted: false,
      lastFrameAt: 0,
    };
    this.notify();
    this.store.update({
      backendStatus: 'loading',
      error: '',
    });

    try {
      const run = await this.apiClient.runSimulation(this.buildRunPayload(override));

      this.store.update({
        run,
        backendStatus: 'online',
        error: '',
      });

      this.playback = {
        currentStepFloat: preserveStep ? clamp(previousStep, 1, run.requestedSteps) : 1,
        isRunning: true,
        isPaused: false,
        isLoading: false,
        isCompleted: false,
        lastFrameAt: 0,
      };
      this.notify();
    } catch (error) {
      this.store.update({
        backendStatus: 'offline',
        error: error instanceof Error ? error.message : 'Не удалось запустить симуляцию',
      });

      this.playback = {
        ...this.playback,
        isLoading: false,
        isRunning: false,
        isPaused: true,
      };
      this.notify();
    }
  }

  buildRunPayload(override = {}) {
    const { config } = this.store.getState();
    const activeEventOverride = pickDefinedValues({
      ...config.activeEventOverride,
      ...override,
    });

    return {
      scenarioKey: config.scenarioKey,
      mode: config.mode,
      profile: config.profile,
      entitiesCount: config.entitiesCount,
      steps: config.steps,
      seed: Number.isFinite(Number(config.seed)) ? Number(config.seed) : undefined,
      activeEventOverride,
      returnEntitiesLimit: Math.min(config.visibleEntityLimit, config.entitiesCount),
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
