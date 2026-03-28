export const STATE_META = {
  calm: { label: 'Спокойный', color: '#62e7ff' },
  interested: { label: 'Заинтересованный', color: '#6f9bff' },
  reactive: { label: 'Реактивный', color: '#d36bff' },
  critical: { label: 'Критический', color: '#ff8b6b' },
  stabilized: { label: 'Стабилизирован', color: '#79ffc2' },
  failed: { label: 'Провален', color: '#ff6d8f' },
};

export const MODE_LABELS = {
  baseline: 'Базовый',
  fixed: 'Фиксированный',
  adaptive: 'Адаптивный',
  hybrid: 'Гибридный',
};

export const MODE_HINTS = {
  baseline:
    'Отчётный режим: решения считаются и видны в телеметрии, но немедленные эффекты не применяются.',
  fixed:
    'Контрольная группа: без локальных действий, без системных реакций, только фиксированные пороги.',
  adaptive:
    'Активный режим: пороги и действия влияют на динамику следующих шагов через backend-логику управления.',
  hybrid:
    'Семантика адаптивного режима плюс расширенная телеметрия по шагам.',
};

export const PROFILE_LABELS = {
  demo: 'Демо',
  realistic: 'Реалистичный',
  stress: 'Стресс',
};

export const PROFILE_HINTS = {
  demo: {
    title: 'Демо',
    summary:
      'Консервативный профиль без seeded noise, жизненного цикла события и отложенных эффектов.',
    details: [
      'Подходит для базовых демонстраций и предсказуемых скриншотов.',
      'Расхождение траектории может появиться раньше terminal-расхождения.',
    ],
  },
  realistic: {
    title: 'Реалистичный',
    summary:
      'Добавляет жизненный цикл события, отложенные эффекты, инерцию и умеренный seeded noise.',
    details: [
      'Лучше разделяет сегменты и правдоподобнее показывает восстановление и эскалацию.',
      'Хороший профиль по умолчанию для продуктовых демонстраций.',
    ],
  },
  stress: {
    title: 'Стресс',
    summary:
      'Самый агрессивный профиль: сильнее связь с событием, выше чувствительность и ниже барьер активации системного слоя.',
    details: [
      'Лучше всего показывает расхождение adaptive и fixed.',
      'Рекомендуется для тестов и демонстраций хаоса.',
    ],
  },
};

export const DEFAULT_CONFIG = {
  scenarioKey: 'global-chaos-mvp',
  mode: 'adaptive',
  profile: 'realistic',
  entitiesCount: 180,
  steps: 10,
  seed: 123,
  speed: 1.2,
  visibleEntityLimit: 400,
  activeEventOverride: {
    intensity: 0.88,
    relevance: 0.92,
    scope: 0.82,
    x: 0.82,
    y: 0.78,
    duration: 4,
    startStep: 1,
  },
  ui: {
    settingsLevel: 'simple',
  },
  render: {
    showLinks: true,
    showTrails: false,
    showLabels: false,
    showIds: false,
    showEventAura: true,
    showClusterRing: true,
    showResidualHints: true,
    showVelocityVectors: false,
    loopPlayback: false,
    armInject: false,
    linkDistance: 0.16,
    nodeScale: 1,
  },
};

export const INITIAL_APP_STATE = {
  scenarios: [],
  run: null,
  error: '',
  backendStatus: 'connecting',
  config: structuredClone(DEFAULT_CONFIG),
};
