-- ============================================================
-- Migration 8 (20240101000008) — cabinet_settings: chiffrement ai_api_key
-- ============================================================
-- La colonne ai_api_key stocke désormais une valeur chiffrée
-- (AES-256-GCM, dérivation PBKDF2 côté client) et non plus la
-- clé API en clair.
--
-- Format : base64([IV 12 octets][ciphertext AES-GCM])
-- Voir   : src/app/utils/cryptoUtils.ts
--
-- ⚠️  Migration des données existantes :
--     Les lignes existantes avec une clé en clair retourneront une
--     chaîne vide lors du déchiffrement (decryptApiKey → '').
--     L'utilisateur devra ressaisir sa clé via la page Paramètres.
--     La nouvelle valeur sera automatiquement chiffrée à la sauvegarde.
--
-- Recommandation future : migrer vers Supabase Vault (pgsodium)
--     pour un chiffrement au niveau base de données.
-- ============================================================

COMMENT ON COLUMN cabinet_settings.ai_api_key
  IS 'Clé API IA chiffrée (AES-256-GCM, dérivation PBKDF2 côté client). Ne jamais stocker en clair. Voir cryptoUtils.ts.';
