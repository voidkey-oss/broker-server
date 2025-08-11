# Voidkey Broker Server

A NestJS HTTP server that exposes the Voidkey zero-trust credential broker API endpoints.

## Overview

The broker-server provides HTTP endpoints for the Voidkey credential broker system. It wraps the broker-core library and exposes RESTful APIs for credential minting, key listing, and system health checks. Built with NestJS, it provides enterprise-grade features like dependency injection, middleware support, and comprehensive logging.

## Architecture

The broker-server acts as the HTTP interface in the zero-trust credential broker workflow:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │──▶│  Client IdP │    │   Voidkey   │──▶│  Broker IdP │──▶│   Access    │
│     CLI     │    │  (Auth0,    │    │   Broker    │    │ (Keycloak,  │    │  Provider   │
│             │    │ GitHub, etc)│    │             │    │  Okta, etc) │    │    (STS)    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │                   │                   │
       │ 1. Get client     │                   │                   │                   │
       │    OIDC token     │                   │                   │                   │
       │◀─────────────────│                   │                   │                   │
       │                                       │                   │                   │
       │ 2. Request credentials with token     │                   │                   │
       │─────────────────────────────────────▶│                   │                   │
       │                                       │                   │                   │
       │                             3. Validate client token      │                   │
       │                                       │                   │                   │
       │                                       │ 4. Get broker     │                   │
       │                                       │    OIDC token     │                   │
       │                                       │◀─────────────────│                   │
       │                                       │                                       │
       │                                       │ 5. Mint credentials with broker token │
       │                                       │─────────────────────────────────────▶│
       │                                       │                                       │
       │                                       │ 6. Return temp credentials            │
       │                                       │◀─────────────────────────────────────│
       │                                       │                                       │
       │ 7. Return temp credentials to client  │                                       │
       │◀─────────────────────────────────────│                                       │
       │                                                                               │
       │ 8. Use credentials for operations                                             │
       │─────────────────────────────────────────────────────────────────────────────▶│
```

## Installation

```bash
npm install
```

## Development

### Build and Run

```bash
npm run build          # Build for production
npm run start          # Run production server
npm run dev            # Development server with ts-node
```

### Testing

```bash
npm run test           # Run Jest tests
npm run test:watch     # Watch mode testing
npm run test:cov       # Coverage report
npm run test:debug     # Debug mode testing
```

## API Endpoints

### POST /credentials/mint

Mint credentials for specified keys using an OIDC token.

**Request:**
```bash
curl -X POST http://localhost:3000/credentials/mint \
  -H "Content-Type: application/json" \
  -d '{
    "token": "eyJhbGciOiJSUzI1NiIs...",
    "keys": ["s3-readonly", "s3-readwrite"]
  }'
```

**Response:**
```json
{
  "credentials": [
    {
      "key": "s3-readonly",
      "credentials": {
        "AccessKeyId": "AKIA...",
        "SecretAccessKey": "secret...",
        "SessionToken": "token...",
        "Expiration": "2024-01-01T12:00:00Z"
      }
    }
  ]
}
```

### GET /credentials/keys

List available keys for a subject based on their OIDC token.

**Request:**
```bash
curl -X GET "http://localhost:3000/credentials/keys?token=eyJhbGciOiJSUzI1NiIs..."
```

**Response:**
```json
{
  "keys": ["s3-readonly", "s3-readwrite", "ci-deployment"]
}
```

### GET /credentials/idp-providers

List configured identity providers.

**Request:**
```bash
curl -X GET http://localhost:3000/credentials/idp-providers
```

**Response:**
```json
{
  "providers": [
    {
      "id": "github-actions",
      "type": "github",
      "issuer": "https://token.actions.githubusercontent.com"
    },
    {
      "id": "auth0",
      "type": "auth0", 
      "issuer": "https://myorg.auth0.com/"
    }
  ]
}
```

### GET /health

Health check endpoint for monitoring and load balancers.

**Request:**
```bash
curl -X GET http://localhost:3000/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00Z",
  "uptime": 3600
}
```

## Configuration

### Environment Variables

```bash
# Server Configuration
PORT=3000
NODE_ENV=production

# Identity Configuration
IDENTITY_CONFIG_PATH=/path/to/identity-config.yaml

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# CORS
CORS_ORIGIN=https://app.example.com
CORS_CREDENTIALS=true
```

### Identity Configuration File

The server loads identity configuration from a YAML file:

```yaml
# config/identity-config.yaml
idpProviders:
  github-actions:
    type: github
    issuer: https://token.actions.githubusercontent.com
    audience: sts.amazonaws.com
  
  auth0:
    type: auth0
    issuer: https://myorg.auth0.com/
    audience: https://myorg.com/api

