import { createBrowserRouter } from "react-router";
import { AuthLayout } from "./components/Layout";
import { AuthPage } from "./pages/AuthPage";
import { NotFound } from "./pages/NotFound";

export const router = createBrowserRouter([
  // Public route — authentification
  {
    path: '/auth',
    Component: AuthPage,
  },
  // Public route — mot de passe oublié
  {
    path: '/forgot-password',
    lazy: async () => {
      const { ForgotPasswordPage } = await import('./pages/ForgotPasswordPage');
      return { Component: ForgotPasswordPage };
    },
  },
  // Public route — réinitialisation du mot de passe (lien email Supabase)
  {
    path: '/reset-password',
    lazy: async () => {
      const { ResetPasswordPage } = await import('./pages/ResetPasswordPage');
      return { Component: ResetPasswordPage };
    },
  },
  // Protected routes — AuthLayout (ProtectedRoute)
  // All page components are lazy-loaded so each route becomes its own chunk,
  // reducing the initial JS payload and eliminating the chunk-size warning.
  {
    Component: AuthLayout,
    children: [
      {
        index: true,
        lazy: async () => {
          const { Dashboard } = await import('./pages/Dashboard');
          return { Component: Dashboard };
        },
      },
      {
        path: "setup",
        lazy: async () => {
          const { ConnectServices } = await import('./pages/ConnectServices');
          return { Component: ConnectServices };
        },
      },
      {
        // Settings page — cabinet info + AI configuration
        path: "settings",
        lazy: async () => {
          const { SettingsPage } = await import('./pages/SettingsPage');
          return { Component: SettingsPage };
        },
      },
      {
        path: "ged",
        lazy: async () => {
          const { SharePointGed } = await import('./pages/SharePointGed');
          return { Component: SharePointGed };
        },
      },
      {
        path: "templates",
        lazy: async () => {
          const { TemplateManager } = await import('./pages/TemplateManager');
          return { Component: TemplateManager };
        },
      },
      {
        path: "onboarding/:dossierId",
        lazy: async () => {
          const { OnboardingFlow } = await import('./pages/OnboardingFlow');
          return { Component: OnboardingFlow };
        },
      },
      {
        path: "onboarding-client",
        lazy: async () => {
          const { OnboardingClient } = await import('./pages/OnboardingClient');
          return { Component: OnboardingClient };
        },
      },
      {
        path: "fiscal-calendar",
        lazy: async () => {
          const { FiscalCalendar } = await import('./pages/FiscalCalendar');
          return { Component: FiscalCalendar };
        },
      },
      {
        path: "inbox-ia",
        lazy: async () => {
          const { InboxIA } = await import('./pages/InboxIA');
          return { Component: InboxIA };
        },
      },
      {
        path: "pricing",
        lazy: async () => {
          const { PricingEngine } = await import('./pages/PricingEngine');
          return { Component: PricingEngine };
        },
      },
      {
        path: "lettre-mission",
        lazy: async () => {
          const { LettreMission } = await import('./pages/LettreMission');
          return { Component: LettreMission };
        },
      },
      {
        path: "ai-assistant",
        lazy: async () => {
          const { AiAssistantPage } = await import('./pages/AiAssistantPage');
          return { Component: AiAssistantPage };
        },
      },
      {
        path: "taches-overdue",
        lazy: async () => {
          const { TachesOverdue } = await import('./pages/TachesOverdue');
          return { Component: TachesOverdue };
        },
      },
      {
        path: "lettre-reprise",
        lazy: async () => {
          const { LettreReprise } = await import('./pages/LettreReprise');
          return { Component: LettreReprise };
        },
      },
      {
        path: "relances-critiques",
        lazy: async () => {
          const { RelancesCritiques } = await import('./pages/RelancesCritiques');
          return { Component: RelancesCritiques };
        },
      },
      {
        path: "dossiers-actifs",
        lazy: async () => {
          const { DossiersActifs } = await import('./pages/DossiersActifs');
          return { Component: DossiersActifs };
        },
      },
      {
        path: "prospection",
        lazy: async () => {
          const { Prospection } = await import('./pages/Prospection');
          return { Component: Prospection };
        },
      },
      {
        path: "events-campaign",
        lazy: async () => {
          const { EventsCampaign } = await import('./pages/EventsCampaign');
          return { Component: EventsCampaign };
        },
      },
      {
        path: "action-center",
        lazy: async () => {
          const { ActionCenter } = await import('./pages/ActionCenter');
          return { Component: ActionCenter };
        },
      },
    ],
  },
  // Public route — client portal (magic link)
  {
    path: 'portal/:dossierId',
    lazy: async () => {
      const { ClientPortal } = await import('./pages/ClientPortal');
      return { Component: ClientPortal };
    },
  },
  // Catch-all — 404
  {
    path: '*',
    Component: NotFound,
  },
]);

