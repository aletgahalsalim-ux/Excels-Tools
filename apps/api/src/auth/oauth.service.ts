import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createPrivateKey } from 'crypto';
import type { AuthResponseDto } from '@afdip/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

export type OAuthProviderKey = 'google' | 'microsoft' | 'apple';

interface ProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  clientId: string;
  clientSecret: () => Promise<string> | string;
  /** Apple requires form_post when requesting name/email */
  responseMode?: 'form_post';
}

interface IdTokenClaims {
  sub: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

/**
 * Social login (OIDC authorization-code flow) implemented directly against
 * Google / Microsoft / Apple — no external auth service. A provider becomes
 * available automatically once its credentials exist in the environment;
 * `available()` drives which buttons the web app shows.
 */
@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  available(): Record<OAuthProviderKey, boolean> {
    return {
      google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      microsoft: Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET),
      apple: Boolean(
        process.env.APPLE_CLIENT_ID &&
          process.env.APPLE_TEAM_ID &&
          process.env.APPLE_KEY_ID &&
          process.env.APPLE_PRIVATE_KEY,
      ),
    };
  }

  private config(provider: OAuthProviderKey): ProviderConfig {
    if (!this.available()[provider]) {
      throw new BadRequestException(`OAuth provider '${provider}' is not configured`);
    }
    switch (provider) {
      case 'google':
        return {
          authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
          tokenUrl: 'https://oauth2.googleapis.com/token',
          scope: 'openid email profile',
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: () => process.env.GOOGLE_CLIENT_SECRET!,
        };
      case 'microsoft':
        return {
          authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
          tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
          scope: 'openid email profile',
          clientId: process.env.MICROSOFT_CLIENT_ID!,
          clientSecret: () => process.env.MICROSOFT_CLIENT_SECRET!,
        };
      case 'apple':
        return {
          authorizeUrl: 'https://appleid.apple.com/auth/authorize',
          tokenUrl: 'https://appleid.apple.com/auth/token',
          scope: 'name email',
          clientId: process.env.APPLE_CLIENT_ID!,
          clientSecret: () => this.appleClientSecret(),
          responseMode: 'form_post',
        };
    }
  }

  private redirectUri(provider: OAuthProviderKey): string {
    const base = process.env.API_PUBLIC_URL ?? 'http://localhost:3001';
    return `${base}/api/v1/auth/oauth/${provider}/callback`;
  }

  /** Build the provider authorization URL with a signed short-lived state. */
  authorizationUrl(provider: OAuthProviderKey, locale: string, client: 'web' | 'mobile' = 'web'): string {
    const cfg = this.config(provider);
    const state = this.jwt.sign(
      { p: provider, l: locale, c: client, t: 'oauth-state' },
      { expiresIn: '10m' },
    );
    const params = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: this.redirectUri(provider),
      response_type: 'code',
      scope: cfg.scope,
      state,
    });
    if (cfg.responseMode) params.set('response_mode', cfg.responseMode);
    return `${cfg.authorizeUrl}?${params.toString()}`;
  }

  /** Validate state, exchange the code, upsert the user, return our JWT + locale. */
  async handleCallback(
    provider: OAuthProviderKey,
    code: string,
    state: string,
    appleUserJson?: string,
  ): Promise<{ auth: AuthResponseDto; locale: string; client: 'web' | 'mobile' }> {
    let statePayload: { p: string; l: string; c?: string; t: string };
    try {
      statePayload = this.jwt.verify(state);
    } catch {
      throw new BadRequestException('Invalid or expired OAuth state');
    }
    if (statePayload.t !== 'oauth-state' || statePayload.p !== provider) {
      throw new BadRequestException('OAuth state mismatch');
    }

    const claims = await this.exchangeCode(provider, code);
    if (!claims.sub) throw new BadRequestException('Provider returned no subject');

    // Apple sends the user's name only on FIRST authorization, as a form field
    if (provider === 'apple' && appleUserJson && !claims.name) {
      try {
        const u = JSON.parse(appleUserJson) as { name?: { firstName?: string; lastName?: string } };
        claims.name = [u.name?.firstName, u.name?.lastName].filter(Boolean).join(' ') || undefined;
      } catch {
        /* optional field — ignore malformed */
      }
    }

    const auth = await this.findOrCreateUser(provider, claims);
    return {
      auth,
      locale: statePayload.l === 'en' ? 'en' : 'ar',
      client: statePayload.c === 'mobile' ? 'mobile' : 'web',
    };
  }

  private async exchangeCode(provider: OAuthProviderKey, code: string): Promise<IdTokenClaims> {
    const cfg = this.config(provider);
    const res = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: cfg.clientId,
        client_secret: await cfg.clientSecret(),
        redirect_uri: this.redirectUri(provider),
      }),
    });
    if (!res.ok) {
      this.logger.error(`Token exchange with ${provider} failed: ${await res.text()}`);
      throw new BadRequestException(`Token exchange with ${provider} failed`);
    }
    const tokens = (await res.json()) as { id_token?: string };
    if (!tokens.id_token) throw new BadRequestException(`${provider} returned no id_token`);

    // The id_token comes directly from the provider's token endpoint over TLS,
    // so decoding its payload here (without re-verifying the signature) is safe.
    const payload = tokens.id_token.split('.')[1];
    return JSON.parse(Buffer.from(payload, 'base64url').toString()) as IdTokenClaims;
  }

  private async findOrCreateUser(
    provider: OAuthProviderKey,
    claims: IdTokenClaims,
  ): Promise<AuthResponseDto> {
    const name =
      claims.name ??
      [claims.given_name, claims.family_name].filter(Boolean).join(' ') ??
      claims.email?.split('@')[0] ??
      'User';

    // 1. exact provider identity
    let user = await this.prisma.user.findUnique({
      where: { authProvider_providerId: { authProvider: provider, providerId: claims.sub } },
      include: { role: true },
    });

    // 2. same verified email from an earlier local registration → link accounts
    if (!user && claims.email) {
      const byEmail = await this.prisma.user.findUnique({
        where: { email: claims.email },
        include: { role: true },
      });
      if (byEmail) {
        user = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: { authProvider: provider, providerId: claims.sub, avatarUrl: claims.picture },
          include: { role: true },
        });
      }
    }

    // 3. brand-new user → own organization, admin of it (same as local register)
    if (!user) {
      if (!claims.email) {
        throw new BadRequestException(`${provider} did not share an email address`);
      }
      const adminRole = await this.prisma.role.findUniqueOrThrow({ where: { key: 'admin' } });
      const org = await this.prisma.organization.create({ data: { name: `${name}'s Organization` } });
      user = await this.prisma.user.create({
        data: {
          email: claims.email,
          name,
          passwordHash: null,
          authProvider: provider,
          providerId: claims.sub,
          avatarUrl: claims.picture,
          organizationId: org.id,
          roleId: adminRole.id,
        },
        include: { role: true },
      });
    }

    return this.auth.issueToken(user.id, user.email, user.name, user.role.key, user.organizationId);
  }

  /** Apple's client_secret is a short-lived ES256 JWT signed with the developer key. */
  private appleClientSecret(): string {
    const privateKey = createPrivateKey(
      (process.env.APPLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    );
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(
      JSON.stringify({ alg: 'ES256', kid: process.env.APPLE_KEY_ID }),
    ).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        iss: process.env.APPLE_TEAM_ID,
        iat: now,
        exp: now + 600,
        aud: 'https://appleid.apple.com',
        sub: process.env.APPLE_CLIENT_ID,
      }),
    ).toString('base64url');
    const { createSign } = require('crypto') as typeof import('crypto');
    const signer = createSign('SHA256');
    signer.update(`${header}.${payload}`);
    const derSig = signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });
    return `${header}.${payload}.${derSig.toString('base64url')}`;
  }
}
