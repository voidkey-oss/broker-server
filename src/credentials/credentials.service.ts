import { Injectable, Logger } from '@nestjs/common';
import { CredentialBroker, CredentialResponse, BrokerAuthProvider, ClientCredentialsProvider } from '@voidkey/broker-core';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

@Injectable()
export class CredentialsService {
  private readonly logger = new Logger(CredentialsService.name);
  private readonly broker: CredentialBroker;

  constructor() {
    this.broker = new CredentialBroker();
    this.loadIdpConfiguration();
  }

  private loadIdpConfiguration(): void {
    const configDir = process.env.CONFIG_DIR || path.join(process.cwd(), 'config');
    
    try {
      // Create directory if it doesn't exist
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
        this.logger.log(`Created configuration directory: ${configDir}`);
      }

      // Read all .yaml files from the directory
      const yamlFiles = fs.readdirSync(configDir)
        .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'))
        .map(file => path.join(configDir, file));

      if (yamlFiles.length === 0) {
        this.logger.log(`No YAML files found in ${configDir}, using default provider only`);
        return;
      }

      this.logger.log(`Found ${yamlFiles.length} YAML configuration file(s) in ${configDir}`);
      
      // Load each YAML file that contains IdP configuration
      for (const yamlFile of yamlFiles) {
        try {
          const configContent = fs.readFileSync(yamlFile, 'utf8');
          const config = yaml.load(configContent) as any;
          
          // Check if this file contains IdP configuration
          const hasConfig = config && (config.clientIdps || config.brokerIdp || config.clientIdentities);
          
          if (hasConfig) {
            this.logger.log(`Loading configuration from ${path.basename(yamlFile)}`);
            if (config.clientIdps) {
              this.logger.log(`  - Found ${config.clientIdps.length} client IdP(s)`);
            }
            if (config.brokerIdp) {
              this.logger.log(`  - Found broker IdP configuration (placeholder)`);
            }
            if (config.clientIdentities) {
              this.logger.log(`  - Found ${config.clientIdentities.length} client identities`);
            }
            
            this.broker.loadIdpConfigFromFile(yamlFile);
            this.logger.log(`✅ Successfully loaded config from ${path.basename(yamlFile)}`);
          } else {
            this.logger.debug(`Skipping ${path.basename(yamlFile)} - no recognized configuration found`);
          }
        } catch (error) {
          this.logger.error(`❌ Failed to load ${path.basename(yamlFile)}:`, error);
          // Continue loading other files even if one fails
        }
      }
      
      this.logger.log('✅ Configuration loading complete');
    } catch (error) {
      this.logger.error('❌ Failed to read configuration directory:', error);
      this.logger.log('Continuing with default provider only');
    }
  }

  listIdpProviders(): Array<{ name: string; isDefault: boolean }> {
    return this.broker.listIdpProviders();
  }

  async extractSubjectFromToken(oidcToken: string, idpName?: string): Promise<string> {
    // Use the broker to validate the token and extract the subject
    // Try the specified provider first, then fall back to hello-world
    try {
      const provider = this.broker.getIdpProvider(idpName);
      const claims = await provider.validateToken(oidcToken);
      return claims.sub;
    } catch (error) {
      // If specified provider fails, try hello-world as fallback
      try {
        const provider = this.broker.getIdpProvider('hello-world');
        const claims = await provider.validateToken(oidcToken);
        return claims.sub;
      } catch (defaultError) {
        throw new Error(`Failed to extract subject from token: ${defaultError.message}`);
      }
    }
  }

  // Key-based methods
  async mintKeys(oidcToken: string, idpName?: string, keys?: string[], duration?: number, all?: boolean): Promise<{ [keyName: string]: CredentialResponse }> {
    if (all) {
      // Get all available keys for the identity first
      const subject = await this.extractSubjectFromToken(oidcToken, idpName);
      const availableKeys = this.broker.getAvailableKeys(subject);
      
      if (availableKeys.length === 0) {
        throw new Error(`No keys available for identity`);
      }
      
      // Mint all available keys
      const results: { [keyName: string]: CredentialResponse } = {};
      for (const keyName of availableKeys) {
        try {
          results[keyName] = await this.broker.mintKey(oidcToken, keyName, idpName, duration);
        } catch (error) {
          this.logger.error(`Failed to mint key ${keyName}:`, error);
          throw error; // For now, fail fast. Could be made more resilient later.
        }
      }
      return results;
    } else if (keys && keys.length > 0) {
      // Mint specific keys
      const results: { [keyName: string]: CredentialResponse } = {};
      for (const keyName of keys) {
        try {
          results[keyName] = await this.broker.mintKey(oidcToken, keyName, idpName, duration);
        } catch (error) {
          this.logger.error(`Failed to mint key ${keyName}:`, error);
          throw error; // For now, fail fast. Could be made more resilient later.
        }
      }
      return results;
    } else {
      throw new Error('Either specify keys to mint or use --all flag');
    }
  }

  getAvailableKeys(subject: string): string[] {
    return this.broker.getAvailableKeys(subject);
  }
}