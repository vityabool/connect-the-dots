#!/usr/bin/env bash
# One-off / repeatable provisioning of the Azure resources (uses your current `az login`).
# Usage: infra/deploy.sh [resource-group] [location]
set -euo pipefail

RG="${1:-rg-connect-the-dots}"
LOCATION="${2:-eastus2}"
HERE="$(cd "$(dirname "$0")" && pwd)"

az group create --name "$RG" --location "$LOCATION" --output none

# Reuse the existing signing secret if the app already has one, so player tokens stay valid.
SECRET="$(az staticwebapp appsettings list --name ctd-human-network --resource-group "$RG" \
  --query "properties.TOKEN_SIGNING_SECRET" -o tsv 2>/dev/null | tr -d '\r\n' || true)"
if [ -z "$SECRET" ] || [ "$SECRET" = "null" ]; then
  SECRET="$(openssl rand -base64 48 | tr -d '\n')"
fi

CLEANUP_TOKEN="$(az staticwebapp appsettings list --name ctd-human-network --resource-group "$RG" \
  --query "properties.CLEANUP_TOKEN" -o tsv 2>/dev/null | tr -d '\r\n' || true)"
if [ -z "$CLEANUP_TOKEN" ] || [ "$CLEANUP_TOKEN" = "null" ]; then
  CLEANUP_TOKEN="$(openssl rand -hex 32)"
  echo "A new CLEANUP_TOKEN was generated. Store it for the scheduled cleanup workflow:" >&2
  echo "  gh secret set CLEANUP_TOKEN   (paste the value from: az staticwebapp appsettings list ...)" >&2
fi

# Keep a PUBLIC_ORIGIN that was set by hand; otherwise the Bicep default applies.
PUBLIC_ORIGIN="$(az staticwebapp appsettings list --name ctd-human-network --resource-group "$RG" \
  --query "properties.PUBLIC_ORIGIN" -o tsv 2>/dev/null | tr -d '\r\n' || true)"
ORIGIN_PARAM=()
if [ -n "$PUBLIC_ORIGIN" ] && [ "$PUBLIC_ORIGIN" != "null" ]; then ORIGIN_PARAM=(publicOrigin="$PUBLIC_ORIGIN"); fi

az deployment group create \
  --resource-group "$RG" \
  --template-file "$HERE/main.bicep" \
  --parameters tokenSigningSecret="$SECRET" cleanupToken="$CLEANUP_TOKEN" ${ORIGIN_PARAM[@]+"${ORIGIN_PARAM[@]}"} \
  --query "properties.outputs" -o json
