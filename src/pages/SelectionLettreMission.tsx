// ============================================================
// PAGE — Sélection du modèle de lettre de mission
// Cabinet HAYOT EXPERTISE
// ============================================================

import React, { useState } from 'react';
import { MISSION_TEMPLATES, MissionTemplate, MissionTemplateId } from '../data/missionTemplates';

interface SelectionLettreMissionProps {
  onSelect: (template: MissionTemplate) => void;
  selectedId?: MissionTemplateId;
}

export const SelectionLettreMission: React.FC<SelectionLettreMissionProps> = ({
  onSelect,
  selectedId,
}) => {
  const [hovered, setHovered] = useState<MissionTemplateId | null>(null);

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* En-tête */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-blue-900 uppercase tracking-wide">
          Choisir un modèle de lettre de mission
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          Sélectionnez le modèle adapté à votre client. Chaque modèle est pré-rempli avec les
          clauses standard du Cabinet HAYOT EXPERTISE.
        </p>
      </div>

      {/* Grille des modèles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {MISSION_TEMPLATES.map((tpl) => {
          const isSelected = selectedId === tpl.id;
          const isHovered = hovered === tpl.id;
          return (
            <button
              key={tpl.id}
              onClick={() => onSelect(tpl)}
              onMouseEnter={() => setHovered(tpl.id)}
              onMouseLeave={() => setHovered(null)}
              className={`text-left rounded-xl border-2 p-5 transition-all duration-150 shadow-sm hover:shadow-md ${
                isSelected
                  ? 'border-blue-700 bg-blue-50'
                  : isHovered
                  ? 'border-blue-300 bg-white'
                  : 'border-gray-200 bg-white'
              }`}
            >
              {/* Badge type */}
              <span
                className={`inline-block text-xs font-semibold px-2 py-0.5 rounded mb-3 ${
                  tpl.badgeColor
                }`}
              >
                {tpl.label}
              </span>

              {/* Description */}
              <p className="text-xs text-gray-600 leading-relaxed">{tpl.description}</p>

              {/* Indicateur sélectionné */}
              {isSelected && (
                <div className="mt-3 flex items-center gap-1 text-blue-700 text-xs font-semibold">
                  <span>✓</span> <span>Sélectionné</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Résumé du modèle sélectionné */}
      {selectedId && (() => {
        const tpl = MISSION_TEMPLATES.find((t) => t.id === selectedId);
        if (!tpl) return null;
        return (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h2 className="text-sm font-bold text-blue-900 mb-2 uppercase tracking-wide">
              Modèle sélectionné — {tpl.label}
            </h2>
            <p className="text-xs text-gray-700 mb-3">
              <strong>Mission par défaut :</strong> {tpl.defaultTypeMission}
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              {Object.entries(tpl.clauses.descriptionMissions).map(([key, lines]) =>
                lines && lines.length > 0 ? (
                  <div key={key} className="bg-white border border-blue-100 rounded p-3">
                    <p className="font-semibold text-blue-800 capitalize mb-1">{key}</p>
                    <ul className="list-disc list-inside space-y-1">
                      {lines.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default SelectionLettreMission;
