# Audience Validation Configuration

## Overview

The Voidkey broker supports flexible audience (`aud`) claim validation to accommodate various OIDC providers that have different audience requirements. This is particularly important for CI/CD platforms where you cannot control the audience claim in their OIDC tokens.

## Audience Configuration Options

### 1. Single Audience (Strict Validation)

```yaml
clientIdps:
  - name: "auth0"
    issuer: "https://mytenant.us.auth0.com/"
    audience: "https://mytenant.us.auth0.com/api/v2/"
    jwksUri: "https://mytenant.us.auth0.com/.well-known/jwks.json"
```

The token's `aud` claim must exactly match this value.

### 2. Multiple Audiences

```yaml
clientIdps:
  - name: "okta-corporate"
    issuer: "https://your-company.okta.com/oauth2/default"
    audience: ["api://voidkey-broker", "https://broker.voidkey.io", "voidkey"]
    jwksUri: "https://your-company.okta.com/oauth2/default/v1/keys"
```

The token's `aud` claim must match any one of these values.

### 3. No Audience Validation (Implicit)

```yaml
clientIdps:
  - name: "gitlab-ci"
    issuer: "https://gitlab.com"
    # No audience field - audience validation will be skipped
    jwksUri: "https://gitlab.com/oauth/discovery/keys"
```

When no `audience` field is present, audience validation is skipped.

### 4. Explicitly Disabled Audience Validation

```yaml
clientIdps:
  - name: "azure-devops"
    issuer: "https://vstoken.dev.azure.com/{your-org-id}"
    validateAudience: false  # Explicitly disable validation
    audience: "some-value"   # This will be ignored
    jwksUri: "https://vstoken.dev.azure.com/{your-org-id}/.well-known/jwks"
```

Setting `validateAudience: false` explicitly disables audience validation, even if an audience is configured.

## Common CI/CD Platform Audiences

Here are the typical audience values used by popular CI/CD platforms:

| Platform | Typical Audience | Configurable? |
|----------|-----------------|---------------|
| GitHub Actions | `sts.amazonaws.com` (for AWS) | Yes, via `audience` parameter |
| GitLab CI | `https://gitlab.com` or custom | Yes, in CI configuration |
| Azure Pipelines | Varies by configuration | Yes, in service connection |
| CircleCI | Custom configured | Yes |
| Jenkins (with OIDC) | Custom configured | Yes |

## Security Considerations

1. **When to Skip Audience Validation**
   - When you trust the IdP and control access via subject/claims validation
   - When the CI/CD platform has a fixed audience you cannot change
   - When operating in a closed environment with trusted services

2. **Compensating Controls**
   - Always validate the issuer (`iss`) claim
   - Use subject (`sub`) allowlists in `clientIdentities`
   - Validate additional claims (repository, environment, etc.)
   - Use short token lifetimes

3. **Best Practices**
   - Enable audience validation when possible
   - Use the most specific audience values available
   - Document why audience validation is disabled when it is
   - Regularly audit your IdP configurations

## Example: GitHub Actions Configuration

Since GitHub Actions uses a fixed audience for AWS (`sts.amazonaws.com`), you would configure:

```yaml
clientIdps:
  - name: "github-actions"
    issuer: "https://token.actions.githubusercontent.com"
    audience: "sts.amazonaws.com"  # GitHub's fixed audience
    jwksUri: "https://token.actions.githubusercontent.com/.well-known/jwks"
    algorithms: ["RS256"]

clientIdentities:
  - subject: "repo:myorg/myrepo:ref:refs/heads/main"
    idp: "github-actions"
    keysets:
      production:
        AWS_ROLE_ARN: "arn:aws:iam::123456789012:role/GitHubActionsRole"
```

## Migration Guide

If you're updating from a configuration that required audience validation:

1. **Option 1**: Configure Keycloak/IdP to include the expected audience
2. **Option 2**: Update broker config to accept the actual audience sent
3. **Option 3**: Disable audience validation if other security controls are sufficient

```yaml
# Before (failing because Keycloak doesn't send audience)
- name: "keycloak-client"
  audience: "voidkey-cli"  # Expected but not sent

# After Option 1: Configure Keycloak to send audience
# (No broker config change needed)

# After Option 2: Accept what Keycloak sends
- name: "keycloak-client"
  # No audience field - skip validation

# After Option 3: Explicitly disable
- name: "keycloak-client"
  validateAudience: false
```