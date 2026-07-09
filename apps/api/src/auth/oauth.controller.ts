import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Public } from './jwt-auth.guard';
import { OAuthService, OAuthProviderKey } from './oauth.service';
import { AuditService } from '../audit/audit.service';

const PROVIDERS: OAuthProviderKey[] = ['google', 'microsoft', 'apple'];

function assertProvider(value: string): OAuthProviderKey {
  if (!PROVIDERS.includes(value as OAuthProviderKey)) {
    throw new BadRequestException(`Unknown OAuth provider: ${value}`);
  }
  return value as OAuthProviderKey;
}

@Controller('auth')
export class OAuthController {
  constructor(
    private readonly oauth: OAuthService,
    private readonly audit: AuditService,
  ) {}

  /** Which social providers are configured — drives the login buttons. */
  @Public()
  @Get('providers')
  providers(): Record<OAuthProviderKey, boolean> {
    return this.oauth.available();
  }

  @Public()
  @Get('oauth/:provider')
  start(
    @Param('provider') provider: string,
    @Query('locale') locale = 'ar',
    @Res() res: Response,
  ): void {
    res.redirect(this.oauth.authorizationUrl(assertProvider(provider), locale));
  }

  /** Google & Microsoft return via GET redirect. */
  @Public()
  @Get('oauth/:provider/callback')
  async callbackGet(
    @Param('provider') provider: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    await this.finish(assertProvider(provider), code, state, error, undefined, res);
  }

  /** Apple returns via POST (response_mode=form_post). */
  @Public()
  @Post('oauth/:provider/callback')
  async callbackPost(
    @Param('provider') provider: string,
    @Body() body: { code?: string; state?: string; error?: string; user?: string },
    @Res() res: Response,
  ): Promise<void> {
    await this.finish(assertProvider(provider), body.code ?? '', body.state ?? '', body.error, body.user, res);
  }

  private async finish(
    provider: OAuthProviderKey,
    code: string,
    state: string,
    error: string | undefined,
    appleUserJson: string | undefined,
    res: Response,
  ): Promise<void> {
    const webUrl = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
    if (error || !code) {
      res.redirect(`${webUrl}/ar/auth?error=oauth_denied`);
      return;
    }
    try {
      const { auth, locale } = await this.oauth.handleCallback(provider, code, state, appleUserJson);
      await this.audit.log(auth.user.id, 'login', 'user', auth.user.id, { provider });
      const payload = Buffer.from(JSON.stringify(auth)).toString('base64url');
      // token travels in the URL fragment — never sent to any server
      res.redirect(`${webUrl}/${locale}/auth/callback#session=${payload}`);
    } catch {
      res.redirect(`${webUrl}/ar/auth?error=oauth_failed`);
    }
  }
}
