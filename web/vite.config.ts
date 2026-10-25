/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// LOCAL DEVELOPMENT ONLY: with CTD_DEV_ADMIN=1 the dev server pretends to be signed in as the simulation admin
// (the same user that scripts/simulate.mjs creates games for), like Static Web Apps does after a real sign-in.
// This config is only used by `vite` (the dev server); it is never part of the production build.
const devAdminHeader =
  process.env.CTD_DEV_ADMIN === '1'
    ? Buffer.from(
        JSON.stringify({
          userId: 'simulation-admin',
          userDetails: 'simulation@example.com',
          identityProvider: 'aad',
          userRoles: ['anonymous', 'authenticated'],
        }),
      ).toString('base64')
    : undefined;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@ctd/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Local API (Azure Functions Core Tools) listens on 7072.
    proxy: {
      '/api': {
        target: 'http://localhost:7072',
        headers: devAdminHeader ? { 'x-ms-client-principal': devAdminHeader } : undefined,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
