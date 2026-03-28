import { clamp, lerp } from '../utils/formatters.js';

function buildInterpolatedSnapshot(start, end, amount) {
  return {
    prevX: start.x,
    prevY: start.y,
    x: lerp(start.x, end.x, amount),
    y: lerp(start.y, end.y, amount),
    temperature: lerp(start.temperature, end.temperature, amount),
    influence: lerp(start.influence, end.influence, amount),
    velocity: lerp(start.velocity, end.velocity, amount),
    riskScore: lerp(start.riskScore, end.riskScore, amount),
    state: amount >= 0.5 ? end.state : start.state,
    action: amount >= 0.5 ? end.action : start.action,
  };
}

function getEntitySnapshot(entity, stepFloat) {
  const history = entity.history ?? [];

  if (history.length === 0) {
    return {
      id: entity.id,
      segment: entity.segment,
      currentState: entity.currentState,
      action: entity.action,
      prevX: entity.prevX ?? entity.x,
      prevY: entity.prevY ?? entity.y,
      x: entity.x,
      y: entity.y,
      temperature: entity.temperature,
      influence: entity.influence,
      velocity: entity.velocity,
      riskScore: entity.riskScore,
      isFinished: entity.isFinished,
      isFrozen: entity.isFinished,
    };
  }

  const lastHistory = history[history.length - 1];

  if (stepFloat >= lastHistory.step) {
    const previousHistory = history[history.length - 2] ?? lastHistory;

    return {
      id: entity.id,
      segment: entity.segment,
      currentState: lastHistory.state,
      action: lastHistory.action,
      prevX: previousHistory.x,
      prevY: previousHistory.y,
      x: lastHistory.x,
      y: lastHistory.y,
      temperature: lastHistory.temperature,
      influence: lastHistory.influence,
      velocity: lastHistory.velocity,
      riskScore: lastHistory.riskScore,
      isFinished: entity.isFinished,
      isFrozen: entity.isFinished && stepFloat > lastHistory.step,
    };
  }

  const lowerStep = Math.max(1, Math.floor(stepFloat));
  const upperStep = Math.min(lowerStep + 1, history.length);
  const startSnapshot = history[lowerStep - 1] ?? history[0];
  const endSnapshot = history[upperStep - 1] ?? startSnapshot;
  const amount = clamp(stepFloat - lowerStep, 0, 1);
  const interpolated = buildInterpolatedSnapshot(startSnapshot, endSnapshot, amount);

  return {
    id: entity.id,
    segment: entity.segment,
    currentState: interpolated.state,
    action: interpolated.action,
    prevX: interpolated.prevX,
    prevY: interpolated.prevY,
    x: interpolated.x,
    y: interpolated.y,
    temperature: interpolated.temperature,
    influence: interpolated.influence,
    velocity: interpolated.velocity,
    riskScore: interpolated.riskScore,
    isFinished: false,
    isFrozen: false,
  };
}

function buildInterpolatedEvent(step, nextStep, amount) {
  if (!step?.eventSnapshot && !nextStep?.eventSnapshot) {
    return null;
  }

  const start = step?.eventSnapshot ?? nextStep?.eventSnapshot;
  const end = nextStep?.eventSnapshot ?? step?.eventSnapshot;

  return {
    ...start,
    x: lerp(start.x, end.x, amount),
    y: lerp(start.y, end.y, amount),
    intensity: lerp(start.intensity ?? 0, end.intensity ?? 0, amount),
    scope: lerp(start.scope ?? 0, end.scope ?? 0, amount),
    relevance: lerp(start.relevance ?? 0, end.relevance ?? 0, amount),
    isActive: (amount >= 0.5 ? end.isActive : start.isActive) ?? false,
    phase: amount >= 0.5 ? end.phase : start.phase,
  };
}

export function buildPlaybackSnapshot(run, stepFloat) {
  if (!run) {
    return {
      progress: 0,
      stepFloat: 0,
      lowerStepIndex: 0,
      upperStepIndex: 0,
      currentStep: null,
      nextStep: null,
      interpolatedStep: null,
      entities: [],
      event: null,
    };
  }

  const clampedStep = clamp(stepFloat || 1, 1, run.requestedSteps);
  const lowerStepIndex = Math.max(1, Math.floor(clampedStep));
  const upperStepIndex = Math.min(run.requestedSteps, lowerStepIndex + 1);
  const currentStep = run.steps[lowerStepIndex - 1] ?? run.lastStep;
  const nextStep = run.steps[upperStepIndex - 1] ?? currentStep;
  const amount = clamp(clampedStep - lowerStepIndex, 0, 1);

  const interpolatedStep = currentStep
    ? {
        ...currentStep,
        avgTemperature: lerp(currentStep.avgTemperature, nextStep.avgTemperature, amount),
        avgInfluence: lerp(currentStep.avgInfluence, nextStep.avgInfluence, amount),
        avgVelocity: lerp(currentStep.avgVelocity, nextStep.avgVelocity, amount),
        avgCurrentInfluence: lerp(
          currentStep.avgCurrentInfluence,
          nextStep.avgCurrentInfluence,
          amount,
        ),
        avgResidualInfluence: lerp(
          currentStep.avgResidualInfluence,
          nextStep.avgResidualInfluence,
          amount,
        ),
        avgCurrentVelocity: lerp(
          currentStep.avgCurrentVelocity,
          nextStep.avgCurrentVelocity,
          amount,
        ),
        avgResidualVelocity: lerp(
          currentStep.avgResidualVelocity,
          nextStep.avgResidualVelocity,
          amount,
        ),
        avgRiskScore: lerp(currentStep.avgRiskScore, nextStep.avgRiskScore, amount),
        avgFailureProbability: lerp(
          currentStep.avgFailureProbability,
          nextStep.avgFailureProbability,
          amount,
        ),
        clusterDensity: lerp(currentStep.clusterDensity, nextStep.clusterDensity, amount),
        hotShare: lerp(currentStep.hotShare, nextStep.hotShare, amount),
        failureProximity: lerp(
          currentStep.failureProximity,
          nextStep.failureProximity,
          amount,
        ),
        chaosIndex: lerp(currentStep.chaosIndex, nextStep.chaosIndex, amount),
        globalThreshold: lerp(currentStep.globalThreshold, nextStep.globalThreshold, amount),
        activeEventIntensity: lerp(
          currentStep.activeEventIntensity,
          nextStep.activeEventIntensity,
          amount,
        ),
      }
    : null;

  return {
    progress: run.requestedSteps <= 1 ? 1 : (clampedStep - 1) / (run.requestedSteps - 1),
    stepFloat: clampedStep,
    lowerStepIndex,
    upperStepIndex,
    currentStep,
    nextStep,
    interpolatedStep,
    entities: run.entities.map((entity) => getEntitySnapshot(entity, clampedStep)),
    event: buildInterpolatedEvent(currentStep, nextStep, amount),
  };
}
