import { assertIsolatedPostgresUrl, isIsolatedPostgresUrl } from './isolated-database';

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
