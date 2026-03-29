import {
  formatDecimal,
  formatInterval,
  formatInteger,
  humanizeAnalysisTargetMetric,
  humanizeEffectDirection,
  humanizeEffectStrengthLabel,
  humanizeEvidenceLabel,
  humanizePolicyId,
  humanizeRobustObjective,
  humanizeUncertaintyMethod,
} from '../utils/formatters.js';

function buildTopFactors(items = []) {
  return items
    .slice(0, 3)
    .map(
      (item) => `
        <li>
          <span class="analysis-sign">${humanizeEffectDirection(item.effectDirection)}</span>
          <strong>${item.intervention.label}</strong>
          <span>${formatDecimal(item.estimatedEffect, 3)}</span>
        </li>
      `,
    )
    .join('');
}

function buildRobustRanking(ranking = []) {
  return ranking
    .map(
      (entry) => `
        <div class="analysis-ranking-row">
          <div class="analysis-ranking-head">
            <strong>${humanizePolicyId(entry.policyId)}</strong>
            <span>${formatDecimal(entry.robustScore, 3)}</span>
          </div>
          <div class="analysis-mini-grid">
            <span>expected ${formatDecimal(entry.expectedScore, 3)}</span>
            <span>worst ${formatDecimal(entry.worstCaseScore, 3)}</span>
            <span>tail ${formatDecimal(entry.tailRiskScore, 3)}</span>
            <span>stability ${formatDecimal(entry.stabilityScore, 3)}</span>
            <span>gap ${formatDecimal(entry.scoreGapFromBest, 3)}</span>
            <span>downside ${formatDecimal(entry.downside, 3)}</span>
          </div>
          <div class="analysis-chip-row">
            ${entry.explanation.strongestFactors
              .map((factor) => `<span class="analysis-chip">${factor}</span>`)
              .join('')}
          </div>
        </div>
      `,
    )
    .join('');
}

function buildUncertaintyRows(metrics = {}) {
  return Object.entries(metrics)
    .filter(([, interval]) => interval)
    .map(
      ([metricKey, interval]) => `
        <div class="analysis-metric-row">
          <span>${metricKey}</span>
          <strong>${formatDecimal(interval.point, 3)}</strong>
          <span>${formatInterval(interval, 3)}</span>
        </div>
      `,
    )
    .join('');
}

export class AnalysisPanel {
  constructor(root) {
    this.root = root;
  }

