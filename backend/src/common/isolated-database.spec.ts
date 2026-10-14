import {
  assertDisposableInventoryTestUrl,
  assertDisposableLabTestUrl,
  assertIsolatedPostgresUrl,
  isIsolatedPostgresUrl,
} from './isolated-database';

describe('isolated PostgreSQL URL guard', () => {
  it('accepts loopback hosts only', () => {
    expect(isIsolatedPostgresUrl('postgres://afya:x@127.0.0.1:5432/afya_test')).toBe(true);
    expect(isIsolatedPostgresUrl('postgres://afya:x@localhost:5432/afya_test')).toBe(true);
    expect(isIsolatedPostgresUrl('postgres://afya:x@db.example.com:5432/afya')).toBe(false);
  });

  it('refuses a remote URL without echoing it', () => {
    expect(() =>
      assertIsolatedPostgresUrl('postgres://user:secret@10.0.0.8:5432/prod', 'LAB_TEST_DATABASE_URL'),
    ).toThrow(/localhost/);
  });
});

describe('disposable inventory test URL', () => {
  it('accepts only the inventory_it database on loopback', () => {
    expect(() =>
      assertDisposableInventoryTestUrl('postgres://inventory_it:x@127.0.0.1:55434/inventory_it'),
    ).not.toThrow();
  });

  it('refuses other local database names even on loopback', () => {
    expect(() =>
      assertDisposableInventoryTestUrl('postgres://afya:x@127.0.0.1:5433/afyasasa'),
    ).toThrow(/inventory_it/);
    expect(() =>
      assertDisposableInventoryTestUrl('postgres://postgres:x@127.0.0.1:5432/postgres'),
    ).toThrow(/inventory_it/);
  });
});

describe('disposable laboratory test URL', () => {
  it('accepts only the lab_it database on loopback', () => {
    expect(() =>
      assertDisposableLabTestUrl('postgres://lab_it:x@127.0.0.1:55435/lab_it'),
    ).not.toThrow();
  });

  it('refuses the hospital and inventory databases even on loopback', () => {
    expect(() =>
      assertDisposableLabTestUrl('postgres://afya:x@127.0.0.1:5433/afyasasa'),
    ).toThrow(/lab_it/);
    expect(() =>
      assertDisposableLabTestUrl('postgres://inventory_it:x@127.0.0.1:55434/inventory_it'),
    ).toThrow(/lab_it/);
  });
});
