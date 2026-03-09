export type EmailDraftStatus = 'pending_review' | 'approved' | 'rejected' | 'sent';

export interface BofipSource {
  title: string;
  reference: string;
  url: string;
}

export interface OriginalEmail {
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string;
}

export interface DraftContent {
  to: string;
  subject: string;
  body: string;
  generatedAt: string;
}

export interface AIEmailDraft {
  id: string;
  status: EmailDraftStatus;
  clientName: string;
  dossierId?: string;
  original_email: OriginalEmail;
  draft: DraftContent;
  bofip_sources_cited: BofipSource[];
  createdAt: string;
  updatedAt: string;
}
