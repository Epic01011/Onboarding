# Supabase — Architecture CabinetFlow

## Structure

```
supabase/
├── config.toml                      # Configuration Supabase CLI (développement local)
├── migrations/
│   ├── 20240101000000_initial_schema.sql   # Tables : kv_store, onboarding_cases, events, clients, quotes
│   ├── 20240101000001_rls_policies.sql     # Row Level Security (RLS)
│   └── 20240101000002_storage.sql          # Bucket cabinet-templates
└── functions/
    └── server/
        ├── index.tsx                # Edge Function principale (API KV REST)
        └── kv_store.tsx             # Helper kv_store_f54b77bb
```

## Tables

| Table | Description |
|-------|-------------|
| `kv_store_f54b77bb` | Magasin clé-valeur générique pour les données cabinet (API keys, dossiers, templates). Accès via service role key uniquement. |
| `onboarding_cases` | Brouillons de dossiers d'onboarding en cours. RLS : chaque utilisateur accède à ses propres dossiers. |
| `onboarding_events` | Journal d'audit immuable des actions (étapes validées, documents uploadés, etc.). |
| `clients` | Clients du cabinet. Accessible à tous les utilisateurs authentifiés. |
| `quotes` | Devis / propositions liés aux clients. Statuts : `PENDING_ONBOARDING`, `DRAFT`, `VALIDATED`, `SIGNED`, `ARCHIVED`. |

## Storage

| Bucket | Description |
|--------|-------------|
| `cabinet-templates` | Templates PDF (lettres de mission, lettres confraternelles). Accès restreint par userId. |

## Déploiement

### 1. Prérequis
```bash
npm install -g supabase
supabase login
```

### 2. Appliquer les migrations en production
```bash
supabase db push --project-ref rjdvmfakljgltsdoceqb
```

### 3. Développement local
```bash
supabase start
supabase db reset   # Recrée la DB locale et applique toutes les migrations
```

### 4. Déployer les Edge Functions
```bash
supabase functions deploy server --project-ref rjdvmfakljgltsdoceqb
```

## Variables d'environnement

### Frontend (Vite / `VITE_` prefix)
| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | URL du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | Publishable Key (publique, pas de secret) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key (interne cabinet uniquement — bypasse RLS) |

### Backend Vercel (sans `VITE_` prefix — jamais exposées au navigateur)
| Variable | Description |
|----------|-------------|
| `SENDGRID_API_KEY` | Clé API SendGrid pour l'envoi d'emails (`/api/send-email`) |
| `FROM_EMAIL` | Adresse email expéditeur |
| `FROM_NAME` | Nom expéditeur |

## Architecture de sécurité

```
Navigateur (React)
    │
    ├── supabaseClient.ts (ANON KEY)
    │   ├── Auth (signIn, signUp, OAuth)
    │   └── supabaseSync.ts (onboarding_cases, onboarding_events, clients, quotes)
    │       └── RLS : chaque utilisateur accède à ses propres données
    │
    └── backendApi.ts (SERVICE ROLE KEY)
        └── kv_store_f54b77bb (API keys, cabinet info, templates, dossiers)
            └── RLS bypassée par service role key

Vercel Serverless
    └── /api/send-email → SendGrid (SENDGRID_API_KEY côté serveur)

Supabase Edge Functions
    └── /functions/v1/server → API KV REST (token JWT vérifié côté serveur)
```
