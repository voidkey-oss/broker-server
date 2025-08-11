import { Controller, Post, Get, Body, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { CredentialsService } from './credentials.service';
import { CredentialResponse } from '@voidkey/broker-core';

interface MintKeysDto {
  oidcToken: string;
  idpName?: string;
  keys?: string[];
  duration?: number;
  all?: boolean;
}

@Controller('credentials')
export class CredentialsController {
  constructor(private readonly credentialsService: CredentialsService) {}

  @Get('idp-providers')
  @HttpCode(HttpStatus.OK)
  async listIdpProviders(): Promise<Array<{ name: string; isDefault: boolean }>> {
    return this.credentialsService.listIdpProviders();
  }

  @Post('mint')
  @HttpCode(HttpStatus.OK)
  async mintKeys(@Body() mintDto: MintKeysDto): Promise<{ [keyName: string]: CredentialResponse }> {
    const { oidcToken, idpName, keys, duration, all } = mintDto;
    
    if (!oidcToken) {
      throw new Error('OIDC token is required');
    }

    return await this.credentialsService.mintKeys(oidcToken, idpName, keys, duration, all);
  }

  @Get('keys')
  @HttpCode(HttpStatus.OK)
  async getAvailableKeys(@Query('token') token: string): Promise<string[]> {
    if (!token) {
      throw new Error('Token parameter is required');
    }
    
    const subject = await this.credentialsService.extractSubjectFromToken(token);
    return this.credentialsService.getAvailableKeys(subject);
  }
}