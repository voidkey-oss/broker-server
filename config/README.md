# Configuration File Structure

## IdP Configuration Format

YAML files containing Identity Provider (IdP) configurations must follow this structure:

```yaml
idps:
  - name: "string"          # Required: Unique identifier for this IdP
    issuer: "string"        # Required: OIDC issuer URL
    audience: "string"      # Required: Expected audience claim value
    jwksUri: "string"       # Required: JWKS endpoint URL for token validation
    algorithms: ["string"]  # Optional: Allowed signing algorithms (default: ["RS256"])
    identities:             # Optional: List of allowed identities (if not provided, NO tokens are accepted)
      - subject: "string"   # Required: The subject claim value to allow

default: "string"           # Optional: Name of the default IdP to use
```

## Example Configuration

```yaml
idps:
  - name: "okta-corporate"
    issuer: "https://your-company.okta.com/oauth2/default"
    audience: "api://voidkey-broker"
    jwksUri: "https://your-company.okta.com/oauth2/default/v1/keys"
    algorithms: ["RS256"]
    identities:
      - subject: "00u1a2b3c4d5e6f7g8h9"
      - subject: "00u9z8y7x6w5v4u3t2s1"

  - name: "auth0-production"
    issuer: "https://your-tenant.auth0.com/"
    audience: "https://your-api-identifier"
    jwksUri: "https://your-tenant.auth0.com/.well-known/jwks.json"
    algorithms: ["RS256", "RS384"]
    identities:
      - subject: "auth0|507f1f77bcf86cd799439011"

default: "auth0-production"
```

## Field Descriptions

- **name**: Unique identifier used to select this IdP when minting credentials
- **issuer**: Must match the `iss` claim in the OIDC token exactly
- **audience**: Must match the `aud` claim in the OIDC token
- **jwksUri**: Endpoint to fetch the JSON Web Key Set for signature verification
- **algorithms**: List of accepted JWT signing algorithms for security
- **identities**: List of allowed identities for this IdP
  - **subject**: Must match the `sub` claim in the OIDC token exactly
- **default**: If specified, this IdP will be used when no specific IdP is requested

## Identity Validation

**Important**: The system follows a zero-trust approach for identity validation:
- If an IdP has an `identities` array defined, only tokens with subjects listed in that array will be accepted
- If an IdP has no `identities` array or an empty array, **NO tokens will be accepted** for that IdP
- This ensures that access must be explicitly granted to specific identities