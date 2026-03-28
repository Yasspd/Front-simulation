import { STATE_META } from '../config.js';
import { clamp } from '../utils/formatters.js';

export class CanvasRenderer {
  constructor(canvas, onCanvasInject) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.onCanvasInject = onCanvasInject;
    this.resize();

    window.addEventListener('resize', () => this.resize());
    this.canvas.addEventListener('click', (event) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);

      this.onCanvasInject({ x, y });
    });
  }

  resize() {
    const pixelRatio = window.devicePixelRatio || 1;
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;

    this.canvas.width = Math.floor(width * pixelRatio);
    this.canvas.height = Math.floor(height * pixelRatio);
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  render(viewState, playbackSnapshot) {
    const { width, height } = this.canvas.getBoundingClientRect();
    const hotThreshold = viewState.run?.debug?.visualHotThreshold ?? 0.7;

    this.drawBackground(width, height);

    if (!viewState.run || !playbackSnapshot.currentStep) {
      this.drawIdleState(width, height);
      return;
    }

    const entities = playbackSnapshot.entities;

    if (viewState.config.render.showLinks && entities.length <= 500) {
      this.drawLinks(entities, width, height, viewState.config.render.linkDistance);
    }

    if (viewState.config.render.showEventAura && playbackSnapshot.event) {
      this.drawEvent(playbackSnapshot.event, width, height, viewState);
    }

    if (viewState.config.render.showTrails) {
      this.drawTrails(entities, width, height);
    }

    this.drawEntities(entities, width, height, viewState.config.render, hotThreshold);
  }

  drawBackground(width, height) {
    const gradient = this.context.createLinearGradient(0, 0, width, height);

    gradient.addColorStop(0, '#040816');
    gradient.addColorStop(0.5, '#0a132d');
    gradient.addColorStop(1, '#060913');

    this.context.fillStyle = gradient;
    this.context.fillRect(0, 0, width, height);

    for (let index = 0; index < 50; index += 1) {
      const x = ((index * 73) % width) + 0.5;
      const y = ((index * 131) % height) + 0.5;
      const alpha = 0.05 + ((index % 7) * 0.01);

      this.context.fillStyle = `rgba(94, 230, 255, ${alpha})`;
      this.context.beginPath();
      this.context.arc(x, y, 1.2, 0, Math.PI * 2);
      this.context.fill();
    }
  }

  drawIdleState(width, height) {
    this.context.save();
    this.context.textAlign = 'center';
    this.context.fillStyle = 'rgba(237, 244, 255, 0.9)';
    this.context.font = '600 22px "Segoe UI"';
    this.context.fillText('Запустите симуляцию, чтобы заполнить поле', width / 2, height / 2 - 12);
    this.context.fillStyle = 'rgba(159, 180, 208, 0.9)';
    this.context.font = '400 14px "Segoe UI"';
    this.context.fillText(
      'Поле локально проигрывает шаги бэкенда, поэтому пауза, продолжение и прокрутка работают мгновенно.',
      width / 2,
      height / 2 + 18,
    );
    this.context.restore();
  }

  drawLinks(entities, width, height, linkDistance) {
    const threshold = linkDistance * Math.min(width, height);

    for (let index = 0; index < entities.length; index += 1) {
      const entity = entities[index];
      const maxNeighbors = entity.segment === 'reactive' ? 6 : entity.segment === 'stable' ? 3 : 4;
      let drawn = 0;

      for (let nextIndex = index + 1; nextIndex < entities.length; nextIndex += 1) {
        const other = entities[nextIndex];
        const dx = (entity.x - other.x) * width;
        const dy = (entity.y - other.y) * height;
        const distance = Math.hypot(dx, dy);

        if (distance > threshold) {
          continue;
        }

        const opacity = clamp(1 - distance / threshold, 0, 1) * 0.22;

        this.context.beginPath();
        this.context.moveTo(entity.x * width, entity.y * height);
        this.context.lineTo(other.x * width, other.y * height);
        this.context.strokeStyle = `rgba(94, 230, 255, ${opacity})`;
        this.context.lineWidth = entity.isFrozen || other.isFrozen ? 0.6 : 1.1;
        this.context.stroke();

        drawn += 1;

        if (drawn >= maxNeighbors) {
          break;
        }
      }
    }
  }

  drawEvent(event, width, height, viewState) {
    const x = event.x * width;
    const y = event.y * height;
    const intensity = clamp(event.intensity ?? 0, 0, 1);
    const radius = Math.max(42, intensity * 120);
    const gradient = this.context.createRadialGradient(x, y, 0, x, y, radius * 1.8);

    gradient.addColorStop(0, `rgba(255, 117, 216, ${0.24 + intensity * 0.22})`);
    gradient.addColorStop(0.4, `rgba(94, 230, 255, ${0.12 + intensity * 0.1})`);
    gradient.addColorStop(1, 'rgba(94, 230, 255, 0)');
    this.context.fillStyle = gradient;
    this.context.beginPath();
    this.context.arc(x, y, radius * 1.8, 0, Math.PI * 2);
    this.context.fill();

    if (viewState.config.render.showClusterRing && viewState.run.debug?.clusterRadius) {
      const clusterRadius = viewState.run.debug.clusterRadius * Math.min(width, height);

      this.context.beginPath();
      this.context.arc(x, y, clusterRadius, 0, Math.PI * 2);
      this.context.strokeStyle = `rgba(94, 230, 255, ${0.18 + intensity * 0.2})`;
      this.context.lineWidth = 1.2;
      this.context.stroke();
    }

    this.context.beginPath();
    this.context.arc(x, y, Math.max(6, 12 * intensity), 0, Math.PI * 2);
    this.context.fillStyle = 'rgba(255, 255, 255, 0.95)';
    this.context.fill();
  }

  drawTrails(entities, width, height) {
    for (const entity of entities) {
      this.context.beginPath();
      this.context.moveTo(entity.prevX * width, entity.prevY * height);
      this.context.lineTo(entity.x * width, entity.y * height);
      this.context.strokeStyle = `rgba(94, 230, 255, ${0.1 + entity.velocity * 0.35})`;
      this.context.lineWidth = 1;
      this.context.stroke();
    }
  }

  drawEntities(entities, width, height, renderConfig, hotThreshold) {
    for (const entity of entities) {
      const stateMeta = STATE_META[entity.currentState] ?? STATE_META.interested;
      const glowStrength = 8 + entity.temperature * 20;
      const sizeMultiplier =
        entity.segment === 'reactive' ? 1.15 : entity.segment === 'stable' ? 0.92 : 1;
      const radius = (2.8 + entity.temperature * 5) * renderConfig.nodeScale * sizeMultiplier;
      const alpha = entity.isFrozen && renderConfig.showResidualHints ? 0.46 : 0.9;
      const x = entity.x * width;
      const y = entity.y * height;

      this.context.save();
      this.context.shadowBlur = glowStrength;
      this.context.shadowColor = stateMeta.color;
      this.context.fillStyle = this.withAlpha(stateMeta.color, alpha);
      this.context.beginPath();
      this.context.arc(x, y, radius, 0, Math.PI * 2);
      this.context.fill();

      if (entity.temperature >= hotThreshold) {
        this.context.beginPath();
        this.context.arc(x, y, radius + 3, 0, Math.PI * 2);
        this.context.strokeStyle = 'rgba(255, 247, 173, 0.8)';
        this.context.lineWidth = 1.2;
        this.context.stroke();
      }

      if (renderConfig.showVelocityVectors && entity.velocity > 0.02) {
        const directionX = x - entity.prevX * width;
        const directionY = y - entity.prevY * height;

        this.context.beginPath();
        this.context.moveTo(x, y);
        this.context.lineTo(x + directionX * 2.2, y + directionY * 2.2);
        this.context.strokeStyle = 'rgba(94, 230, 255, 0.5)';
        this.context.lineWidth = 1.1;
        this.context.stroke();
      }

      this.context.restore();

      if (renderConfig.showLabels || renderConfig.showIds) {
        this.context.save();
        this.context.font = '12px "Segoe UI"';
        this.context.fillStyle = 'rgba(237, 244, 255, 0.92)';
        this.context.fillText(
          renderConfig.showIds ? entity.id : stateMeta.label,
          x + radius + 4,
          y - radius - 2,
        );
        this.context.restore();
      }
    }
  }

  withAlpha(hexColor, alpha) {
    const normalized = hexColor.replace('#', '');

    if (normalized.length !== 6) {
      return `rgba(255, 255, 255, ${alpha})`;
    }

    const red = Number.parseInt(normalized.slice(0, 2), 16);
    const green = Number.parseInt(normalized.slice(2, 4), 16);
    const blue = Number.parseInt(normalized.slice(4, 6), 16);

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }
}
