import { INITIAL_APP_STATE } from '../config.js';
import { mergePlain } from '../utils/formatters.js';

export class SessionStore {
  constructor() {
    this.state = structuredClone(INITIAL_APP_STATE);
    this.listeners = new Set();
  }

  getState() {
    return this.state;
  }

  update(patch) {
    this.state = mergePlain(this.state, patch);
    this.listeners.forEach((listener) => listener(this.state));
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.state);

    return () => {
      this.listeners.delete(listener);
    };
  }
}
