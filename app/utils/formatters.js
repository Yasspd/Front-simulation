import { MODE_LABELS, PROFILE_LABELS } from '../config.js';

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

export function formatDecimal(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : '0.00';
}

export function formatPercent(value, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatStep(value) {
  return Number.isFinite(value) ? value.toFixed(2).replace(/\.00$/, '') : '0';
}

export function humanizeBackendStatus(status) {
  if (status === 'online') {
    return 'Бэкенд: онлайн';
  }

  if (status === 'offline') {
    return 'Бэкенд: недоступен';
  }

  if (status === 'loading') {
    return 'Бэкенд: выполняет симуляцию';
  }

  return 'Бэкенд: подключение...';
}

export function humanizeBackendStatusShort(status) {
  if (status === 'online') {
    return 'онлайн';
  }

  if (status === 'offline') {
    return 'offline';
  }

  if (status === 'loading') {
    return 'загрузка';
  }

  return 'связь';
}

export function humanizeMode(mode) {
  return MODE_LABELS[mode] ?? mode;
}

export function humanizeProfile(profile) {
  return PROFILE_LABELS[profile] ?? profile;
}

export function humanizePlaybackStatus(status) {
  if (status === 'loading') {
    return 'загрузка';
  }

  if (status === 'running') {
    return 'идёт';
  }

  if (status === 'done') {
    return 'готово';
  }

  if (status === 'paused') {
    return 'пауза';
  }

  return 'ожидание';
}

export function humanizeSystemAction(action) {
  if (action === 'system_normal') {
    return 'система в норме';
  }

  if (action === 'rebalance_attention') {
    return 'перераспределить внимание';
  }

  if (action === 'stabilize_system') {
    return 'стабилизировать систему';
  }

  return action;
}

export function humanizeEventPhase(phase) {
  if (phase === 'inactive') {
    return 'неактивно';
  }

  if (phase === 'scheduled') {
    return 'запланировано';
  }

  if (phase === 'ramp_up') {
    return 'разгон';
  }

  if (phase === 'peak') {
    return 'пик';
  }

  if (phase === 'decay') {
    return 'затухание';
  }

  if (phase === 'aftershock') {
    return 'послесобытийный хвост';
  }

  return phase ?? 'неизвестно';
}

export function mergePlain(target, patch) {
  const base = Array.isArray(target) ? [...target] : { ...target };

  Object.entries(patch).forEach(([key, value]) => {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      base[key] = mergePlain(target[key], value);
      return;
    }

    base[key] = value;
  });

  return base;
}

export function pickDefinedValues(source) {
  return Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
}
