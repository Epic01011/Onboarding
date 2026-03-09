# Deployment Guide - CabinetFlow Onboarding

## Overview
This document describes the deployment configuration for the CabinetFlow onboarding platform on Vercel.

## Node.js Version
- **Required Version**: Node.js 20.x (LTS)
- **Configuration Files**:
  - `package.json` → `"engines": { "node": "20.x" }`
  - `.nvmrc` → `20` (for local development consistency)
  - `vercel.json` → `"runtime": "nodejs20.x"` (for serverless functions)

## Package Manager
- **Manager**: pnpm 10.0.0 (enforced via `packageManager` field)
- **Lockfile**: `pnpm-lock.yaml` (format v9.0)
- **Install Command**: `pnpm install --frozen-lockfile`

## Build Configuration

### Vercel Setup (`vercel.json`)
```json
{
  "framework": "vite",
  "buildCommand": "pnpm install --frozen-lockfile && pnpm build",
  "installCommand": "pnpm install --frozen-lockfile",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "functions": {
    "api/**/*.ts": {
      "runtime": "nodejs20.x"
    }
  }
}
```

### Key Points:
1. **Framework**: Vite-based SPA
2. **Build**: Explicit pnpm commands ensure consistent builds
3. **Routing**: Client-side routing with catch-all rewrite
4. **API Functions**: TypeScript serverless functions in `/api` directory with Node 20 LTS runtime

## Environment Variables

### Required Variables for Vercel Deployment

#### Supabase Configuration
```bash
# Supabase URL
VITE_SUPABASE_URL=https://rjdvmfakljgltsdoceqb.supabase.co

# Supabase Anon Key (JWT format - public safe)
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqZHZtZmFrbGpnbHRzZG9jZXFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NjkxODgsImV4cCI6MjA4NzQ0NTE4OH0.grY3VMogkFZ-prdZ4vB_HBJDUI9mpMTsgu6Z1WrzVbk

# Alternative prefix for Vercel compatibility (optional)
NEXT_PUBLIC_SUPABASE_URL=https://rjdvmfakljgltsdoceqb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Service Role Key (Backend Only - NEVER expose to client)
```bash
# ⚠️ Add this ONLY in Vercel Environment Variables (Server-side)
# DO NOT add VITE_ prefix - this keeps it server-side only
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

#### Optional Services
```bash
# Email Service (SendGrid)
SENDGRID_API_KEY=SG.xxx
FROM_EMAIL=onboarding@cabinet.fr
FROM_NAME=CabinetFlow

# E-Signature (JeSignExpert)
VITE_JESIGNEXPERT_API_KEY=your_api_key_here
VITE_JESIGNEXPERT_WORKSPACE_ID=your_workspace_id_here
VITE_JESIGNEXPERT_API_URL=https://api.jesignexpert.com/v1

# Debug flags
VITE_DEBUG_MODE=false
VITE_LOG_SIGNATURE_EVENTS=true
```

### Environment Variable Prefixes
- `VITE_*` - Exposed to browser (bundled in client code)
- `NEXT_PUBLIC_*` - Alternative prefix for Vercel compatibility
- No prefix - Server-side only (API routes, never exposed to client)

## Serverless Functions

### API Endpoints
Located in `/api` directory:

1. **`/api/send-email.ts`**
   - Email sending proxy (supports Microsoft, Google, SendGrid)
   - Runtime: Node.js 20
   - Accepts credentials in request body

2. **`/api/generate-pdf.ts`**
   - PDF generation endpoint
   - Runtime: Node.js 20

### TypeScript Configuration for API
See `api/tsconfig.json`:
- Module: CommonJS
- Target: ES2020
- Types: Node.js
- noEmit: true (Vercel handles compilation)

## Supabase Integration

### Database Tables
Key tables used by the application:

1. **`documents`** - Letter templates (lettres de mission)
   - Stores mission letter templates with variable substitution
   - Type: 'confraternal' | 'mission' | 'mandat_creation'
   - RLS enabled for user isolation

2. **`kv_store_f54b77bb`** - Key-value configuration store
   - Cabinet settings and API keys
   - Accessed via service role key (backend only)

3. **`onboarding_cases`** - Client onboarding dossiers
4. **`clients`** - Client database
5. **`quotes`** - Pricing proposals

### Migrations
Located in `supabase/migrations/`:
- Apply with: `supabase db push --project-ref rjdvmfakljgltsdoceqb`

## Local Development

### Setup
```bash
# Install Node 20 (via nvm)
nvm install 20
nvm use 20

# Install dependencies
pnpm install

# Create .env file (copy from .env.example)
cp .env.example .env

# Edit .env with your credentials
vim .env

# Start development server
pnpm dev
```

### Development URLs
- Frontend: http://localhost:5173
- Supabase Project: https://rjdvmfakljgltsdoceqb.supabase.co

## Build Process

### Local Build
```bash
pnpm build
```

### Build Output
- **Directory**: `dist/`
- **Index**: `dist/index.html` (SPA entry point)
- **Assets**: `dist/assets/` (optimized chunks)

### Code Splitting
Vendor chunks optimized for:
- React ecosystem
- Material UI + Emotion
- Supabase
- Recharts + D3
- Radix UI components
- jsPDF + html2canvas
- Leaflet + React Leaflet
- Lucide icons

## Deployment Checklist

- [ ] Verify Node.js 20.x is specified in all config files
- [ ] Ensure `pnpm-lock.yaml` is committed
- [ ] Set all required environment variables in Vercel
- [ ] Configure Supabase RLS policies
- [ ] Test Supabase connection with anon key
- [ ] Verify API functions work with Node 20 runtime
- [ ] Test letter template generation from Supabase
- [ ] Confirm email sending through serverless function
- [ ] Check PDF generation endpoint
- [ ] Validate authentication flow

## Troubleshooting

### Build Failures
1. **"Module not found" errors**: Run `pnpm install --frozen-lockfile`
2. **Node version mismatch**: Ensure Node 20 is active (`node --version`)
3. **TypeScript errors**: Check `tsconfig.json` and `api/tsconfig.json`

### Runtime Issues
1. **Supabase connection fails**: Verify `VITE_SUPABASE_ANON_KEY` in environment
2. **API functions timeout**: Check Node runtime version in `vercel.json`
3. **CORS errors**: Ensure proper origin configuration in API handlers

### Supabase Issues
1. **Documents not loading**: Check RLS policies on `documents` table
2. **Authentication fails**: Verify anon key matches project
3. **Service role errors**: Ensure service role key is server-side only

## Security Notes

⚠️ **CRITICAL**:
- NEVER commit `.env` file
- NEVER expose `SUPABASE_SERVICE_ROLE_KEY` to client
- Service role key should ONLY be in Vercel server environment variables
- Use `VITE_` prefix ONLY for public, client-safe variables
- Review RLS policies before production deployment

## Support

For deployment issues:
- GitHub Issues: https://github.com/Epic0101/Onboardingclient/issues
- Vercel Docs: https://vercel.com/docs
- Supabase Docs: https://supabase.com/docs
