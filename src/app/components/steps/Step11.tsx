import { useState, useEffect } from 'react';
import { Trophy, CheckCircle2, Mail, Calendar, Phone, Star, ExternalLink, Eye } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { StepShell } from '../StepShell';
import { sendEmail, buildWelcomeEmail } from '../../services/emailService';
import { useCabinet } from '../../context/CabinetContext';
import { useServices } from '../../context/ServicesContext';
import { EmailPreviewEditModal } from '../modals/EmailPreviewEditModal';
import { toast } from 'sonner';

export function Step11() {
  const { clientData, updateClientData, goPrev } = useOnboarding();
  const [emailSent, setEmailSent] = useState(clientData.welcomeEmailSent);
  const [tasksScheduled, setTasksScheduled] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [emailDemo, setEmailDemo] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [sending, setSending] = useState(false);

  const { cabinet } = useCabinet();
  const { getEmailConfig } = useServices();
  const emailConfig = getEmailConfig();

  useEffect(() => {
    setShowConfetti(true);
    const t = setTimeout(() => setShowConfetti(false), 4500);
    return () => clearTimeout(t);
  }, []);

  const today = new Date();
  const j7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const j30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const formatDate = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  const welcomeEmailHtml = buildWelcomeEmail({
    clientName: clientData.nom,
    raisonSociale: clientData.raisonSociale || clientData.nom,
    pennylaneId: clientData.pennylaneClientId || 'PNY-000000',
    clientEmail: clientData.email,
    expertEmail: cabinet.expertEmail,
    expertName: cabinet.expertNom,
  });

  const welcomeSubject = `Bienvenue chez ${cabinet.nom} — Votre dossier est opérationnel 🎉`;

  const handleSendEmail = async (subject: string, htmlContent: string) => {
    setShowEmailPreview(false);
    setSending(true);
    const result = await sendEmail({
      to: clientData.email,
      toName: clientData.nom,
      subject,
      htmlContent,
    });
    setSending(false);
    setEmailDemo(result.demo ?? false);

    if (result.success) {
      setEmailSent(true);
      updateClientData({ welcomeEmailSent: true });
      if (result.demo) {
        toast.info('Email de bienvenue simulé (configurez SendGrid dans /setup pour l\'envoi réel)');
      } else {
        toast.success(`Email de bienvenue envoyé à ${clientData.email} ✓`);
      }
    } else {
      toast.error(`Erreur envoi email : ${result.error}`);
    }
  };

  const allDone = emailSent && tasksScheduled;

  const confettiColors = ['#fbbf24', '#34d399', '#60a5fa', '#f87171', '#a78bfa', '#fb923c', '#ec4899'];

  return (
    <StepShell
      step={11}
      title="Clôture de l'Onboarding & Suivi"
      subtitle="Envoi de l'email de bienvenue officiel avec accès Pennylane et programmation des tâches de suivi J+7 / J+30"
      type="automatisé"
      icon={<Trophy className="w-5 h-5 text-white" />}
      onBack={goPrev}
      hideNav
    >
      {/* Celebration Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-violet-600 to-emerald-600 rounded-2xl p-6 text-white mb-6 text-center">
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(28)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full animate-bounce"
                style={{
                  left: `${(i * 3.7) % 100}%`,
                  top: `${Math.random() * 80}%`,
                  backgroundColor: confettiColors[i % confettiColors.length],
                  animationDelay: `${i * 0.06}s`,
                  animationDuration: `${0.5 + (i % 4) * 0.15}s`,
                }}
              />
            ))}
          </div>
        )}
        <div className="text-5xl mb-3">🎉</div>
        <h2 className="text-xl text-white">Onboarding terminé avec succès !</h2>
        <p className="text-blue-100 text-sm mt-2">
          <strong>{clientData.raisonSociale || clientData.nom}</strong> est officiellement client du cabinet.
        </p>
        <div className="flex items-center justify-center gap-6 mt-5 flex-wrap">
          {[
            { val: '11', label: 'Étapes complétées' },
            { val: '100%', label: 'Automatisé' },
            { val: String(clientData.missionsSelectionnees.length) || '–', label: 'Missions' },
            { val: clientData.prixAnnuel ? `${Number(clientData.prixAnnuel).toLocaleString('fr-FR')}€` : '–', label: 'HT/an' },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <p className="text-2xl font-bold">{stat.val}</p>
              <p className="text-blue-200 text-xs">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Welcome email section */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-600" />
            <p className="text-sm font-medium text-gray-800">Email de bienvenue officiel</p>
            <span className={`text-xs px-2 py-0.5 rounded-full ${emailConfig.isDemo ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {emailConfig.isDemo ? '🟡 Mode démo' : `🟢 SendGrid (${emailConfig.fromEmail})`}
            </span>
          </div>
          {!emailSent ? (
            <div className="flex gap-2">
              <button
                onClick={() => setShowEmailPreview(true)}
                className="flex items-center gap-1.5 text-gray-600 hover:text-gray-800 text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all"
              >
                <Eye className="w-3.5 h-3.5" /> Prévisualiser
              </button>
              <button
                onClick={() => handleSendEmail(welcomeSubject, welcomeEmailHtml)}
                disabled={sending}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-60"
              >
                {sending ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Mail className="w-3.5 h-3.5" />
                )}
                {sending ? 'Envoi...' : 'Envoyer'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Envoyé
                {emailDemo && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full ml-1">Démo</span>}
              </span>
              <button
                onClick={() => setShowEmailPreview(true)}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <Eye className="w-3 h-3" /> Revoir
              </button>
            </div>
          )}
        </div>

        {/* Email preview card */}
        <div className={`border rounded-xl overflow-hidden ${emailSent ? 'border-emerald-200' : 'border-gray-200'}`}>
          <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">
                À : <strong>{clientData.nom}</strong> &lt;{clientData.email}&gt;
              </p>
              <p className="text-xs text-gray-500">Objet : {welcomeSubject}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${emailSent ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
              {emailSent ? '✓ Envoyé' : 'Prêt'}
            </span>
          </div>
          <div className="p-4 text-xs text-gray-600 space-y-2 leading-relaxed">
            <p>Madame, Monsieur <strong>{clientData.nom}</strong>,</p>
            <p>
              Nous avons le plaisir de vous confirmer que votre dossier <strong>{clientData.raisonSociale || clientData.nom}</strong>{' '}
              est désormais entièrement opérationnel chez <strong>{cabinet.nom}</strong>.
            </p>
            <div className="bg-blue-50 rounded-lg p-2 space-y-1">
              <p>🔐 <strong>Accès Pennylane</strong> (ID : {clientData.pennylaneClientId || 'PNY-000000'})</p>
              <p>👤 <strong>Gestionnaire</strong> : {cabinet.expertNom} — {cabinet.expertEmail}</p>
            </div>
            <p className="text-gray-400">Cordialement, <strong>L'équipe {cabinet.nom}</strong></p>
          </div>
        </div>
      </div>

      {/* Follow-up tasks */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-violet-600" />
            <p className="text-sm font-medium text-gray-800">Tâches de suivi automatiques</p>
          </div>
          {!tasksScheduled ? (
            <button
              onClick={() => {
                setTasksScheduled(true);
                toast.success('Tâches de suivi J+7 et J+30 programmées ✓');
              }}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            >
              <Calendar className="w-3.5 h-3.5" /> Programmer
            </button>
          ) : (
            <span className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Programmées
            </span>
          )}
        </div>

        <div className="space-y-2">
          {[
            {
              icon: <Phone className="w-4 h-4 text-blue-600" />,
              title: 'Appel de courtoisie J+7',
              date: formatDate(j7),
              desc: 'Vérification prise en main Pennylane et satisfaction',
              bg: 'bg-blue-50',
              iconBg: 'bg-blue-100',
            },
            {
              icon: <Star className="w-4 h-4 text-amber-600" />,
              title: 'Bilan de satisfaction J+30',
              date: formatDate(j30),
              desc: 'Enquête NPS + ajustements de mission si nécessaire',
              bg: 'bg-amber-50',
              iconBg: 'bg-amber-100',
            },
          ].map((task, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
                tasksScheduled ? 'bg-emerald-50 border-emerald-200' : `${task.bg} border-gray-200`
              }`}
            >
              <div className={`w-8 h-8 rounded-lg ${task.iconBg} flex items-center justify-center flex-shrink-0`}>
                {task.icon}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{task.title}</p>
                <p className="text-xs text-gray-500">{task.desc}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-medium text-gray-600">{task.date}</p>
                {tasksScheduled && <p className="text-xs text-emerald-600 mt-0.5">✓ Programmé</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Final summary */}
      {allDone && (
        <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-800">Dossier 100% clôturé — Onboarding terminé</p>
          </div>
          <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs text-gray-600 mb-4">
            <p>✓ SIREN vérifié (API gouvernementale)</p>
            <p>✓ Espace client SharePoint créé</p>
            <p>✓ Documents reçus & validés (IA)</p>
            <p>{'✓ Lettre de Mission signee (JeSignExpert)'}</p>
            <p>✓ KYC & Due Diligence complétés</p>
            <p>✓ Pennylane configuré + mandat SEPA</p>
            <p>✓ Délégations accès opérationnelles</p>
            <p>✓ Suivi J+7 / J+30 programmé</p>
            {clientData.missionType === 'reprise' && <p>✓ Lettre confraternelle envoyée</p>}
            <p>✓ Email de bienvenue envoyé</p>
          </div>

          {/* Quick access links */}
          <div className="flex flex-wrap gap-2 border-t border-emerald-200 pt-3">
            {clientData.sharepointFolderUrl && (
              <a
                href={clientData.sharepointFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline bg-white px-3 py-1.5 rounded-lg border border-blue-200"
              >
                <ExternalLink className="w-3 h-3" /> SharePoint
              </a>
            )}
            <a
              href="https://app.pennylane.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-emerald-600 hover:underline bg-white px-3 py-1.5 rounded-lg border border-emerald-200"
            >
              <ExternalLink className="w-3 h-3" /> Pennylane
            </a>
          </div>
        </div>
      )}

      {/* Email Preview Modal */}
      {showEmailPreview && (
        <EmailPreviewEditModal
          subject={welcomeSubject}
          htmlContent={welcomeEmailHtml}
          to={clientData.email}
          toName={clientData.nom}
          onSend={handleSendEmail}
          onClose={() => setShowEmailPreview(false)}
        />
      )}
    </StepShell>
  );
}
