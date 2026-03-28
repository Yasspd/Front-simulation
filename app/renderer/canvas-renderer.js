import { STATE_META } from '../config.js';
import { clamp } from '../utils/formatters.js';

const DRAG_THRESHOLD_PX = 6;

export class CanvasRenderer {
  constructor(canvas, onCanvasInject) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.onCanvasInject = onCanvasInject;
    this.camera = {
      centerX: 0.5,
      centerY: 0.5,
      scale: this.getDefaultScale(),
      minScale: 1,
      maxScale: 2.8,
    };
    this.userAdjustedCamera = false;
    this.activePointers = new Map();
    this.dragState = {
      pointerId: null,
      startClientX: 0,
      startClientY: 0,
      lastClientX: 0,
      lastClientY: 0,
      isDragging: false,
    };
    this.pinchState = null;

    this.canvas.style.touchAction = 'none';
    this.resize();
    this.bindEvents();
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      if (!this.userAdjustedCamera) {
        this.camera.scale = this.getDefaultScale();
      }

      this.resize();
    });
    this.canvas.addEventListener('pointerdown', (event) => this.handlePointerDown(event));
    this.canvas.addEventListener('pointermove', (event) => this.handlePointerMove(event));
    this.canvas.addEventListener('pointerup', (event) => this.handlePointerUp(event));
    this.canvas.addEventListener('pointercancel', (event) => this.handlePointerUp(event));
    this.canvas.addEventListener('wheel', (event) => this.handleWheel(event), {
      passive: false,
    });
    this.canvas.addEventListener('dblclick', () => this.resetCamera());
  }

  getDefaultScale() {
    return window.matchMedia('(max-width: 900px)').matches ? 1.14 : 1.05;
  }

  resetCamera() {
    this.camera = {
      ...this.camera,
      centerX: 0.5,
      centerY: 0.5,
      scale: this.getDefaultScale(),
    };
    this.userAdjustedCamera = false;
    this.ensureCameraBounds();
  }

  resize() {
    const pixelRatio = window.devicePixelRatio || 1;
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;

    this.canvas.width = Math.floor(width * pixelRatio);
    this.canvas.height = Math.floor(height * pixelRatio);
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    this.ensureCameraBounds();
  }

  ensureCameraBounds() {
    const halfVisibleWidth = 0.5 / this.camera.scale;
    const halfVisibleHeight = 0.5 / this.camera.scale;

    this.camera.centerX = clamp(this.camera.centerX, halfVisibleWidth, 1 - halfVisibleWidth);
    this.camera.centerY = clamp(this.camera.centerY, halfVisibleHeight, 1 - halfVisibleHeight);
  }

  handlePointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    this.activePointers.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY,
    });
    this.canvas.setPointerCapture(event.pointerId);

    if (this.activePointers.size === 1) {
      this.dragState = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        lastClientX: event.clientX,
        lastClientY: event.clientY,
        isDragging: false,
      };
      this.pinchState = null;
    } else if (this.activePointers.size === 2) {
      this.pinchState = this.createPinchState();
      this.dragState.isDragging = true;
    }
  }

  handlePointerMove(event) {
    if (!this.activePointers.has(event.pointerId)) {
      return;
    }

    this.activePointers.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY,
    });

    const rect = this.canvas.getBoundingClientRect();

    if (this.activePointers.size >= 2) {
      const nextPinchState = this.createPinchState();

      if (this.pinchState && nextPinchState) {
        const scaleFactor =
          this.pinchState.distance > 0
            ? nextPinchState.distance / this.pinchState.distance
            : 1;

        if (Number.isFinite(scaleFactor) && Math.abs(scaleFactor - 1) > 0.01) {
          this.zoomAtPoint(scaleFactor, nextPinchState.centerX, nextPinchState.centerY, rect);
        }

        this.panByPixels(
          nextPinchState.centerX - this.pinchState.centerX,
          nextPinchState.centerY - this.pinchState.centerY,
          rect.width,
          rect.height,
        );
      }

      this.pinchState = nextPinchState;
      this.dragState.isDragging = true;
      return;
    }

    if (this.dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - this.dragState.lastClientX;
    const deltaY = event.clientY - this.dragState.lastClientY;
    const dragDistance = Math.hypot(
      event.clientX - this.dragState.startClientX,
      event.clientY - this.dragState.startClientY,
    );

    if (dragDistance >= DRAG_THRESHOLD_PX) {
      this.dragState.isDragging = true;
    }

    if (this.dragState.isDragging) {
      this.panByPixels(deltaX, deltaY, rect.width, rect.height);
    }

    this.dragState.lastClientX = event.clientX;
    this.dragState.lastClientY = event.clientY;
  }

  handlePointerUp(event) {
    if (!this.activePointers.has(event.pointerId)) {
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const wasPinching = this.activePointers.size >= 2;
    const shouldInject =
      this.dragState.pointerId === event.pointerId &&
      !this.dragState.isDragging &&
      !wasPinching;

    this.activePointers.delete(event.pointerId);
    this.canvas.releasePointerCapture(event.pointerId);

    if (shouldInject) {
      this.onCanvasInject(this.screenToWorld(event.clientX, event.clientY, rect));
    }

    if (this.activePointers.size < 2) {
      this.pinchState = null;
    }

    if (this.activePointers.size === 1) {
      const [nextPointerId, nextPointer] = Array.from(this.activePointers.entries())[0];

      this.dragState = {
        pointerId: nextPointerId,
        startClientX: nextPointer.clientX,
        startClientY: nextPointer.clientY,
        lastClientX: nextPointer.clientX,
        lastClientY: nextPointer.clientY,
        isDragging: false,
      };
      return;
    }

    this.dragState = {
      pointerId: null,
      startClientX: 0,
      startClientY: 0,
      lastClientX: 0,
      lastClientY: 0,
      isDragging: false,
    };
  }

  handleWheel(event) {
    event.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const scaleFactor = event.deltaY < 0 ? 1.12 : 0.9;

    this.zoomAtPoint(scaleFactor, event.clientX, event.clientY, rect);
  }

  createPinchState() {
    if (this.activePointers.size < 2) {
      return null;
    }

    const [firstPointer, secondPointer] = Array.from(this.activePointers.values());

    return {
      distance: Math.hypot(
        secondPointer.clientX - firstPointer.clientX,
        secondPointer.clientY - firstPointer.clientY,
      ),
      centerX: (firstPointer.clientX + secondPointer.clientX) / 2,
      centerY: (firstPointer.clientY + secondPointer.clientY) / 2,
    };
  }

  panByPixels(deltaX, deltaY, width, height) {
    if (!width || !height) {
      return;
    }

    const visibleWidth = 1 / this.camera.scale;
    const visibleHeight = 1 / this.camera.scale;

    this.camera.centerX -= (deltaX / width) * visibleWidth;
    this.camera.centerY -= (deltaY / height) * visibleHeight;
    this.userAdjustedCamera = true;
    this.ensureCameraBounds();
  }

  zoomAtPoint(scaleFactor, clientX, clientY, rect) {
    const nextScale = clamp(
      this.camera.scale * scaleFactor,
      this.camera.minScale,
      this.camera.maxScale,
    );

    if (Math.abs(nextScale - this.camera.scale) < 0.001) {
      return;
    }

    const worldPoint = this.screenToWorld(clientX, clientY, rect);
    const normalizedX = clamp((clientX - rect.left) / rect.width, 0, 1);
    const normalizedY = clamp((clientY - rect.top) / rect.height, 0, 1);

    this.camera.scale = nextScale;
    this.camera.centerX = worldPoint.x - (normalizedX - 0.5) * (1 / nextScale);
    this.camera.centerY = worldPoint.y - (normalizedY - 0.5) * (1 / nextScale);
    this.userAdjustedCamera = true;
    this.ensureCameraBounds();
  }

  screenToWorld(clientX, clientY, rect) {
    const visibleWidth = 1 / this.camera.scale;
    const visibleHeight = 1 / this.camera.scale;
    const normalizedX = clamp((clientX - rect.left) / rect.width, 0, 1);
    const normalizedY = clamp((clientY - rect.top) / rect.height, 0, 1);
    const minX = this.camera.centerX - visibleWidth / 2;
    const minY = this.camera.centerY - visibleHeight / 2;

    return {
      x: clamp(minX + normalizedX * visibleWidth, 0, 1),
      y: clamp(minY + normalizedY * visibleHeight, 0, 1),
    };
  }

  worldToScreen(x, y, width, height) {
    const visibleWidth = 1 / this.camera.scale;
    const visibleHeight = 1 / this.camera.scale;
    const minX = this.camera.centerX - visibleWidth / 2;
    const minY = this.camera.centerY - visibleHeight / 2;

    return {
      x: ((x - minX) / visibleWidth) * width,
      y: ((y - minY) / visibleHeight) * height,
    };
  }

  projectEntities(entities, width, height) {
    return entities.map((entity) => {
      const currentPosition = this.worldToScreen(entity.x, entity.y, width, height);
      const previousPosition = this.worldToScreen(entity.prevX, entity.prevY, width, height);

      return {
        ...entity,
        screenX: currentPosition.x,
        screenY: currentPosition.y,
        prevScreenX: previousPosition.x,
        prevScreenY: previousPosition.y,
      };
    });
  }

  render(viewState, playbackSnapshot) {
    const { width, height } = this.canvas.getBoundingClientRect();
    const hotThreshold = viewState.run?.debug?.visualHotThreshold ?? 0.7;

    this.drawBackground(width, height);

    if (!viewState.run || !playbackSnapshot.currentStep) {
      this.drawIdleState(width, height);
      return;
    }

    const entities = this.projectEntities(playbackSnapshot.entities, width, height);

    if (viewState.config.render.showLinks && entities.length <= 500) {
      this.drawLinks(entities, width, height, viewState.config.render.linkDistance);
    }

    if (viewState.config.render.showEventAura && playbackSnapshot.event) {
      this.drawEvent(playbackSnapshot.event, width, height, viewState);
    }

    if (viewState.config.render.showTrails) {
      this.drawTrails(entities);
    }

    this.drawEntities(entities, viewState.config.render, hotThreshold);
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
    this.context.fillText(
      'Запустите симуляцию, чтобы заполнить поле',
      width / 2,
      height / 2 - 12,
    );
    this.context.fillStyle = 'rgba(159, 180, 208, 0.9)';
    this.context.font = '400 14px "Segoe UI"';
    this.context.fillText(
      'Перетаскивайте поле мышью или пальцем. Колесо и щипок меняют масштаб.',
      width / 2,
      height / 2 + 18,
    );
    this.context.restore();
  }

  drawLinks(entities, width, height, linkDistance) {
    const threshold = linkDistance * Math.min(width, height) * this.camera.scale;

    for (let index = 0; index < entities.length; index += 1) {
      const entity = entities[index];
      const maxNeighbors =
        entity.segment === 'reactive' ? 6 : entity.segment === 'stable' ? 3 : 4;
      let drawn = 0;

      for (let nextIndex = index + 1; nextIndex < entities.length; nextIndex += 1) {
        const other = entities[nextIndex];
        const dx = entity.screenX - other.screenX;
        const dy = entity.screenY - other.screenY;
        const distance = Math.hypot(dx, dy);

        if (distance > threshold) {
          continue;
        }

        const opacity = clamp(1 - distance / threshold, 0, 1) * 0.22;

        this.context.beginPath();
        this.context.moveTo(entity.screenX, entity.screenY);
        this.context.lineTo(other.screenX, other.screenY);
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
    const position = this.worldToScreen(event.x, event.y, width, height);
    const intensity = clamp(event.intensity ?? 0, 0, 1);
    const radius = Math.max(42, intensity * 120) * this.camera.scale;
    const gradient = this.context.createRadialGradient(
      position.x,
      position.y,
      0,
      position.x,
      position.y,
      radius * 1.8,
    );

    gradient.addColorStop(0, `rgba(255, 117, 216, ${0.24 + intensity * 0.22})`);
    gradient.addColorStop(0.4, `rgba(94, 230, 255, ${0.12 + intensity * 0.1})`);
    gradient.addColorStop(1, 'rgba(94, 230, 255, 0)');
    this.context.fillStyle = gradient;
    this.context.beginPath();
    this.context.arc(position.x, position.y, radius * 1.8, 0, Math.PI * 2);
    this.context.fill();

    if (viewState.config.render.showClusterRing && viewState.run.debug?.clusterRadius) {
      const clusterRadius =
        viewState.run.debug.clusterRadius * Math.min(width, height) * this.camera.scale;

      this.context.beginPath();
      this.context.arc(position.x, position.y, clusterRadius, 0, Math.PI * 2);
      this.context.strokeStyle = `rgba(94, 230, 255, ${0.18 + intensity * 0.2})`;
      this.context.lineWidth = 1.2;
      this.context.stroke();
    }

    this.context.beginPath();
    this.context.arc(position.x, position.y, Math.max(6, 12 * intensity), 0, Math.PI * 2);
    this.context.fillStyle = 'rgba(255, 255, 255, 0.95)';
    this.context.fill();
  }

  drawTrails(entities) {
    for (const entity of entities) {
      this.context.beginPath();
      this.context.moveTo(entity.prevScreenX, entity.prevScreenY);
      this.context.lineTo(entity.screenX, entity.screenY);
      this.context.strokeStyle = `rgba(94, 230, 255, ${0.1 + entity.velocity * 0.35})`;
      this.context.lineWidth = 1;
      this.context.stroke();
    }
  }

  drawEntities(entities, renderConfig, hotThreshold) {
    for (const entity of entities) {
      const stateMeta = STATE_META[entity.currentState] ?? STATE_META.interested;
      const glowStrength = 8 + entity.temperature * 20;
      const sizeMultiplier =
        entity.segment === 'reactive' ? 1.15 : entity.segment === 'stable' ? 0.92 : 1;
      const radius =
        (2.8 + entity.temperature * 5) *
        renderConfig.nodeScale *
        sizeMultiplier *
        this.camera.scale;
      const alpha = entity.isFrozen && renderConfig.showResidualHints ? 0.46 : 0.9;

      this.context.save();
      this.context.shadowBlur = glowStrength;
      this.context.shadowColor = stateMeta.color;
      this.context.fillStyle = this.withAlpha(stateMeta.color, alpha);
      this.context.beginPath();
      this.context.arc(entity.screenX, entity.screenY, radius, 0, Math.PI * 2);
      this.context.fill();

      if (entity.temperature >= hotThreshold) {
        this.context.beginPath();
        this.context.arc(entity.screenX, entity.screenY, radius + 3, 0, Math.PI * 2);
        this.context.strokeStyle = 'rgba(255, 247, 173, 0.8)';
        this.context.lineWidth = 1.2;
        this.context.stroke();
      }

      if (renderConfig.showVelocityVectors && entity.velocity > 0.02) {
        const directionX = entity.screenX - entity.prevScreenX;
        const directionY = entity.screenY - entity.prevScreenY;

        this.context.beginPath();
        this.context.moveTo(entity.screenX, entity.screenY);
        this.context.lineTo(
          entity.screenX + directionX * 2.2,
          entity.screenY + directionY * 2.2,
        );
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
          entity.screenX + radius + 4,
          entity.screenY - radius - 2,
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
