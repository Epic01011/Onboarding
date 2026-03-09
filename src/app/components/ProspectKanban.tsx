/**
 * ProspectKanban — Vue Pipeline Kanban pour le module Prospection (Chantier 9)
 *
 * Colonnes : Lead à contacter · Email envoyé · En négociation (RDV) · Gagné (Client) · Perdu
 * Drag & Drop via react-dnd (déjà installé).
 */

import { useRef, useMemo } from 'react';
import { useDrag, useDrop, DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  Mail, Phone, Building2, Calendar, Eye, MousePointerClick,
  PhoneCall, Euro, CalendarClock,
} from 'lucide-react';
import type { Prospect } from '../services/prospectApi';

// ─── Types ────────────────────────────────────────────────────────────────────

export type KanbanColumn =
  | 'a-contacter'
  | 'email-envoye'
  | 'en-negociation'
  | 'gagne'
  | 'perdu';

export interface KanbanLead extends Prospect {
  /** UUID primary key from Supabase — used as the stable drag & drop identifier */
  id: string;
  kanbanColumn: KanbanColumn;
  openCount: number;
  clicked: boolean;
  emailSentAt?: string;
  icebreakerIa?: string;
  sequenceStep: number;
  nextFollowUpDate?: string;
  callLogs: string[];
  /** Valeur financière estimée du contrat (€) */
  estimatedValue?: number | null;
  /** Date de la prochaine action commerciale */
  nextActionDate?: string | null;
}

interface ProspectKanbanProps {
  leads: KanbanLead[];
  onMoveCard: (id: string, column: KanbanColumn) => void;
  onCardClick: (id: string) => void;
}

// ─── Column config ────────────────────────────────────────────────────────────

