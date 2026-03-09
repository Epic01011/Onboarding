# Guide d'Implémentation

## Prérequis

- Node.js 18+
- pnpm (ou npm)
- Compte JeSignExpert avec clé API

## Étape 1 : Configurer les variables d'environnement

```bash
cp .env.example .env
```

Remplir dans `.env` :
```env
VITE_JESIGNEXPERT_API_KEY=<votre-clé>
VITE_JESIGNEXPERT_WORKSPACE_ID=<votre-workspace>
```

## Étape 2 : Intégrer le composant principal

```tsx
import OnboardingFlow from './components/Onboarding/OnboardingFlow';

function App() {
  return (
    <OnboardingFlow
      onComplete={() => console.log('Onboarding terminé!')}
      onCancel={() => console.log('Annulé')}
    />
  );
}
```

## Étape 3 : Lancer le projet

```bash
pnpm install
pnpm dev
```

## Étape 4 : Tester le flux

1. Sélectionner **Créer une entreprise**
2. Uploader les 4 documents (PDF/JPG/PNG, max 10MB)
3. Renseigner email + nom signataire
4. Cliquer **Créer la demande de signature**
5. Signer via le lien JeSignExpert
6. Télécharger les documents signés

## Points d'extension

- **Backend** : Connecter `onComplete()` à votre API
- **Webhooks** : Configurer l'URL callback dans `createSignatureRequest`
- **Base de données** : Sauvegarder `requestId` + documents
