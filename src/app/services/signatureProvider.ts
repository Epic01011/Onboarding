/**
 * Interface commune pour les fournisseurs de signature électronique.
 * Permet de switcher entre JeSignExpert et Yousign de manière transparente.
 *
 * Implémentations disponibles :
 *  - JeSignExpertProvider (standard de l'Ordre des Experts-Comptables)
 *  - YousignProvider (alternative commerciale)
 */

export type SignatureProviderName = 'jesignexpert' | 'yousign';

export interface Signer {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
}

export interface SignatureDocument {
  id: string;
  name: string;
  base64?: string;
}

export type SignatureStatus =
  | 'draft'
  | 'started'
  | 'ongoing'
  | 'completed'
  | 'done'
  | 'expired'
  | 'canceled';

export interface SignatureResult {
  id: string;
  status: SignatureStatus;
  name: string;
  signingUrl?: string;
  signers: {
    id: string;
    email: string;
    status: 'waiting' | 'notified' | 'signed' | 'declined';
    signatureLink?: string;
  }[];
  provider: SignatureProviderName;
  demo?: boolean;
}

/**
 * Interface commune que chaque fournisseur de signature DOIT implémenter.
 */
export interface ISignatureProvider {
  readonly name: SignatureProviderName;

  /**
   * Crée un document (transaction/demande) chez le fournisseur.
   * @returns ID du document créé
   */
  createDocument(
    name: string,
    documentBase64?: string,
    documentFileName?: string
  ): Promise<{ id: string }>;

  /**
   * Ajoute des signataires au document créé.
   */
  addSigners(documentId: string, signers: Signer[]): Promise<void>;

  /**
   * Démarre la transaction et notifie les signataires par email.
   * @returns URL de signature optionnelle pour le premier signataire
   */
  sendForSignature(documentId: string): Promise<{ signingUrl?: string }>;

  /**
   * Récupère le statut d'une transaction de signature.
   */
  getStatus(documentId: string): Promise<{ status: SignatureStatus; signers: SignatureResult['signers'] }>;
}

// ─── Mock JeSignExpert ────────────────────────────────────────────────────────

function simulateDelay(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

export class JeSignExpertProvider implements ISignatureProvider {
  readonly name: SignatureProviderName = 'jesignexpert';
  private _signers: Signer[] = [];

  async createDocument(
    name: string,
    _documentBase64?: string,
    documentFileName?: string
  ): Promise<{ id: string }> {
    await simulateDelay(800);
    const id = `jse_tx_${Date.now()}`;
    console.log(`[JeSignExpert] Document créé : ${name}${documentFileName ? ` (${documentFileName})` : ''} — ID: ${id}`);
    return { id };
  }

  async addSigners(documentId: string, signers: Signer[]): Promise<void> {
    await simulateDelay(400);
    this._signers = signers;
    console.log(`[JeSignExpert] ${signers.length} signataire(s) ajouté(s) à ${documentId}`);
  }

  async sendForSignature(documentId: string): Promise<{ signingUrl?: string }> {
    await simulateDelay(600);
    const url = `https://app.jesignexpert.com/sign/${documentId}`;
    console.log(`[JeSignExpert] Transaction démarrée — URL: ${url}`);
    console.log(`[JeSignExpert] Notifications envoyées à: ${this._signers.map(s => s.email).join(', ')}`);
    return { signingUrl: url };
  }

  async getStatus(documentId: string): Promise<{ status: SignatureStatus; signers: SignatureResult['signers'] }> {
    await simulateDelay(300);
    return {
      status: 'started',
      signers: this._signers.map((s, i) => ({
        id: `jse_signer_${i}`,
        email: s.email,
        status: 'notified',
        signatureLink: `https://app.jesignexpert.com/sign/${documentId}/signer_${i}`,
      })),
    };
  }
}

// ─── Mock Yousign ─────────────────────────────────────────────────────────────

export class YousignProvider implements ISignatureProvider {
  readonly name: SignatureProviderName = 'yousign';
  private _signers: Signer[] = [];

  async createDocument(
    name: string,
    _documentBase64?: string,
    documentFileName?: string
  ): Promise<{ id: string }> {
    await simulateDelay(900);
    const id = `ys_sr_${Date.now()}`;
    console.log(`[Yousign] Demande de signature créée : ${name}${documentFileName ? ` (${documentFileName})` : ''} — ID: ${id}`);
    return { id };
  }

  async addSigners(documentId: string, signers: Signer[]): Promise<void> {
    await simulateDelay(450);
    this._signers = signers;
    console.log(`[Yousign] ${signers.length} signataire(s) ajouté(s) à ${documentId}`);
  }

  async sendForSignature(documentId: string): Promise<{ signingUrl?: string }> {
    await simulateDelay(700);
    const url = `https://yousign.app/signatures/${documentId}`;
    console.log(`[Yousign] Signature activée — URL: ${url}`);
    console.log(`[Yousign] Emails envoyés à: ${this._signers.map(s => s.email).join(', ')}`);
    return { signingUrl: url };
  }

  async getStatus(documentId: string): Promise<{ status: SignatureStatus; signers: SignatureResult['signers'] }> {
    await simulateDelay(300);
    return {
      status: 'ongoing',
      signers: this._signers.map((s, i) => ({
        id: `ys_signer_${i}`,
        email: s.email,
        status: 'notified',
        signatureLink: `https://yousign.app/signatures/${documentId}/signer/${i}`,
      })),
    };
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Retourne le fournisseur de signature approprié selon la configuration cabinet.
 */
export function getSignatureProvider(name: SignatureProviderName): ISignatureProvider {
  switch (name) {
    case 'jesignexpert':
      return new JeSignExpertProvider();
    case 'yousign':
      return new YousignProvider();
    default:
      return new JeSignExpertProvider();
  }
}

/**
 * Workflow complet de signature en une seule fonction.
 * Crée le document, ajoute les signataires et démarre la transaction.
 */
export async function executeSignatureWorkflow(
  provider: ISignatureProvider,
  options: {
    name: string;
    signers: Signer[];
    documentBase64?: string;
    documentFileName?: string;
  }
): Promise<SignatureResult> {
  const { id } = await provider.createDocument(
    options.name,
    options.documentBase64,
    options.documentFileName
  );
  await provider.addSigners(id, options.signers);
  const { signingUrl } = await provider.sendForSignature(id);
  const { status, signers } = await provider.getStatus(id);

  return {
    id,
    status,
    name: options.name,
    signingUrl,
    signers,
    provider: provider.name,
    demo: true,
  };
}
