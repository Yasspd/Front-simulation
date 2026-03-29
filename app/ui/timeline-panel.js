import {
  formatStep,
  humanizeEventPhase,
  humanizeMode,
  humanizePolicyId,
  humanizeProfile,
} from '../utils/formatters.js';

export class TimelinePanel {
  constructor(session) {
    this.session = session;
    this.elements = {
      scrubber: document.getElementById('timelineScrubber'),
      timelineSubtitle: document.getElementById('timelineSubtitle'),
      timelineMeta: document.getElementById('timelineMeta'),
      timelineStartLabel: document.getElementById('timelineStartLabel'),
      timelineCenterLabel: document.getElementById('timelineCenterLabel'),
      timelineEndLabel: document.getElementById('timelineEndLabel'),
    };

    this.elements.scrubber.addEventListener('input', (event) => {
      this.session.seek(Number(event.target.value));
    });
  }

  render(viewState, playbackSnapshot) {
    const playback = viewState.playback;

    if (!viewState.run) {
      this.elements.scrubber.min = '1';
      this.elements.scrubber.max = '1';
      this.elements.scrubber.value = '1';
      this.elements.timelineMeta.textContent = 'seed ---';
      this.elements.timelineStartLabel.textContent = 'шаг 1';
      this.elements.timelineCenterLabel.textContent = 'ожидание';
      this.elements.timelineEndLabel.textContent = 'шаг 1';
      this.elements.timelineSubtitle.textContent =
        'Локальное проигрывание запуска бэкенда с интерполяцией';
      return;
    }

    const robust = viewState.run.analysis?.robust;

    this.elements.scrubber.min = '1';
    this.elements.scrubber.max = String(viewState.run.requestedSteps);
    this.elements.scrubber.step = '0.01';
    this.elements.scrubber.value = String(playback.currentStepFloat);
    this.elements.timelineMeta.textContent = `seed ${viewState.run.seed} / ${humanizeMode(viewState.run.mode)} / ${humanizeProfile(viewState.run.profile)}`;
    this.elements.timelineStartLabel.textContent = 'шаг 1';
    this.elements.timelineCenterLabel.textContent = playback.isLoading
      ? 'загрузка'
      : playback.isRunning
        ? `идёт / ${formatStep(playback.currentStepFloat)}`
        : playback.isCompleted
          ? 'завершено'
          : 'пауза';
    this.elements.timelineEndLabel.textContent = `шаг ${viewState.run.requestedSteps}`;

    if (robust?.recommendedPolicy) {
      this.elements.timelineSubtitle.textContent = `Analysis: рекомендована policy ${humanizePolicyId(robust.recommendedPolicy.policyId)}. Это scenario-based ranking внутри модели, а не внешняя гарантия.`;
      return;
    }

    this.elements.timelineSubtitle.textContent = playbackSnapshot.event?.isActive
      ? `Событие ${humanizeEventPhase(playbackSnapshot.event.phase)} / текущая интенсивность ${playbackSnapshot.interpolatedStep.activeEventIntensity.toFixed(2)}`
      : 'Локальное проигрывание запуска бэкенда с интерполяцией';
  }
}
