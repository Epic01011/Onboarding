import { createContext, useContext, ReactNode } from 'react';
import { useApiKeys } from '../hooks/useApiKeys';
import {
  ServiceConnections,
  ServiceConnection,
  getEmailConfig as getEmailConfigFromStorage,
} from '../utils/servicesStorage';

interface ServicesContextType {
  connections: ServiceConnections;
  updateService: (
    service: keyof ServiceConnections,
    data: Partial<ServiceConnection>,
  ) => Promise<void>;
  loading: boolean;
  /** Returns email configuration derived from current connections */
  getEmailConfig: () => ReturnType<typeof getEmailConfigFromStorage>;
}

const ServicesContext = createContext<ServicesContextType | null>(null);

export function ServicesProvider({ children }: { children: ReactNode }) {
  const { connections, updateService, loading } = useApiKeys();

  // Derive email config from live connections (not stale localStorage)
  const getEmailConfig = (): ReturnType<typeof getEmailConfigFromStorage> => {
    // Priority 1: Microsoft Outlook / Exchange (SMTP app password)
    const ms = connections.microsoft;
    if (ms.connected && ms.email && ms.appPassword) {
      return {
        provider: 'microsoft',
        apiKey: null,
        appPassword: ms.appPassword,
        fromEmail: ms.email,
        fromName: ms.displayName ?? 'Cabinet Expert-Comptable',
        isDemo: false,
      };
    }

    // Priority 2: Google Gmail (SMTP app password)
    const google = connections.google;
    if (google.connected && google.email && google.appPassword) {
      return {
        provider: 'google',
        apiKey: null,
        appPassword: google.appPassword,
        fromEmail: google.email,
        fromName: google.displayName ?? 'Cabinet Expert-Comptable',
        isDemo: false,
      };
    }

    // Priority 3: SendGrid API key
    const sg = connections.sendgrid;
    if (sg.connected && sg.apiKey) {
      return {
        provider: 'sendgrid',
        apiKey: sg.apiKey,
        appPassword: null,
        fromEmail: sg.fromEmail ?? 'onboarding@cabinet.fr',
        fromName: sg.fromName ?? 'Cabinet Expert-Comptable',
        isDemo: false,
      };
    }

    const envKey = import.meta.env.VITE_SENDGRID_API_KEY;
    if (envKey) {
      return {
        provider: 'sendgrid',
        apiKey: envKey,
        appPassword: null,
        fromEmail: import.meta.env.VITE_FROM_EMAIL ?? 'onboarding@cabinet.fr',
        fromName: import.meta.env.VITE_FROM_NAME ?? 'Cabinet Expert-Comptable',
        isDemo: false,
      };
    }

    return {
      provider: 'demo',
      apiKey: null,
      appPassword: null,
      fromEmail: 'onboarding@cabinet.fr',
      fromName: 'CabinetFlow',
      isDemo: true,
    };
  };

  return (
    <ServicesContext.Provider value={{ connections, updateService, loading, getEmailConfig }}>
      {children}
    </ServicesContext.Provider>
  );
}

export function useServices() {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error('useServices must be used within ServicesProvider');
  return ctx;
}
