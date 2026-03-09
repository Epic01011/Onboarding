/**
 * Masque une clé API pour l'affichage sécurisé
 * Affiche uniquement les 4 derniers caractères
 */
export function maskApiKey(key: string | undefined): string {
  if (!key) return '••••••••';
  if (key.length <= 4) return '••••';
  return `••••••••${key.slice(-4)}`;
}

/**
 * Retourne une version masquée d'un email (pour les connexions OAuth)
 */
export function maskEmail(email: string | undefined): string {
  if (!email) return 'N/A';
  const [local, domain] = email.split('@');
  if (!domain) return email;
  if (local.length <= 2) return `${local}@${domain}`;
  return `${local.slice(0, 2)}${'•'.repeat(Math.min(local.length - 2, 6))}@${domain}`;
}

/**
 * Teste une connexion API (mock pour démo)
 */
export async function testApiConnection(
  service: 'microsoft' | 'yousign' | 'airtable' | 'pennylane' | 'sendgrid' | 'hubspot' | 'pipedrive',
  apiKey?: string
): Promise<boolean> {
  // Simulation d'un appel API
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // En mode démo, on retourne toujours true si une clé est fournie
  if (!apiKey) return false;
  
  // Dans une vraie app, on ferait un vrai appel API ici
  // Exemple pour SendGrid: GET https://api.sendgrid.com/v3/user/account
  // Exemple pour Yousign: GET https://api.yousign.app/v3/workspaces
  // etc.
  
  return true;
}