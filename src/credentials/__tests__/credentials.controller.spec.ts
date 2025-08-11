import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { CredentialsController } from '../credentials.controller';
import { CredentialsService } from '../credentials.service';
import { CredentialResponse } from '@voidkey/broker-core';

// Mock the CredentialsService
jest.mock('../credentials.service');

describe('CredentialsController', () => {
  let app: INestApplication;
  let credentialsService: CredentialsService;

  const mockKeyCredentialResponse: CredentialResponse = {
    credentials: {
      MINIO_ACCESS_KEY_ID: 'AKIATEST123',
      MINIO_SECRET_ACCESS_KEY: 'secret123',
      MINIO_SESSION_TOKEN: 'session123',
      MINIO_EXPIRATION: '2025-01-01T12:00:00Z',
      MINIO_ENDPOINT: 'http://localhost:9000'
    },
    expiresAt: '2025-01-01T12:00:00Z',
    metadata: {
      provider: 'minio-test',
      keyName: 'MINIO_CREDENTIALS'
    }
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CredentialsController],
      providers: [
        {
          provide: CredentialsService,
          useValue: {
            listIdpProviders: jest.fn(),
            extractSubjectFromToken: jest.fn(),
            mintKeys: jest.fn(),
            getAvailableKeys: jest.fn()
          }
        }
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    credentialsService = module.get<CredentialsService>(CredentialsService);
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe('POST /credentials/mint', () => {
    it('should mint specific keys successfully', async () => {
      const mockResults = {
        MINIO_CREDENTIALS: mockKeyCredentialResponse,
        AWS_CREDENTIALS: {
          ...mockKeyCredentialResponse,
          credentials: {
            AWS_ACCESS_KEY_ID: 'AKIAAWS123',
            AWS_SECRET_ACCESS_KEY: 'awssecret123',
            AWS_SESSION_TOKEN: 'awssession123'
          },
          metadata: {
            provider: 'aws-test',
            keyName: 'AWS_CREDENTIALS'
          }
        }
      };

      (credentialsService.mintKeys as jest.Mock).mockResolvedValue(mockResults);

      const response = await request(app.getHttpServer())
        .post('/credentials/mint')
        .send({
          oidcToken: 'valid.token',
          keys: ['MINIO_CREDENTIALS', 'AWS_CREDENTIALS'],
          duration: 1800
        })
        .expect(200);

      expect(response.body).toEqual(mockResults);
      expect(credentialsService.mintKeys).toHaveBeenCalledWith('valid.token', undefined, ['MINIO_CREDENTIALS', 'AWS_CREDENTIALS'], 1800, undefined);
    });

    it('should mint all available keys when all flag is true', async () => {
      const mockResults = {
        MINIO_CREDENTIALS: mockKeyCredentialResponse
      };

      (credentialsService.mintKeys as jest.Mock).mockResolvedValue(mockResults);

      const response = await request(app.getHttpServer())
        .post('/credentials/mint')
        .send({
          oidcToken: 'valid.token',
          all: true
        })
        .expect(200);

      expect(response.body).toEqual(mockResults);
      expect(credentialsService.mintKeys).toHaveBeenCalledWith('valid.token', undefined, undefined, undefined, true);
    });

    it('should work with specific IdP', async () => {
      const mockResults = {
        MINIO_CREDENTIALS: mockKeyCredentialResponse
      };

      (credentialsService.mintKeys as jest.Mock).mockResolvedValue(mockResults);

      const response = await request(app.getHttpServer())
        .post('/credentials/mint')
        .send({
          oidcToken: 'valid.token',
          idpName: 'keycloak-client',
          keys: ['MINIO_CREDENTIALS']
        })
        .expect(200);

      expect(response.body).toEqual(mockResults);
      expect(credentialsService.mintKeys).toHaveBeenCalledWith('valid.token', 'keycloak-client', ['MINIO_CREDENTIALS'], undefined, undefined);
    });

    it('should return 500 when oidcToken is missing', async () => {
      await request(app.getHttpServer())
        .post('/credentials/mint')
        .send({
          keys: ['MINIO_CREDENTIALS']
        })
        .expect(500);
    });

    it('should return 500 when oidcToken is empty', async () => {
      await request(app.getHttpServer())
        .post('/credentials/mint')
        .send({
          oidcToken: '',
          keys: ['MINIO_CREDENTIALS']
        })
        .expect(500);
    });

    it('should handle service errors gracefully', async () => {
      const errorMessage = 'Key not found';
      (credentialsService.mintKeys as jest.Mock).mockRejectedValue(new Error(errorMessage));

      const response = await request(app.getHttpServer())
        .post('/credentials/mint')
        .send({
          oidcToken: 'valid.token',
          keys: ['INVALID_KEY']
        })
        .expect(500);

      expect(response.body).toHaveProperty('statusCode', 500);
      expect(response.body).toHaveProperty('message', 'Internal server error');
    });
  });

  describe('GET /credentials/idp-providers', () => {
    it('should return list of IdP providers', async () => {
      const mockProviders = [
        { name: 'hello-world', isDefault: true },
        { name: 'keycloak-client', isDefault: false },
        { name: 'github-actions', isDefault: false }
      ];

      (credentialsService.listIdpProviders as jest.Mock).mockReturnValue(mockProviders);

      const response = await request(app.getHttpServer())
        .get('/credentials/idp-providers')
        .expect(200);

      expect(response.body).toEqual(mockProviders);
      expect(credentialsService.listIdpProviders).toHaveBeenCalled();
    });

    it('should return empty array when no providers configured', async () => {
      (credentialsService.listIdpProviders as jest.Mock).mockReturnValue([]);

      const response = await request(app.getHttpServer())
        .get('/credentials/idp-providers')
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });


  describe('GET /credentials/keys', () => {
    it('should return available keys for valid token', async () => {
      const mockKeys = ['MINIO_CREDENTIALS', 'AWS_CREDENTIALS', 'GCP_CREDENTIALS'];

      (credentialsService.extractSubjectFromToken as jest.Mock).mockResolvedValue('test-subject-123');
      (credentialsService.getAvailableKeys as jest.Mock).mockReturnValue(mockKeys);

      const response = await request(app.getHttpServer())
        .get('/credentials/keys?token=valid.token.here')
        .expect(200);

      expect(response.body).toEqual(mockKeys);
      expect(credentialsService.extractSubjectFromToken).toHaveBeenCalledWith('valid.token.here');
      expect(credentialsService.getAvailableKeys).toHaveBeenCalledWith('test-subject-123');
    });

    it('should return empty array for subject with no keys', async () => {
      (credentialsService.extractSubjectFromToken as jest.Mock).mockResolvedValue('no-keys-subject');
      (credentialsService.getAvailableKeys as jest.Mock).mockReturnValue([]);

      const response = await request(app.getHttpServer())
        .get('/credentials/keys?token=valid.token.here')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return 500 when token parameter is missing', async () => {
      await request(app.getHttpServer())
        .get('/credentials/keys')
        .expect(500);
    });

    it('should return 500 when token is invalid', async () => {
      (credentialsService.extractSubjectFromToken as jest.Mock).mockRejectedValue(new Error('Invalid token'));

      await request(app.getHttpServer())
        .get('/credentials/keys?token=invalid.token')
        .expect(500);
    });
  });
});