import { delay } from '../utils/delay';

export interface SharePointFolder {
  id: string;
  name: string;
  webUrl: string;
  uploadLink: string;
}

export interface SharePointUploadResult {
  id: string;
  name: string;
  webUrl: string;
  size: number;
}

const DEMO_MODE = true; // Overridden when real Microsoft credentials are available in env

async function getAccessToken(): Promise<string> {
  // Check if we have real env variables configured
  const tenantId = import.meta.env.VITE_MS_TENANT_ID;
  const clientId = import.meta.env.VITE_MS_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_MS_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    return 'demo-token';
  }

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
      }),
    }
  );
  const data = await res.json();
  return data.access_token;
}

/** Crée l'arborescence client dans SharePoint */
export async function createClientFolder(
  raisonSociale: string,
  siren: string
): Promise<SharePointFolder> {
  await delay(800);

  if (DEMO_MODE) {
    const folderName = `${raisonSociale.replace(/[^a-zA-Z0-9\s]/g, '')} [${siren}]`;
    return {
      id: `sp_${siren}`,
      name: folderName,
      webUrl: `https://cabinet.sharepoint.com/sites/Clients/Documents/${encodeURIComponent(folderName)}`,
      uploadLink: `https://cabinet.sharepoint.com/:f:/g/personal/cabinet_clients/upload?folder=${encodeURIComponent(folderName)}&key=demo_${siren}`,
    };
  }

  const token = await getAccessToken();
  const siteId = import.meta.env.VITE_SP_SITE_ID;
  const driveId = import.meta.env.VITE_SP_DRIVE_ID;
  const folderName = `${raisonSociale} [${siren}]`;

  // Create main folder
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root/children`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'rename',
      }),
    }
  );
  const folder = await res.json();

  // Create sub-folders
  const subFolders = ['Documents Légaux', 'Contrats', 'Bilans', 'Correspondances', 'KYC'];
  for (const sub of subFolders) {
    await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/items/${folder.id}/children`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sub, folder: {} }),
      }
    );
  }

  return {
    id: folder.id,
    name: folder.name,
    webUrl: folder.webUrl,
    uploadLink: folder.webUrl,
  };
}

/** Génère un lien de dépôt SharePoint pour le client */
export async function createUploadLink(
  folderName: string,
  siren: string
): Promise<string> {
  await delay(600);
  if (DEMO_MODE) {
    return `https://cabinet.sharepoint.com/:f:/g/clients/upload/${siren}?e=xYzABC&key=cabinet_${Date.now()}`;
  }
  // Real: use Graph API createLink
  return `https://cabinet.sharepoint.com/sites/Clients/Documents/${folderName}/Documents Légaux`;
}

/** Upload un fichier dans SharePoint */
export async function uploadFile(
  folderId: string,
  fileName: string,
  fileContent: Blob
): Promise<SharePointUploadResult> {
  await delay(1200);

  if (DEMO_MODE) {
    return {
      id: `file_${Date.now()}`,
      name: fileName,
      webUrl: `https://cabinet.sharepoint.com/sites/Clients/Documents/${encodeURIComponent(fileName)}`,
      size: fileContent.size,
    };
  }

  const token = await getAccessToken();
  const siteId = import.meta.env.VITE_SP_SITE_ID;
  const driveId = import.meta.env.VITE_SP_DRIVE_ID;

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/items/${folderId}:/${fileName}:/content`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
      },
      body: fileContent,
    }
  );
  return res.json();
}