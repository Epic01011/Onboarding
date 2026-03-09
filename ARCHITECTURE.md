# Architecture — Onboarding JeSignExpert

## Vue d'ensemble

Ce projet implémente un flux d'onboarding dynamique avec deux modes :
- **Création** (5 étapes) : upload de 4 documents + signature électronique
- **Reprise** (2 étapes) : identification + signature

## Structure des fichiers

```
src/
├── services/jesignexpert/
│   ├── config.ts          # Configuration API
│   ├── types.ts           # Types TypeScript
│   └── index.ts           # Service JeSignExpert
├── contexts/
│   └── OnboardingContext.tsx  # État global
├── hooks/
│   └── useOnboarding.ts   # 3 hooks spécialisés
└── components/Onboarding/
    ├── OnboardingFlow.tsx  # Orchestrateur
    ├── StepShell.tsx       # Wrapper + progression
    ├── steps-index.ts      # Exports
    └── Steps/
        ├── StepJustificatifDomicile.tsx
        ├── StepDocumentUpload.tsx
        └── StepSignature.tsx
```

## Flux de données

```
OnboardingFlow
  └── OnboardingProvider (contexte)
        ├── ModeSelector → setMode('creation' | 'reprise')
        ├── CreationFlow (5 étapes)
        │   ├── StepShell (navigation + progression)
        │   ├── Step 1: JustificatifDomicile
        │   ├── Step 2-4: DocumentUpload (x3)
        │   └── Step 5: Signature (JeSignExpert)
        └── RepriseFlow (2 étapes)
            ├── Step 1: Identification
            └── Step 2: Signature
```

## Technologies

- **React** + **TypeScript** (Vite)
- **TailwindCSS** (UI)
- **JeSignExpert API** (signature électronique)
- **Fetch API** native (HTTP)
- **useReducer** (gestion état)

## Variables d'environnement

Voir `.env.example` pour la liste complète.