const COLUMNS: Array<{ id: KanbanColumn; label: string; color: string; bg: string; icon: string }> = [
  { id: 'a-contacter',   label: 'Lead à contacter',       color: 'text-slate-600',   bg: 'bg-slate-50 border-slate-200',   icon: '📋' },
  { id: 'email-envoye',  label: 'Email envoyé',           color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-200',     icon: '📧' },
  { id: 'en-negociation',label: 'En négociation (RDV)',   color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200',   icon: '🤝' },
  { id: 'gagne',         label: 'Gagné (Client)',         color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', icon: '🏆' },
  { id: 'perdu',         label: 'Perdu',                  color: 'text-red-500',     bg: 'bg-red-50 border-red-200',       icon: '❌' },
];

const DRAG_TYPE = 'PROSPECT_CARD';

// ─── Draggable Card ───────────────────────────────────────────────────────────

function ProspectCard({
  lead,
  onCardClick,
}: {
  lead: KanbanLead;
  onCardClick: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: DRAG_TYPE,
    item: { id: lead.id },
    collect: monitor => ({ isDragging: monitor.isDragging() }),
  });

  drag(ref);

  return (
    <div
      ref={ref}
      onClick={() => onCardClick(lead.id)}
      className={`group bg-white rounded-lg border border-gray-200 shadow-sm p-3 cursor-grab active:cursor-grabbing transition-all hover:shadow-md hover:border-blue-200 ${
        isDragging ? 'opacity-40 rotate-2 scale-95' : 'opacity-100'
      }`}
    >
      {/* Company */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <p className="text-xs font-semibold text-gray-900 truncate leading-tight">
            {lead.nomSociete}
          </p>
        </div>
        <span className="text-[10px] font-medium text-gray-400 flex-shrink-0 bg-gray-100 px-1.5 py-0.5 rounded">
          {lead.formeJuridique}
        </span>
      </div>

      {/* Manager */}
      {lead.dirigeantPrincipal && (
        <p className="text-[11px] text-gray-500 mb-2 flex items-center gap-1">
          <span className="w-4 h-4 bg-blue-100 rounded-full inline-flex items-center justify-center text-blue-600 font-semibold text-[8px] flex-shrink-0">
            {((lead.dirigeantPrincipal.prenom?.[0] ?? '') + (lead.dirigeantPrincipal.nom?.[0] ?? '')).toUpperCase()}
          </span>
          <span className="truncate">
            {lead.dirigeantPrincipal.prenom} {lead.dirigeantPrincipal.nom}
          </span>
        </p>
      )}

      {/* Contact info */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {lead.email && (
          <span className="flex items-center gap-0.5 text-[10px] text-blue-500">
            <Mail className="w-2.5 h-2.5" /> Email
          </span>
        )}
        {lead.telephone && (
          <span className="flex items-center gap-0.5 text-[10px] text-green-500">
            <Phone className="w-2.5 h-2.5" /> Tél
          </span>
        )}
        {lead.callLogs.length > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-purple-500">
            <PhoneCall className="w-2.5 h-2.5" /> {lead.callLogs.length} appel{lead.callLogs.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Tracking badges */}
      {lead.emailSentAt && (
        <div className="flex flex-wrap gap-1 mb-2">
          {lead.openCount > 0 ? (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Eye className="w-2.5 h-2.5" /> Ouvert ({lead.openCount}×)
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-400">
              Non ouvert
            </span>
          )}
          {lead.clicked && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
              <MousePointerClick className="w-2.5 h-2.5" /> Cliqué
            </span>
          )}
        </div>
      )}

      {/* Sequence step */}
      {lead.sequenceStep > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-amber-600">
          <Calendar className="w-2.5 h-2.5" />
          {lead.sequenceStep === 1 ? 'Relance 1' : 'Relance 2'} planifiée
          {lead.nextFollowUpDate && ` — ${new Date(lead.nextFollowUpDate).toLocaleDateString('fr-FR')}`}
        </div>
      )}

      {/* CRM metrics: estimated value + next action date */}
      {(lead.estimatedValue != null || lead.nextActionDate) && (
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5 pt-1.5 border-t border-gray-100">
          {lead.estimatedValue != null && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Euro className="w-2.5 h-2.5" />
              {lead.estimatedValue.toLocaleString('fr-FR')} €
            </span>
          )}
          {lead.nextActionDate && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
              <CalendarClock className="w-2.5 h-2.5" />
              {new Date(lead.nextActionDate).toLocaleDateString('fr-FR')}
            </span>
          )}
        </div>
      )}

      {/* Icebreaker */}
      {lead.icebreakerIa && (
        <p className="text-[10px] text-violet-600 italic mt-1.5 line-clamp-2 border-t border-violet-100 pt-1.5">
          ✨ {lead.icebreakerIa}
        </p>
      )}
    </div>
  );
}

// ─── Droppable Column ─────────────────────────────────────────────────────────

function KanbanColumnArea({
  column,
  leads,
  onDrop,
  onCardClick,
}: {
  column: typeof COLUMNS[number];
  leads: KanbanLead[];
  onDrop: (id: string, columnId: KanbanColumn) => void;
  onCardClick: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isOver }, drop] = useDrop<{ id: string }, void, { isOver: boolean }>({
    accept: DRAG_TYPE,
    drop: item => onDrop(item.id, column.id),
    collect: monitor => ({ isOver: monitor.isOver() }),
  });

  drop(ref);

  return (
    <div
      ref={ref}
      className={`flex flex-col rounded-xl border-2 transition-all min-w-[220px] max-w-[280px] flex-1 ${
        isOver
          ? 'border-blue-400 bg-blue-50/50 shadow-md'
          : `${column.bg} border-transparent`
      }`}
    >
      {/* Column header */}
      <div className="px-3 py-3 border-b border-white/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-base">{column.icon}</span>
            <p className={`text-xs font-semibold ${column.color}`}>{column.label}</p>
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white/80 ${column.color}`}>
            {leads.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[80px]">
        {leads.length === 0 && (
          <div className={`flex items-center justify-center h-16 text-xs ${column.color} opacity-40 italic`}>
            Glissez une carte ici
          </div>
        )}
        {leads.map(lead => (
          <ProspectCard key={lead.id} lead={lead} onCardClick={onCardClick} />
        ))}
      </div>
    </div>
  );
}

// ─── Main Kanban Board ────────────────────────────────────────────────────────

export function ProspectKanban({ leads, onMoveCard, onCardClick }: ProspectKanbanProps) {
  // Memoize the grouping of leads by column to avoid re-filtering on every render
  const leadsByColumn = useMemo(() => {
    const grouped = new Map<KanbanColumn, KanbanLead[]>();
    COLUMNS.forEach(col => grouped.set(col.id, []));
    leads.forEach(lead => {
      const arr = grouped.get(lead.kanbanColumn);
      if (arr) arr.push(lead);
    });
    return grouped;
  }, [leads]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex gap-3 h-full overflow-x-auto p-4">
        {COLUMNS.map(col => {
          const colLeads = leadsByColumn.get(col.id) || [];
          return (
            <KanbanColumnArea
              key={col.id}
              column={col}
              leads={colLeads}
              onDrop={onMoveCard}
              onCardClick={onCardClick}
            />
          );
        })}
      </div>
    </DndProvider>
  );
}

// ─── Helper: map LeadStatus → KanbanColumn ────────────────────────────────────

export function statusToKanban(statut: string): KanbanColumn {
  switch (statut) {
    case 'contacte':        return 'email-envoye';
    case 'interesse':       return 'en-negociation';
    case 'non-interesse':   return 'perdu';
    default:                return 'a-contacter';
  }
}

export function kanbanToStatus(column: KanbanColumn): string {
  switch (column) {
    case 'email-envoye':    return 'contacte';
    case 'en-negociation':  return 'interesse';
    case 'gagne':           return 'interesse';
    case 'perdu':           return 'non-interesse';
    default:                return 'nouveau';
  }
}
