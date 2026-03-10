export type EmailDraftStatus = 'pending_review' | 'approved' | 'rejected' | 'sent';

/** Sentiment tags automatically applied to an incoming email. */
export type SentimentTag = 'urgent' | 'unhappy' | 'document_request';

/** Pre-instruction (system prompt) text per AI provider.
 *
 * Each provider can have a distinct system instruction that is prepended
 * to the base prompt before generation. The active provider's instruction
 * is automatically selected when drafts are generated in Inbox IA.
 */
export interface SystemPromptConfig {
  /** Pre-instruction used when Claude (Anthropic) is the active AI provider. */
  claude: string;
  /** Pre-instruction used when OpenAI (GPT) is the active AI provider. */
  openai: string;
  /** Pre-instruction used when Perplexity AI is the active provider. */
  perplexity: string;
}

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

/** Optional client context used for RAG-enriched AI generation. */
export interface ClientContext {
  lastEmails?: string[];
  devisStatus?: string;
  clientName?: string;
}

export interface AIEmailDraft {
  id: string;
  status: EmailDraftStatus;
  clientName: string;
  dossierId?: string;
  original_email: OriginalEmail;
  draft: DraftContent;
  bofip_sources_cited: BofipSource[];
  sentimentTags?: SentimentTag[];
  createdAt: string;
  updatedAt: string;
}
