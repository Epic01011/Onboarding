# Node Version Fix - Migration de Node 24 vers Node 20

## Problème Résolu

Vercel ne supporte pas encore Node.js 24.x pour ses fonctions serverless. Le déploiement échouait avec l'erreur :
```
Error: Function Runtimes must have a valid version
```

## Changements Effectués

### 1. Fichiers de Configuration Modifiés

✅ **package.json**
```json
"engines": {
  "node": "20.x"  // Changé de 24.x vers 20.x
}
```

✅ **vercel.json**
```json
"functions": {
  "api/**/*.ts": {
    "runtime": "nodejs20.x"  // Changé de nodejs24.x vers nodejs20.x
  }
}
```

✅ **.nvmrc**
```
20  // Changé de 24 vers 20
```

✅ **package.json - @types/node**
```json
"@types/node": "^20.17.10"  // Changé de ^25.0.0 vers ^20.17.10
```

✅ **DEPLOYMENT.md**
- Toutes les références à Node 24 ont été mises à jour vers Node 20

## Instructions pour Mettre à Jour Votre Environnement Local

### Étape 1: Mettre à Jour la Version de Node

Si vous utilisez **nvm** (Node Version Manager):
```bash
# Installer Node 20 (dernière version LTS)
nvm install 20

# Utiliser Node 20
nvm use 20

# Vérifier la version
node --version
# Devrait afficher v20.x.x
```

Si vous utilisez **n** ou **nodenv**, référez-vous à leur documentation respective.

### Étape 2: Mettre à Jour les Dépendances

```bash
# Supprimer le cache de pnpm (recommandé)
pnpm store prune

# Supprimer node_modules (optionnel mais recommandé)
rm -rf node_modules

# Réinstaller toutes les dépendances avec pnpm
pnpm install

# Cela mettra à jour pnpm-lock.yaml automatiquement avec @types/node@^20.17.10
```

### Étape 3: Vérifier que Tout Fonctionne

```bash
# Tester le build local
pnpm build

# Si le build réussit, vous êtes prêt!
```

## Configuration Vercel (Interface Web)

### Option Recommandée: Alignement Complet sur Node 20

Pour éviter tout conflit, configurez Vercel comme suit:

1. **Allez dans les Project Settings de votre projet Vercel**
2. **Section "Node.js Version"**:
   - Réglez la version principale sur **20.x**
   - **Supprimez** le "Production Override" (ou réglez-le aussi sur 20.x)

### Pourquoi?

Avec `"engines": { "node": "20.x" }` dans package.json:
- Vercel **ignorera** les paramètres de l'interface si le package.json spécifie une version différente
- Le warning disparaîtra car tout sera aligné sur Node 20.x
- Les fonctions serverless utiliseront automatiquement `nodejs20.x`

### Alternative: Laisser package.json Gérer la Version

Si vous préférez que package.json soit la seule source de vérité:
- Vous pouvez **laisser** les paramètres Vercel sur 20.x avec override
- Le `"engines"` dans package.json aura priorité de toute façon
- Mais vous verrez toujours le warning dans les logs

## Compatibilité Node 20

Node.js 20.x est la version **LTS (Long Term Support)** actuelle:
- ✅ Support complet sur Vercel
- ✅ Compatible avec toutes les dépendances du projet
- ✅ Support jusqu'en avril 2026
- ✅ Stable et production-ready

## Vérifications Post-Déploiement

Après avoir poussé ces changements et redéployé sur Vercel:

1. ✅ Le build devrait réussir sans erreur
2. ✅ Les fonctions API (`/api/send-email`, `/api/generate-pdf`) devraient fonctionner
3. ✅ Plus de warning concernant la version de Node
4. ✅ Le runtime des fonctions sera `nodejs20.x`

## Support et Versions Node

### Versions Node Supportées par Vercel (Mars 2026)

| Version | Support Vercel | Status |
|---------|---------------|--------|
| 18.x | ✅ Supporté | LTS jusqu'en avril 2025 |
| 20.x | ✅ **Supporté (Recommandé)** | LTS jusqu'en avril 2026 |
| 22.x | ⚠️ En preview | Pas encore stable |
| 24.x | ❌ Non supporté | Pas encore disponible |

## Questions Fréquentes

### Q: Pourquoi Node 20 et pas Node 24?

**R:** Vercel ne supporte pas encore Node 24.x pour les fonctions serverless. Node 20 est la version LTS actuelle et entièrement supportée.

### Q: Dois-je redéployer après ces changements?

**R:** Oui, ces changements nécessitent un nouveau déploiement pour prendre effet sur Vercel.

### Q: Mon pnpm-lock.yaml a changé, est-ce normal?

**R:** Oui, c'est normal! Le changement de `@types/node` de v25 vers v20 peut entraîner des changements dans le lockfile. Committez ces changements.

### Q: Que faire si j'ai encore des erreurs?

**R:** Vérifiez que:
1. Node 20 est actif localement (`node --version`)
2. Le build local réussit (`pnpm build`)
3. Tous les fichiers modifiés sont committés et pushés
4. Les paramètres Vercel sont alignés sur 20.x

## Commandes Utiles

```bash
# Vérifier la version Node active
node --version

# Vérifier la version pnpm
pnpm --version

# Nettoyer et réinstaller
pnpm store prune
rm -rf node_modules
pnpm install

# Build local
pnpm build

# Preview local (après build)
pnpm preview
```

## Ressources

- [Node.js LTS Schedule](https://nodejs.org/en/about/releases/)
- [Vercel Node.js Runtime Documentation](https://vercel.com/docs/functions/runtimes/node-js)
- [pnpm Documentation](https://pnpm.io/)

## Contact

Pour toute question ou problème, créez une issue sur le dépôt GitHub.
