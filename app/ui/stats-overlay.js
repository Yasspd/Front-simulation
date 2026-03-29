import {
  formatDecimal,
  formatPercent,
  humanizeEventPhase,
  humanizeMode,
  humanizePlaybackStatus,
  humanizePolicyId,
  humanizeProfile,
  humanizeSystemAction,
} from '../utils/formatters.js';

export class StatsOverlay {
  constructor() {
    this.elements = {
      overlaySubtitle: document.getElementById('overlaySubtitle'),
      playbackStatus: document.getElementById('playbackStatus'),
      analysisBadgeRow: document.getElementById('analysisBadgeRow'),
      statStep: document.getElementById('statStep'),
      statChaos: document.getElementById('statChaos'),
      statTemp: document.getElementById('statTemp'),
      statRisk: document.getElementById('statRisk'),
      statFailure: document.getElementById('statFailure'),
      statThreshold: document.getElementById('statThreshold'),
      statAction: document.getElementById('statAction'),
      statHotShare: document.getElementById('statHotShare'),
      telemetryInfluence: document.getElementById('telemetryInfluence'),
      telemetryVelocity: document.getElementById('telemetryVelocity'),
      telemetryTerminal: document.getElementById('telemetryTerminal'),
      telemetryEvent: document.getElementById('telemetryEvent'),
      summaryTerminal: document.getElementById('summaryTerminal'),
      summaryActions: document.getElementById('summaryActions'),
      summaryChaos: document.getElementById('summaryChaos'),
      summaryHot: document.getElementById('summaryHot'),
    };
  }

  reset() {
    this.elements.overlaySubtitle.textContent = 'Нет активного запуска';
    this.elements.analysisBadgeRow.innerHTML = '';
    this.elements.statStep.textContent = '0 / 0';
    this.elements.statChaos.textContent = '0.00';
    this.elements.statTemp.textContent = '0.00';
    this.elements.statRisk.textContent = '0.00';
    this.elements.statFailure.textContent = '0.00';
    this.elements.statThreshold.textContent = '0.00';
    this.elements.statAction.textContent = 'система в норме';
    this.elements.statHotShare.textContent = '0%';
    this.elements.telemetryInfluence.textContent = '0.00 / 0.00';
    this.elements.telemetryVelocity.textContent = '0.00 / 0.00';
    this.elements.telemetryTerminal.textContent = '0 / 0 / 0';
    this.elements.telemetryEvent.textContent = 'неактивно / 0.00';
    this.elements.summaryTerminal.textContent = '0 / 0 / 0';
    this.elements.summaryActions.textContent = '0 / 0 / 0 / 0';
    this.elements.summaryChaos.textContent = '0.00 / 0.00 / 0.00';
    this.elements.summaryHot.textContent = '0 / 0 / 0';
  }

  render(viewState, playbackSnapshot) {
    const playback = viewState.playback;

    this.elements.playbackStatus.textContent = humanizePlaybackStatus(
      playback.isLoading
        ? 'loading'
        : playback.isRunning
          ? 'running'
          : playback.isCompleted
            ? 'done'
            : playback.isPaused
              ? 'paused'
              : 'idle',
    );

    if (!viewState.run || !playbackSnapshot.interpolatedStep) {
      this.reset();
      return;
    }

    const step = playbackSnapshot.interpolatedStep;
    const currentStep = playbackSnapshot.currentStep;
    const summary = viewState.run.summary;
    const robust = viewState.run.analysis?.robust;
    const uncertainty = viewState.run.analysis?.uncertainty;
    const analysisBadges = [
      `<span class="analysis-pill">${viewState.run.analysis ? 'analysis on' : 'analysis off'}</span>`,
      robust?.recommendedPolicy
        ? `<span class="analysis-pill analysis-pill-strong">policy ${humanizePolicyId(robust.recommendedPolicy.policyId)}</span>`
        : '',
      uncertainty
        ? '<span class="analysis-pill">intervals active</span>'
        : '',
    ]
      .filter(Boolean)
      .join('');
    const eventLabel = playbackSnapshot.event
      ? `${humanizeEventPhase(playbackSnapshot.event.phase)} / ${formatDecimal(step.activeEventIntensity, 2)}`
      : 'неактивно / 0.00';

    this.elements.analysisBadgeRow.innerHTML = analysisBadges;
    this.elements.overlaySubtitle.textContent = `${humanizeMode(viewState.run.mode)} / ${humanizeProfile(viewState.run.profile)} / ${viewState.run.runId.slice(0, 8)}`;
    this.elements.statStep.textContent = `${formatDecimal(playback.currentStepFloat, 1)} / ${viewState.run.requestedSteps}`;
    this.elements.statChaos.textContent = formatDecimal(step.chaosIndex, 3);
    this.elements.statTemp.textContent = formatDecimal(step.avgTemperature, 3);
    this.elements.statRisk.textContent = formatDecimal(step.avgRiskScore, 3);
    this.elements.statFailure.textContent = formatDecimal(step.avgFailureProbability, 3);
    this.elements.statThreshold.textContent = formatDecimal(step.globalThreshold, 3);
    this.elements.statAction.textContent = humanizeSystemAction(currentStep.systemAction);
    this.elements.statHotShare.textContent = formatPercent(step.hotShare, 1);
    this.elements.telemetryInfluence.textContent = `${formatDecimal(step.avgCurrentInfluence, 3)} / ${formatDecimal(step.avgResidualInfluence, 3)}`;
    this.elements.telemetryVelocity.textContent = `${formatDecimal(step.avgCurrentVelocity, 3)} / ${formatDecimal(step.avgResidualVelocity, 3)}`;
    this.elements.telemetryTerminal.textContent = `${currentStep.cumulativeFinished} / ${currentStep.cumulativeStabilized} / ${currentStep.cumulativeFailed}`;
    this.elements.telemetryEvent.textContent = eventLabel;
    this.elements.summaryTerminal.textContent = `${summary.finishedEntities} / ${summary.stabilizedCount} / ${summary.failedCount}`;
    this.elements.summaryActions.textContent = `${summary.actionCountTotal} / ${summary.watchCountTotal} / ${summary.notifyCountTotal} / ${summary.dampenCountTotal}`;
    this.elements.summaryChaos.textContent = `${formatDecimal(summary.finalChaosIndex, 3)} / ${formatDecimal(summary.maxChaosIndex, 3)} / ${formatDecimal(summary.avgChaosIndex, 3)}`;
    this.elements.summaryHot.textContent = `${summary.hotEntities} / ${summary.hotActiveEntities} / ${summary.maxHotEntities}`;
  }
}