  render(viewState) {
    const analysis = viewState.run?.analysis;

    if (!analysis) {
      this.root.classList.add('hidden');
      this.root.innerHTML = '';
      return;
    }

    this.root.classList.remove('hidden');

    const robust = analysis.robust;
    const causal = analysis.causal;
    const uncertainty = analysis.uncertainty;
    const recommended = robust?.recommendedPolicy;
    const summaryText = viewState.run
      ? `Что произошло: finished ${viewState.run.summary.finishedEntities}, fail ${formatDecimal(viewState.run.summary.failureRate, 3)}, chaos ${formatDecimal(viewState.run.summary.finalChaosIndex, 3)}.`
      : 'Что произошло: run не загружен.';

    this.root.innerHTML = `
      <div class="analysis-panel-head">
        <div>
          <div class="analysis-panel-title">Analysis / Decision</div>
          <div class="analysis-panel-subtitle">Дополнительный слой поверх готового simulation run. Raw результат симуляции он не меняет.</div>
        </div>
      </div>

      <div class="analysis-note-card">
        <strong>Что произошло</strong>
        <p>${summaryText}</p>
        <p>Что рекомендует analysis: ${
          recommended
            ? `policy ${humanizePolicyId(recommended.policyId)} под objective «${humanizeRobustObjective(robust.objective)}».`
            : 'рекомендация policy не запрашивалась.'
        }</p>
        <p>Это simulation-based recommendation, а не real-world guarantee.</p>
      </div>

      ${
        robust
          ? `
            <details class="analysis-card" open>
              <summary>Decision summary</summary>
              <div class="analysis-card-body">
                <div class="analysis-kpi-row">
                  <div><span>Policy</span><strong>${recommended ? humanizePolicyId(recommended.policyId) : '—'}</strong></div>
                  <div><span>Objective</span><strong>${humanizeRobustObjective(robust.objective)}</strong></div>
                  <div><span>Сценарии</span><strong>${robust.scenarioCount}</strong></div>
                </div>
                <div class="analysis-kpi-row">
                  <div><span>Robust score</span><strong>${recommended ? formatDecimal(recommended.robustScore, 3) : '—'}</strong></div>
                  <div><span>Worst case</span><strong>${recommended ? formatDecimal(recommended.worstCaseScore, 3) : '—'}</strong></div>
                  <div><span>Downside</span><strong>${recommended ? formatDecimal(recommended.downside, 3) : '—'}</strong></div>
                </div>
                <div class="analysis-chip-row">
                  ${
                    recommended
                      ? recommended.explanation.strongestFactors
                          .map((factor) => `<span class="analysis-chip">${factor}</span>`)
                          .join('')
                      : '<span class="analysis-chip">robust не запрошен</span>'
                  }
                </div>
                <div class="analysis-inline-note">
                  Почему эта policy лучше: ranking строится по expected, worst-case и tail-risk. stabilityScore сейчас diagnostic-only и показывается отдельно для объяснения, но не участвует в итоговом ranking formula.
                </div>
              </div>
            </details>
          `
          : ''
      }

      ${
        robust
          ? `
            <details class="analysis-card">
              <summary>Scenario-based ranking</summary>
              <div class="analysis-card-body analysis-scroll-body">
                ${buildRobustRanking(robust.ranking)}
                <div class="analysis-inline-note">
                  regret = aggregate score gap from best policy внутри текущего scenario-based evaluator, а не классический decision-theory regret.
                </div>
              </div>
            </details>
          `
          : ''
      }

      ${
        causal
          ? `
            <details class="analysis-card">
              <summary>Causal drivers</summary>
              <div class="analysis-card-body">
                <div class="analysis-kpi-row">
                  <div><span>Target metric</span><strong>${humanizeAnalysisTargetMetric(causal.targetMetric)}</strong></div>
                  <div><span>Method</span><strong>interventional estimate inside model</strong></div>
                </div>
                <div class="analysis-driver-grid">
                  <div>
                    <strong>Top drivers</strong>
                    <ul class="analysis-driver-list">${buildTopFactors(causal.topDrivers)}</ul>
                  </div>
                  <div>
                    <strong>Chaos drivers</strong>
                    <ul class="analysis-driver-list">${buildTopFactors(causal.chaosDrivers)}</ul>
                  </div>
                </div>
                ${
                  causal.comparisons[0]
                    ? `
                      <div class="analysis-inline-note">
                        Baseline ${formatDecimal(causal.comparisons[0].baselineValue, 3)} → treated ${formatDecimal(causal.comparisons[0].treatedValue, 3)}.
                        ${humanizeEffectStrengthLabel(causal.comparisons[0].effectStrengthLabel)} / ${humanizeEvidenceLabel(causal.comparisons[0].evidenceLabel)}.
                      </div>
                    `
                    : ''
                }
                <div class="analysis-inline-note">
                  Это не causal proof по реальному миру. Это controlled paired rerun comparison внутри модели на одинаковом seed.
                </div>
              </div>
            </details>
          `
          : ''
      }

      ${
        uncertainty
          ? `
            <details class="analysis-card">
              <summary>Uncertainty</summary>
              <div class="analysis-card-body">
                <div class="analysis-kpi-row">
                  <div><span>Method</span><strong>${humanizeUncertaintyMethod(uncertainty.method)}</strong></div>
                  <div><span>Level</span><strong>${formatDecimal(uncertainty.calibrationInfo.level, 2)}</strong></div>
                  <div><span>Сэмплы</span><strong>${formatInteger(uncertainty.calibrationInfo.effectiveSamples)}</strong></div>
                </div>
                <div class="analysis-metric-table">
                  ${buildUncertaintyRows(uncertainty.metrics)}
                </div>
                <div class="analysis-inline-note">
                  Насколько велик разброс: interval показывает seeded simulation spread вокруг базового run, а point — это reference point базового запуска.
                </div>
                <div class="analysis-inline-note">
                  Это empirical interval, а не strict real-world confidence guarantee.
                </div>
              </div>
            </details>
          `
          : ''
      }
    `;
  }
}
