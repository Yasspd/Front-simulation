export class SimulationApiClient {
  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
  }

  async request(path, options = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Accept: 'application/json',
        ...options.headers,
      },
      ...options,
    });
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const payload = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const message =
        typeof payload === 'object' && payload && 'message' in payload
          ? payload.message
          : `Request failed with status ${response.status}`;
      throw new Error(String(message));
    }

    return payload;
  }

  fetchScenarios() {
    return this.request('/simulation/scenarios');
  }

  getLatestRun() {
    return this.request('/simulation/latest');
  }

  runSimulation(payload) {
    return this.request('/simulation/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }
}
