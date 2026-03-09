import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AIEmailDraft, EmailDraftStatus } from './types';

// ─── Demo data ────────────────────────────────────────────────────────────────
const DEMO_DRAFTS: AIEmailDraft[] = [
  {
    id: 'draft_001',
    status: 'pending_review',
    clientName: 'Martin Dupont – SAS Dupont Conseil',
    dossierId: 'dossier_001',
    original_email: {
      from: 'martin.dupont@dupont-conseil.fr',
      to: 'cabinet@cabinetflow.fr',
      subject: 'Question sur la TVA intracommunautaire',
      body: `Bonjour,\n\nNous réalisons des prestations de services auprès de clients basés en Allemagne et en Espagne. Pouvez-vous m'indiquer comment fonctionne la TVA dans ce cas ?\n\nCordialement,\nMartin Dupont`,
      date: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    },
    draft: {
      to: 'martin.dupont@dupont-conseil.fr',
      subject: 'Réponse : TVA intracommunautaire – Règles applicables',
      body: `Bonjour M. Dupont,\n\nSuite à votre question concernant la TVA intracommunautaire, voici les règles applicables à vos prestations de services :\n\n**Principe général (art. 259 CGI)**\nPour les prestations de services B2B, le lieu d'imposition est celui où le preneur est établi. Vos clients allemands et espagnols étant assujettis à la TVA dans leur pays, vous devez facturer hors TVA française et mentionner la mention « Autoliquidation » (ou « Reverse charge »).\n\n**Obligations déclaratives**\nVous devez déposer une Déclaration Européenne de Services (DES) auprès de la Direction Générale des Douanes pour toute prestation B2B intracommunautaire.\n\n**Vérification des numéros de TVA**\nPensez à systématiquement vérifier la validité des numéros de TVA intracommunautaire de vos clients via le système VIES de la Commission européenne.\n\nNous restons à votre disposition pour tout complément d'information.\n\nCordialement,\nCabinetFlow Expert-Comptable`,
      generatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    bofip_sources_cited: [
      {
        title: 'TVA – Territorialité – Prestation de services B2B',
        reference: 'BOI-TVA-CHAMP-20-50-10',
        url: 'https://bofip.impots.gouv.fr/bofip/1088-PGP',
      },
      {
        title: 'Déclaration européenne de services (DES)',
        reference: 'BOI-TVA-DECLA-20-20-10-10',
        url: 'https://bofip.impots.gouv.fr/bofip/2668-PGP',
      },
      {
        title: 'Article 259 du CGI – Lieu des prestations de services',
        reference: 'CGI art. 259',
        url: 'https://bofip.impots.gouv.fr/bofip/1072-PGP',
      },
    ],
    createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'draft_002',
    status: 'pending_review',
    clientName: 'Sophie Bernard – EURL Bernard Immobilier',
    dossierId: 'dossier_002',
    original_email: {
      from: 'sbernard@bernard-immobilier.fr',
      to: 'cabinet@cabinetflow.fr',
      subject: 'Amortissement bien immobilier – déductibilité',
      body: `Bonjour,\n\nNous avons acquis un immeuble professionnel en décembre dernier pour 450 000 € HT. Quelle est la durée d'amortissement applicable et pouvons-nous déduire la totalité ?\n\nMerci d'avance,\nSophie Bernard`,
      date: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    },
    draft: {
      to: 'sbernard@bernard-immobilier.fr',
      subject: 'Réponse : Amortissement immeuble professionnel',
      body: `Bonjour Mme Bernard,\n\nConcernant l'amortissement de votre immeuble professionnel acquis pour 450 000 € HT :\n\n**Durée d'amortissement**\nSelon la doctrine administrative (BOFiP), les immeubles à usage professionnel sont généralement amortissables sur 25 à 40 ans (taux linéaire de 2,5 % à 4 %). Pour un immeuble commercial standard, une durée de 30 ans (taux de 3,33 %) est communément admise.\n\n**Décomposition en composants**\nL'amortissement par composants (IAS 16 adapté au droit fiscal français) impose de distinguer :\n- Structure/Gros œuvre : 50 ans\n- Toiture : 20 ans\n- Installations générales : 15 ans\n- Agencements intérieurs : 10 ans\n\n**Base amortissable**\nLe terrain n'est pas amortissable. Il convient d'isoler sa valeur (généralement 15-20 % du prix total).\n\nNous vous recommandons de nous transmettre le détail de l'acte notarié pour affiner ce calcul.\n\nCordialement,\nCabinetFlow Expert-Comptable`,
      generatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    },
    bofip_sources_cited: [
      {
        title: 'Amortissements – Durée normale d\'utilisation',
        reference: 'BOI-BIC-AMT-10-40-10',
        url: 'https://bofip.impots.gouv.fr/bofip/2845-PGP',
      },
      {
        title: 'Immobilisations – Méthode par composants',
        reference: 'BOI-BIC-AMT-10-40-20',
        url: 'https://bofip.impots.gouv.fr/bofip/2849-PGP',
      },
    ],
    createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
  {
    id: 'draft_003',
    status: 'approved',
    clientName: 'Luc Moreau – SCI Les Chênes',
    original_email: {
      from: 'luc.moreau@sci-chenes.fr',
      to: 'cabinet@cabinetflow.fr',
      subject: 'Régime fiscal SCI à l\'IS',
      body: `Bonjour,\n\nNous envisageons de basculer notre SCI à l'IS. Quels sont les avantages et les inconvénients ?\n\nCordialement,\nLuc Moreau`,
      date: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    },
    draft: {
      to: 'luc.moreau@sci-chenes.fr',
      subject: 'Réponse : SCI à l\'IS – Analyse comparative',
      body: `Bonjour M. Moreau,\n\nVoici une analyse comparative du passage de votre SCI à l'IS...\n\nCordialement`,
      generatedAt: new Date(Date.now() - 23 * 3600 * 1000).toISOString(),
    },
    bofip_sources_cited: [
      {
        title: 'IS – Sociétés civiles soumises à l\'IS',
        reference: 'BOI-IS-CHAMP-10-10',
        url: 'https://bofip.impots.gouv.fr/bofip/4270-PGP',
      },
    ],
    createdAt: new Date(Date.now() - 25 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 23 * 3600 * 1000).toISOString(),
  },
];

// ─── Store interface ──────────────────────────────────────────────────────────

/**
 * Pure state store for AI email drafts.
 *
 * No side-effects live here. Orchestration (Graph, AI generation, sending)
 * is handled by the useInboxSync hook (src/app/hooks/useInboxSync.ts).
 */
interface EmailDraftStore {
  drafts: AIEmailDraft[];
  loading: boolean;
  /** Control the loading indicator (called by useInboxSync). */
  setLoading: (loading: boolean) => void;
  /** Prepend new drafts generated by useInboxSync. */
  addDrafts: (newDrafts: AIEmailDraft[]) => void;
  approveEmailDraft: (id: string) => void;
  rejectEmailDraft: (id: string) => void;
  updateDraftBody: (id: string, newBody: string) => void;
  updateDraftSubject: (id: string, newSubject: string) => void;
  setStatus: (id: string, status: EmailDraftStatus) => void;
}

const EmailDraftContext = createContext<EmailDraftStore | null>(null);

export function EmailDraftProvider({
  children,
  initialDrafts = DEMO_DRAFTS,
}: {
  children: ReactNode;
  initialDrafts?: AIEmailDraft[];
}) {
  const [drafts, setDrafts] = useState<AIEmailDraft[]>(initialDrafts);
  const [loading, setLoadingState] = useState(false);

  const setLoading = useCallback((value: boolean) => setLoadingState(value), []);

  const setStatus = useCallback((id: string, status: EmailDraftStatus) => {
    setDrafts(prev =>
      prev.map(d =>
        d.id === id ? { ...d, status, updatedAt: new Date().toISOString() } : d,
      ),
    );
  }, []);

  const addDrafts = useCallback((newDrafts: AIEmailDraft[]) => {
    setDrafts(prev => [...newDrafts, ...prev]);
  }, []);

  const approveEmailDraft = useCallback((id: string) => {
    setStatus(id, 'approved');
  }, [setStatus]);

  const rejectEmailDraft = useCallback((id: string) => {
    setStatus(id, 'rejected');
  }, [setStatus]);

  const updateDraftBody = useCallback((id: string, newBody: string) => {
    setDrafts(prev =>
      prev.map(d =>
        d.id === id
          ? { ...d, draft: { ...d.draft, body: newBody }, updatedAt: new Date().toISOString() }
          : d,
      ),
    );
  }, []);

  const updateDraftSubject = useCallback((id: string, newSubject: string) => {
    setDrafts(prev =>
      prev.map(d =>
        d.id === id
          ? { ...d, draft: { ...d.draft, subject: newSubject }, updatedAt: new Date().toISOString() }
          : d,
      ),
    );
  }, []);

  return (
    <EmailDraftContext.Provider
      value={{
        drafts,
        loading,
        setLoading,
        addDrafts,
        approveEmailDraft,
        rejectEmailDraft,
        updateDraftBody,
        updateDraftSubject,
        setStatus,
      }}
    >
      {children}
    </EmailDraftContext.Provider>
  );
}

export function useEmailDraftStore(): EmailDraftStore {
  const ctx = useContext(EmailDraftContext);
  if (!ctx) throw new Error('useEmailDraftStore must be used within EmailDraftProvider');
  return ctx;
}
