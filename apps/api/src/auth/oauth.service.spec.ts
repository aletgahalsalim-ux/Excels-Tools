import { JwtService } from '@nestjs/jwt';
import { OAuthService } from './oauth.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthService } from './auth.service';

const jwt = new JwtService({ secret: 'test-secret' });

const makeService = () =>
  new OAuthService({} as PrismaService, jwt, {
    issueToken: jest.fn().mockReturnValue({ accessToken: 't', user: {} }),
  } as unknown as AuthService);

describe('OAuthService', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.MICROSOFT_CLIENT_ID;
    delete process.env.MICROSOFT_CLIENT_SECRET;
    delete process.env.APPLE_CLIENT_ID;
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('reports only configured providers as available', () => {
    process.env.GOOGLE_CLIENT_ID = 'gid';
    process.env.GOOGLE_CLIENT_SECRET = 'gsecret';
    const svc = makeService();
    expect(svc.available()).toEqual({ google: true, microsoft: false, apple: false });
  });

  it('refuses to build an authorization URL for an unconfigured provider', () => {
    const svc = makeService();
    expect(() => svc.authorizationUrl('google', 'ar')).toThrow('not configured');
  });

  it('builds a Google authorization URL with signed state carrying the locale', () => {
    process.env.GOOGLE_CLIENT_ID = 'gid';
    process.env.GOOGLE_CLIENT_SECRET = 'gsecret';
    const svc = makeService();
    const url = new URL(svc.authorizationUrl('google', 'en'));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('gid');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('redirect_uri')).toContain('/api/v1/auth/oauth/google/callback');

    const state = jwt.verify<{ p: string; l: string; t: string }>(
      url.searchParams.get('state') ?? '',
    );
    expect(state).toMatchObject({ p: 'google', l: 'en', t: 'oauth-state' });
  });

  it('rejects a callback whose state was signed for another provider', async () => {
    process.env.GOOGLE_CLIENT_ID = 'gid';
    process.env.GOOGLE_CLIENT_SECRET = 'gsecret';
    process.env.MICROSOFT_CLIENT_ID = 'mid';
    process.env.MICROSOFT_CLIENT_SECRET = 'msecret';
    const svc = makeService();
    const googleState = new URL(svc.authorizationUrl('google', 'ar')).searchParams.get('state')!;
    await expect(svc.handleCallback('microsoft', 'code', googleState)).rejects.toThrow(
      'state mismatch',
    );
  });

  it('rejects a forged state token', async () => {
    process.env.GOOGLE_CLIENT_ID = 'gid';
    process.env.GOOGLE_CLIENT_SECRET = 'gsecret';
    const svc = makeService();
    await expect(svc.handleCallback('google', 'code', 'forged.state.token')).rejects.toThrow(
      'Invalid or expired',
    );
  });
});