subjects:
  "repo:myorg/myapp:ref:refs/heads/main":
    keys:
      ci-deployment:
        provider: aws
        config:
          roleArn: arn:aws:iam::123456789012:role/GitHubActions
          region: us-east-1
          durationSeconds: 3600

  "user|auth0|12345":
    keys:
      s3-readonly:
        provider: minio
        config:
          endpoint: https://minio.example.com
          bucket: my-bucket
          permissions: [s3:GetObject]
      
      s3-readwrite:
        provider: minio
        config:
          endpoint: https://minio.example.com
          bucket: my-bucket
          permissions: [s3:GetObject, s3:PutObject]
```

## NestJS Features

### Dependency Injection

The server uses NestJS dependency injection for clean architecture:

```typescript
@Controller('credentials')
export class CredentialsController {
  constructor(
    private readonly credentialService: CredentialService,
    private readonly logger: Logger
  ) {}
}
```

### Middleware

- **CORS**: Configurable cross-origin resource sharing
- **Rate Limiting**: Request rate limiting for DoS protection
- **Request Logging**: Comprehensive request/response logging
- **Error Handling**: Structured error responses

### Guards and Interceptors

- **ValidationPipe**: Request validation using class-validator
- **TransformInterceptor**: Response transformation
- **LoggingInterceptor**: Request/response logging
- **TimeoutInterceptor**: Request timeout handling

## Docker Support

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY config/ ./config/

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

### docker-compose.yml

```yaml
version: '3.8'
services:
  broker-server:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - IDENTITY_CONFIG_PATH=/app/config/identity-config.yaml
    volumes:
      - ./config:/app/config:ro
```

## Monitoring and Observability

### Health Checks

The server provides comprehensive health checks:

```typescript
@Get('health')
async healthCheck(): Promise<HealthCheckResult> {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    dependencies: {
      identityProviders: await this.checkIdpHealth(),
      accessProviders: await this.checkProviderHealth()
    }
  }
}
```

### Metrics

Built-in metrics collection:

- Request count and duration
- Error rates by endpoint
- Identity provider response times
- Credential minting success/failure rates

### Logging

Structured logging with correlation IDs:

```json
{
  "timestamp": "2024-01-01T12:00:00Z",
  "level": "info",
  "correlationId": "abc123",
  "message": "Credential minting successful",
  "context": {
    "subject": "repo:myorg/myapp:ref:refs/heads/main",
    "keys": ["ci-deployment"],
    "duration": 250
  }
}
```

## Security Features

### Request Validation

All requests are validated using DTOs and class-validator:

```typescript
export class MintCredentialsDto {
  @IsString()
  @IsNotEmpty()
  token: string

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  keys: string[]
}
```

### Rate Limiting

Built-in rate limiting to prevent abuse:

```typescript
@UseGuards(ThrottlerGuard)
@Throttle(10, 60) // 10 requests per minute
@Post('mint')
async mintCredentials(@Body() dto: MintCredentialsDto) {
  // Implementation
}
```

### Security Headers

Automatic security headers via Helmet:

- Content Security Policy
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy

## Error Handling

Comprehensive error handling with structured responses:

```json
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "The provided OIDC token is invalid or expired",
    "timestamp": "2024-01-01T12:00:00Z",
    "correlationId": "abc123"
  }
}
```

Common error codes:
- `INVALID_TOKEN`: Token validation failed
- `UNAUTHORIZED`: Subject not authorized for requested keys
- `PROVIDER_ERROR`: Access provider error
- `CONFIGURATION_ERROR`: Server configuration issue

## Development Workflow

### Local Development

1. Start dependencies (IdP, access providers)
2. Configure identity configuration
3. Start development server:

```bash
npm run dev
```

4. Test endpoints:

```bash
# Get available keys
curl "http://localhost:3000/credentials/keys?token=test-token"

# Mint credentials  
curl -X POST http://localhost:3000/credentials/mint \
  -H "Content-Type: application/json" \
  -d '{"token": "test-token", "keys": ["test-key"]}'
```

### Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:e2e

# Run with coverage
npm run test:cov
```

## Production Deployment

### Environment Preparation

1. Set production environment variables
2. Configure identity providers
3. Set up monitoring and logging
4. Configure load balancer health checks

### Deployment Commands

```bash
# Build production bundle
npm run build

# Start production server
npm run start:prod

# Or use PM2 for process management
pm2 start dist/main.js --name voidkey-broker
```

### Scaling Considerations

- **Stateless Design**: Server is completely stateless
- **Horizontal Scaling**: Can run multiple instances behind load balancer
- **Connection Pooling**: Use connection pooling for external services
- **Caching**: Consider caching JWKS responses and configurations

## Troubleshooting

### Common Issues

1. **Configuration errors**: Check identity configuration syntax
2. **Token validation failures**: Verify IdP configuration and token format
3. **Provider errors**: Check access provider connectivity and credentials
4. **Performance issues**: Monitor response times and resource usage

### Debug Mode

Enable debug logging for troubleshooting:

```bash
LOG_LEVEL=debug npm run dev
```

### Health Check Testing

Test all health check endpoints:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/health/ready
curl http://localhost:3000/health/live
```
