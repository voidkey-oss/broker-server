import { Test, TestingModule } from '@nestjs/testing';
import { CredentialsService } from '../credentials.service';
import { CredentialBroker, CredentialResponse } from '@voidkey/broker-core';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { Logger } from '@nestjs/common';

// Mock fs module
jest.mock('fs');

// Mock js-yaml module
jest.mock('js-yaml');

// Mock Logger
jest.spyOn(Logger.prototype, 'log').mockImplementation();
jest.spyOn(Logger.prototype, 'error').mockImplementation();

// Mock CredentialBroker
jest.mock('@voidkey/broker-core', () => ({
  ...jest.requireActual('@voidkey/broker-core'),
  CredentialBroker: jest.fn().mockImplementation(() => ({
    loadIdpConfigFromFile: jest.fn(),
    mintCredentials: jest.fn(),
    listIdpProviders: jest.fn(),
    getAvailableKeysets: jest.fn(),
    getKeysetKeys: jest.fn(),
    getAllKeysForIdentity: jest.fn(),
    mintKey: jest.fn(),
    mintKeys: jest.fn(),
    getAvailableKeys: jest.fn(),
    getKeyConfiguration: jest.fn(),
    getIdpProvider: jest.fn()
  }))
}));

describe('CredentialsService', () => {
  let service: CredentialsService;
  let mockBroker: any;
  let loggerSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Setup fs mock
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.mkdirSync as jest.Mock).mockImplementation();
    (fs.readdirSync as jest.Mock).mockReturnValue([]);
    (fs.readFileSync as jest.Mock).mockReturnValue('');
    (yaml.load as jest.Mock).mockReturnValue({});
    
    // Setup the mock broker with all required methods
    const mockBrokerInstance = {
      loadIdpConfigFromFile: jest.fn(),
      mintCredentials: jest.fn(),
      listIdpProviders: jest.fn(),
      getAvailableKeysets: jest.fn(),
      getKeysetKeys: jest.fn(),
      getAllKeysForIdentity: jest.fn(),
      // New key-based methods
      mintKey: jest.fn(),
      mintKeys: jest.fn(),
      getAvailableKeys: jest.fn(),
      getKeyConfiguration: jest.fn(),
      getIdpProvider: jest.fn().mockReturnValue({
        validateToken: jest.fn().mockResolvedValue({ sub: 'test-subject' })
      })
    };
    
    (CredentialBroker as jest.Mock).mockImplementation(() => mockBrokerInstance);
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [CredentialsService],
    }).compile();

    service = module.get<CredentialsService>(CredentialsService);
    
    // Get the mock broker instance
    mockBroker = mockBrokerInstance;
    
    // Spy on logger
    loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    loggerSpy.mockRestore();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor and initialization', () => {
    it('should load IdP configuration from yaml files in config directory', async () => {
      // Mock fs to return true for directory existence and yaml files
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockReturnValue(['idp.yaml', 'other-config.yaml', 'readme.txt']);
      (fs.readFileSync as jest.Mock).mockReturnValue('clientIdps:\n  - name: test');
      (yaml.load as jest.Mock).mockReturnValue({ clientIdps: [{ name: 'test' }] });
      
      // Create a new instance to trigger constructor
      const module: TestingModule = await Test.createTestingModule({
        providers: [CredentialsService],
      }).compile();
      
      const newService = module.get<CredentialsService>(CredentialsService);
      const newMockBroker = (newService as any).broker;
      
      expect(fs.existsSync).toHaveBeenCalledWith(expect.stringContaining('config'));
      expect(fs.readdirSync).toHaveBeenCalledWith(expect.stringContaining('config'));
      expect(newMockBroker.loadIdpConfigFromFile).toHaveBeenCalledWith(expect.stringContaining('idp.yaml'));
      expect(newMockBroker.loadIdpConfigFromFile).toHaveBeenCalledWith(expect.stringContaining('other-config.yaml'));
    });

    it('should handle IdP configuration loading errors gracefully', async () => {
      // Setup mocks that will cause broker to throw error  
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockReturnValue(['bad-config.yaml']);
      (fs.readFileSync as jest.Mock).mockReturnValue('clientIdps:\n  - name: test');
      (yaml.load as jest.Mock).mockReturnValue({ clientIdps: [{ name: 'test' }] });
      
      // Mock the broker constructor to return a broker with failing loadIdpConfigFromFile
      const mockBrokerInstance = {
        loadIdpConfigFromFile: jest.fn().mockImplementation(() => {
          throw new Error('Config loading failed');
        }),
        listIdpProviders: jest.fn(),
        mintKey: jest.fn(),
        getAvailableKeys: jest.fn(),
        getIdpProvider: jest.fn()
      };
      
      (CredentialBroker as jest.Mock).mockImplementation(() => mockBrokerInstance);
      
      // Create service instance which should trigger the error during construction
      const errorModule: TestingModule = await Test.createTestingModule({
        providers: [CredentialsService],
      }).compile();
      
      const errorService = errorModule.get<CredentialsService>(CredentialsService);
      
      expect(errorService).toBeDefined();
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringMatching(/Failed to load/),
        expect.any(Error)
      );
    });

    it('should create config directory if it does not exist', async () => {
      // Mock fs to return false for directory existence
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (fs.readdirSync as jest.Mock).mockReturnValue([]);
      
      const module: TestingModule = await Test.createTestingModule({
        providers: [CredentialsService],
      }).compile();
      
      const newService = module.get<CredentialsService>(CredentialsService);
      
      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('config'), { recursive: true });
    });

    it('should skip yaml files without IdP configuration', async () => {
      // Mock fs to return yaml files with mixed content
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockReturnValue(['idp.yaml', 'other-config.yaml']);
      (fs.readFileSync as jest.Mock)
        .mockReturnValueOnce('clientIdps:\n  - name: test')
        .mockReturnValueOnce('someOtherConfig: value');
      (yaml.load as jest.Mock)
        .mockReturnValueOnce({ clientIdps: [{ name: 'test' }] })
        .mockReturnValueOnce({ someOtherConfig: 'value' });
      
      const module: TestingModule = await Test.createTestingModule({
        providers: [CredentialsService],
      }).compile();
      
      const newService = module.get<CredentialsService>(CredentialsService);
      const newMockBroker = (newService as any).broker;
      
      // Should only load the file with IdP configuration
      expect(newMockBroker.loadIdpConfigFromFile).toHaveBeenCalledTimes(1);
      expect(newMockBroker.loadIdpConfigFromFile).toHaveBeenCalledWith(expect.stringContaining('idp.yaml'));
    });
  });


  describe('listIdpProviders', () => {
    it('should return list of IdP providers with default indicator', () => {
      const mockProviders = [
        { name: 'hello-world', isDefault: true },
        { name: 'custom-idp', isDefault: false }
      ];
      
      mockBroker.listIdpProviders.mockReturnValue(mockProviders);
      
      const result = service.listIdpProviders();
      
      expect(mockBroker.listIdpProviders).toHaveBeenCalled();
      expect(result).toEqual(mockProviders);
    });

    it('should return empty array when no providers configured', () => {
      mockBroker.listIdpProviders.mockReturnValue([]);
      
      const result = service.listIdpProviders();
      
      expect(result).toEqual([]);
    });
  });


  describe('extractSubjectFromToken', () => {
    it('should extract subject from valid token', async () => {
      const mockToken = 'valid.oidc.token';
      const mockSubject = 'test-subject-123';
      
      mockBroker.getIdpProvider.mockReturnValue({
        validateToken: jest.fn().mockResolvedValue({ sub: mockSubject })
      });
      
      const result = await service.extractSubjectFromToken(mockToken);
      
      expect(result).toBe(mockSubject);
    });

    it('should throw error for invalid token', async () => {
      const mockToken = 'invalid.token';
      
      mockBroker.getIdpProvider.mockReturnValue({
        validateToken: jest.fn().mockRejectedValue(new Error('Invalid token'))
      });
      
      await expect(service.extractSubjectFromToken(mockToken))
        .rejects.toThrow('Failed to extract subject from token');
    });
  });

  describe('mintKeys', () => {
    it('should mint specific keys successfully', async () => {
      const mockToken = 'valid.oidc.token';
      const mockKeys = ['MINIO_CREDENTIALS', 'AWS_CREDENTIALS'];
      const mockDuration = 1800;
      const mockResults: { [keyName: string]: CredentialResponse } = {
        MINIO_CREDENTIALS: {
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
        },
        AWS_CREDENTIALS: {
          credentials: {
            AWS_ACCESS_KEY_ID: 'AKIAAWS123',
            AWS_SECRET_ACCESS_KEY: 'awssecret123',
            AWS_SESSION_TOKEN: 'awssession123'
          },
          expiresAt: '2025-01-01T12:00:00Z',
          metadata: {
            provider: 'aws-test',
            keyName: 'AWS_CREDENTIALS'
          }
        }
      };
      
      mockBroker.mintKey.mockResolvedValueOnce(mockResults.MINIO_CREDENTIALS);
      mockBroker.mintKey.mockResolvedValueOnce(mockResults.AWS_CREDENTIALS);
      
      const result = await service.mintKeys(mockToken, undefined, mockKeys, mockDuration, false);
      
      expect(mockBroker.mintKey).toHaveBeenCalledWith(mockToken, 'MINIO_CREDENTIALS', undefined, mockDuration);
      expect(mockBroker.mintKey).toHaveBeenCalledWith(mockToken, 'AWS_CREDENTIALS', undefined, mockDuration);
      expect(result).toEqual(mockResults);
    });

    it('should mint all available keys when all flag is true', async () => {
      const mockToken = 'valid.oidc.token';
      const mockSubject = 'test-subject-123';
      const mockAvailableKeys = ['MINIO_CREDENTIALS', 'AWS_CREDENTIALS'];
      const mockResults: { [keyName: string]: CredentialResponse } = {
        MINIO_CREDENTIALS: {
          credentials: { MINIO_ACCESS_KEY_ID: 'test123' },
          expiresAt: '2025-01-01T12:00:00Z',
          metadata: { provider: 'minio-test', keyName: 'MINIO_CREDENTIALS' }
        },
        AWS_CREDENTIALS: {
          credentials: { AWS_ACCESS_KEY_ID: 'test456' },
          expiresAt: '2025-01-01T12:00:00Z',
          metadata: { provider: 'aws-test', keyName: 'AWS_CREDENTIALS' }
        }
      };
      
      mockBroker.getIdpProvider.mockReturnValue({
        validateToken: jest.fn().mockResolvedValue({ sub: mockSubject })
      });
      mockBroker.getAvailableKeys.mockReturnValue(mockAvailableKeys);
      mockBroker.mintKey.mockResolvedValueOnce(mockResults.MINIO_CREDENTIALS);
      mockBroker.mintKey.mockResolvedValueOnce(mockResults.AWS_CREDENTIALS);
      
      const result = await service.mintKeys(mockToken, undefined, undefined, undefined, true);
      
      expect(mockBroker.getAvailableKeys).toHaveBeenCalledWith(mockSubject);
      expect(mockBroker.mintKey).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockResults);
    });

    it('should throw error when no keys available for all flag', async () => {
      const mockToken = 'valid.oidc.token';
      const mockSubject = 'test-subject-123';
      
      mockBroker.getIdpProvider.mockReturnValue({
        validateToken: jest.fn().mockResolvedValue({ sub: mockSubject })
      });
      mockBroker.getAvailableKeys.mockReturnValue([]);
      
      await expect(service.mintKeys(mockToken, undefined, undefined, undefined, true))
        .rejects.toThrow('No keys available for identity');
    });

    it('should throw error when neither keys nor all flag provided', async () => {
      const mockToken = 'valid.oidc.token';
      
      await expect(service.mintKeys(mockToken, undefined, undefined, undefined, false))
        .rejects.toThrow('Either specify keys to mint or use --all flag');
    });

    it('should handle key minting failures', async () => {
      const mockToken = 'valid.oidc.token';
      const mockKeys = ['INVALID_KEY'];
      
      mockBroker.mintKey.mockRejectedValue(new Error('Key not found'));
      
      await expect(service.mintKeys(mockToken, undefined, mockKeys, undefined, false))
        .rejects.toThrow('Key not found');
    });
  });

  describe('getAvailableKeys', () => {
    it('should return available keys for subject', () => {
      const mockSubject = 'test-subject-123';
      const mockKeys = ['MINIO_CREDENTIALS', 'AWS_CREDENTIALS', 'GCP_CREDENTIALS'];
      
      mockBroker.getAvailableKeys.mockReturnValue(mockKeys);
      
      const result = service.getAvailableKeys(mockSubject);
      
      expect(mockBroker.getAvailableKeys).toHaveBeenCalledWith(mockSubject);
      expect(result).toEqual(mockKeys);
    });

    it('should return empty array for subject with no keys', () => {
      const mockSubject = 'no-keys-subject';
      
      mockBroker.getAvailableKeys.mockReturnValue([]);
      
      const result = service.getAvailableKeys(mockSubject);
      
      expect(result).toEqual([]);
    });
  });
});