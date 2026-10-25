// Connect the Dots — The Human Network
// Deploys: Storage account (Table Storage) + Static Web App (Free) + its application settings.
// Deploy at resource-group scope:  az deployment group create -g <rg> -f infra/main.bicep -p tokenSigningSecret=<secret>

@description('Azure region for the storage account.')
param location string = resourceGroup().location

@description('Azure region for the Static Web App (Free plan supports a limited set of regions).')
@allowed(['westus2', 'centralus', 'eastus2', 'westeurope', 'eastasia'])
param staticWebAppLocation string = 'eastus2'

@description('Name of the Static Web App.')
param staticWebAppName string = 'ctd-human-network'

@description('Secret used to sign player tokens. Generate a long random value; never commit it.')
@secure()
param tokenSigningSecret string

@description('Secret that the daily cleanup workflow sends to /api/maintenance/cleanup. Never commit it.')
@secure()
param cleanupToken string

@description('Public address of the site; the short links made with is.gd point to it (is.gd refuses *.azurestaticapps.net).')
param publicOrigin string = 'https://www.connect-the-dots.top'

var storageAccountName = 'ctdhn${uniqueString(resourceGroup().id)}'
var tableNames = [
  'Games'
  'GameCodes'
  'OwnerGames'
  'Participants'
  'Topics'
  'Connections'
  'RateLimits'
]

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
    accessTier: 'Hot'
  }
}

resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource tables 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = [
  for tableName in tableNames: {
    parent: tableService
    name: tableName
  }
]

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: staticWebAppName
  location: staticWebAppLocation
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    // Deployed from GitHub Actions with a deployment token, so no repository is linked here.
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
  }
}

resource appSettings 'Microsoft.Web/staticSites/config@2023-12-01' = {
  parent: staticWebApp
  name: 'appsettings'
  properties: {
    TABLES_CONNECTION_STRING: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
    TOKEN_SIGNING_SECRET: tokenSigningSecret
    CLEANUP_TOKEN: cleanupToken
    PUBLIC_ORIGIN: publicOrigin
  }
}

output staticWebAppName string = staticWebApp.name
output staticWebAppHostname string = staticWebApp.properties.defaultHostname
output storageAccountName string = storage.name
