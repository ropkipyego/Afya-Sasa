import { HealthController, databaseIsReachable } from './health.controller';

function jsonResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return response;
}

describe('databaseIsReachable', () => {
  it('returns true when SELECT 1 succeeds', async () => {
    expect(await databaseIsReachable({ query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) })).toBe(
      true,
    );
  });

  it('returns false when the query fails', async () => {
    expect(await databaseIsReachable({ query: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) })).toBe(
      false,
    );
  });

  it('returns false when the query exceeds the timeout', async () => {
    expect(
      await databaseIsReachable(
        {
          query: () => new Promise(() => undefined),
        },
        20,
      ),
    ).toBe(false);
  });
});

describe('HealthController', () => {
  it('keeps /health as a process liveness payload', () => {
    const controller = new HealthController({ query: jest.fn() } as never);
    expect(controller.check()).toEqual({ status: 'ok', service: 'afyasasa-backend' });
  });

  it('returns 200 ready when the database answers', async () => {
    const controller = new HealthController({
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as never);
    const response = jsonResponse();
    await controller.ready(response as never);
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ status: 'ready', service: 'afyasasa-backend' });
  });

  it('returns 503 not_ready without connection details when the database is down', async () => {
    const controller = new HealthController({
      query: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:5432')),
    } as never);
    const response = jsonResponse();
    await controller.ready(response as never);
    expect(response.statusCode).toBe(503);
    expect(response.body).toEqual({ status: 'not_ready', service: 'afyasasa-backend' });
    expect(JSON.stringify(response.body)).not.toMatch(/ECONNREFUSED|5432/);
  });
});
