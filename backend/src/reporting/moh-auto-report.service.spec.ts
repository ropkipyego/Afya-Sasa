import { Logger } from '@nestjs/common';
import { MohAutoReportService } from './moh-auto-report.service';

const ENV_KEY = 'MOH_AUTO_REPORT_ENABLED';
const originalEnv = process.env[ENV_KEY];

function restoreEnv() {
  if (originalEnv === undefined) {
    delete process.env[ENV_KEY];
  } else {
    process.env[ENV_KEY] = originalEnv;
  }
}

function createService() {
  const mohReports = {
    moh705a: jest.fn().mockResolvedValue({ lines: [] }),
    moh705b: jest.fn().mockResolvedValue({ lines: [] }),
    moh706: jest.fn().mockResolvedValue({}),
    moh717: jest.fn().mockResolvedValue({}),
  };
  const adminService = {
    resolveFacilityContext: jest.fn().mockResolvedValue({ name: 'Jalaram' }),
    listActiveAdministrators: jest.fn().mockResolvedValue([{ id: 'admin-1' }]),
  };
  const notifications = {
    create: jest.fn((row: unknown) => row),
    save: jest.fn(async (row: unknown) => row),
  };
  return {
    service: new MohAutoReportService(
      mohReports as never,
      adminService as never,
      notifications as never,
    ),
    mohReports,
    notifications,
  };
}

function schedulerTimeouts(spy: jest.SpyInstance) {
  return spy.mock.calls.filter((call) => call[1] === 20_000);
}

function schedulerIntervals(spy: jest.SpyInstance) {
  return spy.mock.calls.filter((call) => call[1] === 60 * 60 * 1000);
}

describe('MohAutoReportService scheduler flag', () => {
  let service: MohAutoReportService | undefined;
  let setIntervalSpy: jest.SpyInstance;
  let setTimeoutSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    setIntervalSpy = jest.spyOn(global, 'setInterval');
    setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    setIntervalSpy.mockClear();
    setTimeoutSpy.mockClear();
  });

  afterEach(() => {
    service?.onModuleDestroy();
    service = undefined;
    restoreEnv();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('starts the scheduler when the environment variable is unset', () => {
    delete process.env[ENV_KEY];
    service = createService().service;
    service.onModuleInit();

    expect(schedulerIntervals(setIntervalSpy)).toHaveLength(1);
    expect(schedulerTimeouts(setTimeoutSpy)).toHaveLength(1);
    expect(logSpy).toHaveBeenCalledWith('MOH auto-report scheduler started');
  });

  it('starts the scheduler when explicitly set to true', () => {
    process.env[ENV_KEY] = 'true';
    service = createService().service;
    service.onModuleInit();

    expect(schedulerIntervals(setIntervalSpy)).toHaveLength(1);
    expect(schedulerTimeouts(setTimeoutSpy)).toHaveLength(1);
    expect(logSpy).toHaveBeenCalledWith('MOH auto-report scheduler started');
  });

  it('does not start the scheduler when explicitly set to false', () => {
    process.env[ENV_KEY] = 'false';
    service = createService().service;
    service.onModuleInit();

    expect(logSpy).toHaveBeenCalledWith('MOH auto-report scheduler disabled');
    expect(logSpy).not.toHaveBeenCalledWith('MOH auto-report scheduler started');
  });

  it('does not call setTimeout or setInterval when disabled', () => {
    process.env[ENV_KEY] = 'false';
    service = createService().service;
    setIntervalSpy.mockClear();
    setTimeoutSpy.mockClear();
    service.onModuleInit();

    expect(schedulerIntervals(setIntervalSpy)).toHaveLength(0);
    expect(schedulerTimeouts(setTimeoutSpy)).toHaveLength(0);
  });

  it('keeps runForCurrentMonth callable when the scheduler is disabled', async () => {
    process.env[ENV_KEY] = 'false';
    const created = createService();
    service = created.service;
    service.onModuleInit();

    const result = await service.runForCurrentMonth(new Date('2026-10-15T12:00:00Z'));

    expect(result.ok).toBe(true);
    expect(created.mohReports.moh705a).toHaveBeenCalled();
    expect(created.notifications.save).toHaveBeenCalled();
  });
});
