function parseRetryAfter(headerValue) {
  if (!headerValue) {
    return null;
  }

  const retryAfterSeconds = Number(headerValue);

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return retryAfterSeconds * 1000;
  }

  const retryAt = Date.parse(headerValue);

  if (Number.isNaN(retryAt)) {
    return null;
  }

  return Math.max(0, retryAt - Date.now());
}

function buildRequestKey(url, options) {
  const method = (options.method ?? 'GET').toUpperCase();
  const body = typeof options.body === 'string' ? options.body : '';

  return `${method}:${url}:${body}`;
}

function normalizeOrigin(origin) {
  return origin.replace(/\/+$/, '');
}

function resolveApiBaseUrl() {
  const configuredOrigin =
    globalThis.window?.__SIMULATION_BACKEND_ORIGIN__ ||
    globalThis.document
      ?.querySelector('meta[name="simulation-backend-origin"]')
      ?.getAttribute('content')
      ?.trim();

  if (configuredOrigin) {
    return `${normalizeOrigin(configuredOrigin)}/simulation`;
  }

  return 'http://127.0.0.1:3000/simulation';
}

export class SimulationApiError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'SimulationApiError';
    Object.assign(this, details);
  }
}

export class SimulationApiClient {
  constructor(baseUrl = resolveApiBaseUrl()) {
    this.baseUrl = baseUrl;
    this.inFlightRequests = new Map();
  }

  async request(path, options = {}) {
    const requestUrl = `${this.baseUrl}${path}`;
    const requestOptions = {
      headers: {
        Accept: 'application/json',
        ...options.headers,
      },
      ...options,
    };
    const requestKey = buildRequestKey(requestUrl, requestOptions);
    const existingRequest = this.inFlightRequests.get(requestKey);

    if (existingRequest) {
      return existingRequest;
    }

    const requestPromise = this.performRequest(requestUrl, requestOptions).finally(
      () => {
        this.inFlightRequests.delete(requestKey);
      },
    );

    this.inFlightRequests.set(requestKey, requestPromise);

    return requestPromise;
  }

  async performRequest(requestUrl, requestOptions) {
    const response = await fetch(requestUrl, requestOptions);
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const payload = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const message =
        typeof payload === 'object' && payload && 'message' in payload
          ? payload.message
          : `Request failed with status ${response.status}`;

      throw new SimulationApiError(String(message), {
        status: response.status,
        payload,
        requestUrl,
        retryAfterMs: parseRetryAfter(response.headers.get('retry-after')),
      });
    }

    return payload;
  }

  fetchScenarios() {
    return this.request('/scenarios');
  }

  getLatestRun() {
    return this.request('/latest');
  }

  runSimulation(payload) {
    return this.request('/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }
}
