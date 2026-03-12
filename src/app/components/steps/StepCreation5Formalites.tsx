import { useState } from 'react';
import { Scale, ExternalLink, CheckSquare, Square } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { StepShell } from '../StepShell';

const GUICHET_URL = 'https://leguichetdesformalites.fr/';

export function StepCreation5Formalites() {
  const { clientData, updateClientData, goNext } = useOnboarding();

  const [annonceLegal, setAnnonceLegal] = useState(clientData.annonceLegalPubliee);
  const [dossierGreffe, setDossierGreffe] = useState(clientData.dossierDeposesGreffe);

  const toggleAnnonce = () => {
    const next = !annonceLegal;
    setAnnonceLegal(next);
    updateClientData({ annonceLegalPubliee: next });
  };

  const toggleGreffe = () => {
    const next = !dossierGreffe;
    setDossierGreffe(next);
    updateClientData({ dossierDeposesGreffe: next });
  };

  const allChecked = annonceLegal && dossierGreffe;

  return (
    <StepShell
      step={5}
      title="Formalités Légales"
      subtitle="Accédez au Guichet des Formalités pour déposer le dossier, puis validez chaque étape ci-dessous."
      type="conditionnel"
      icon={<Scale className="w-5 h-5 text-white" />}
      onNext={goNext}
      nextDisabled={!allChecked}
      skipLabel="Passer cette étape →"
    >
      {/* Guichet button */}
      <a
        href={GUICHET_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-3 w-full py-4 px-6 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm hover:shadow-md text-base font-semibold mb-8"
      >
        <ExternalLink className="w-5 h-5" />
        Accéder au Guichet des Formalités
      </a>

      {/* Checklist */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700 mb-2">
          Validez chaque étape après l'avoir réalisée :
        </p>

        <button
          onClick={toggleAnnonce}
          className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl border-2 text-left transition-all ${
            annonceLegal
              ? 'border-emerald-300 bg-emerald-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          {annonceLegal ? (
            <CheckSquare className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <Square className="w-5 h-5 text-gray-400 flex-shrink-0" />
          )}
          <div>
            <p className={`text-sm font-medium ${annonceLegal ? 'text-emerald-700' : 'text-gray-700'}`}>
              Annonce légale publiée
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Publication dans un journal d'annonces légales (JAL) du département du siège social
            </p>
          </div>
        </button>

        <button
          onClick={toggleGreffe}
          className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl border-2 text-left transition-all ${
            dossierGreffe
              ? 'border-emerald-300 bg-emerald-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          {dossierGreffe ? (
            <CheckSquare className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <Square className="w-5 h-5 text-gray-400 flex-shrink-0" />
          )}
          <div>
            <p className={`text-sm font-medium ${dossierGreffe ? 'text-emerald-700' : 'text-gray-700'}`}>
              Dossier déposé au Greffe du Tribunal de Commerce
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Via le Guichet des Formalités ou dépôt papier au Greffe compétent
            </p>
          </div>
        </button>
      </div>

      {allChecked && (
        <div className="mt-5 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
          <CheckSquare className="w-4 h-4 flex-shrink-0" />
          Toutes les formalités sont validées. Vous pouvez passer au suivi du Kbis.
        </div>
      )}
    </StepShell>
  );
}
