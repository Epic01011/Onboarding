/**
 * Service Airtable — CRM Cabinet
 * Documentation : https://airtable.com/developers/web/api/introduction
 *
 * CONFIGURATION :
 *   Token PAT et Base ID saisis dans /setup → stockés dans localStorage
 *
 * ENDPOINTS UTILISÉS :
 *   POST   /v0/{baseId}/{tableId}          → Créer un enregistrement
 *   PATCH  /v0/{baseId}/{tableId}/{recId}  → Modifier un enregistrement
 *   GET    /v0/{baseId}/{tableId}          → Lister les enregistrements
 */

import { getServiceConnections } from '../utils/servicesStorage';
import { delay } from '../utils/delay';

export interface AirtableRecordFields {
  [key: string]: string | number | boolean | null | string[];
}

export interface AirtableResult {
  id: string;
  fields: AirtableRecordFields;
  createdTime: string;
  demo?: boolean;
}

function getAirtableConfig(): { apiKey: string | null; baseId: string | null } {
  const connections = getServiceConnections();
  return {
    apiKey: connections.airtable?.apiKey ?? import.meta.env.VITE_AIRTABLE_API_KEY ?? null,
    baseId: connections.airtable?.baseId ?? import.meta.env.VITE_AIRTABLE_BASE_ID ?? null,
  };
}

const BASE_URL = 'https://api.airtable.com/v0';

/**
 * Crée une fiche client dans Airtable (table Clients/Dossiers)
 */
export async function createAirtableClientRecord(
  fields: AirtableRecordFields,
  tableId = 'Clients'
): Promise<{ success: boolean; data?: AirtableResult; error?: string; demo?: boolean }> {
  await delay(900);

  const { apiKey, baseId } = getAirtableConfig();

  if (!apiKey || !baseId) {
    console.log('[AIRTABLE DEMO] Would create record:', fields);
    return {
      success: true,
      demo: true,
      data: {
        id: `rec${Math.random().toString(36).slice(2, 12).toUpperCase()}`,
        fields,
        createdTime: new Date().toISOString(),
        demo: true,
      },
    };
  }

  try {
    const res = await fetch(`${BASE_URL}/${baseId}/${encodeURIComponent(tableId)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.error?.message ?? `Erreur Airtable (${res.status})` };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    console.error('[AIRTABLE ERROR]', err);
    return { success: false, error: 'Erreur de connexion à Airtable' };
  }
}

/**
 * Met à jour une fiche client dans Airtable
 */
export async function updateAirtableRecord(
  recordId: string,
  fields: AirtableRecordFields,
  tableId = 'Clients'
): Promise<{ success: boolean; error?: string; demo?: boolean }> {
  await delay(700);

  const { apiKey, baseId } = getAirtableConfig();
  if (!apiKey || !baseId) return { success: true, demo: true };

  try {
    const res = await fetch(`${BASE_URL}/${baseId}/${encodeURIComponent(tableId)}/${recordId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });
    return { success: res.ok };
  } catch {
    return { success: false, error: 'Erreur de mise à jour Airtable' };
  }
}

/**
 * Construit les champs de la fiche client pour Airtable
 */
export function buildClientFields(clientData: {
  nom: string;
  email: string;
  telephone: string;
  siren: string;
  raisonSociale: string;
  formeJuridique: string;
  missionType: string;
  prixAnnuel?: string;
  sharepointFolderUrl?: string;
  currentStep?: number;
}): AirtableRecordFields {
  return {
    'Nom contact': clientData.nom,
    'Email': clientData.email,
    'Téléphone': clientData.telephone,
    'SIREN': clientData.siren,
    'Raison sociale': clientData.raisonSociale,
    'Forme juridique': clientData.formeJuridique,
    'Type mission': clientData.missionType === 'creation' ? 'Création' : 'Reprise',
    'Honoraires HT/an': clientData.prixAnnuel ? parseFloat(clientData.prixAnnuel) : null,
    'SharePoint URL': clientData.sharepointFolderUrl ?? '',
    'Étape actuelle': clientData.currentStep ?? 1,
    'Statut': 'En cours',
    'Date création': new Date().toLocaleDateString('fr-FR'),
  };
}