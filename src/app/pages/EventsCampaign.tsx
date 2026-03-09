/**
 * EventsCampaign — Gestion d'Événements Locaux (Webinaires & Petits-déjeuners)
 *
 * Fonctionnalités :
 *  - Créer et gérer des événements (webinaire, petit-déjeuner, séminaire…)
 *  - Sélectionner des prospects par région et les inviter par email
 *  - Suivre les RSVP : Inscrit · A participé · Absent
 *  - Les statuts RSVP sont synchronisés dans le module Prospection
 */

import { useState, useMemo } from 'react';
import {
  Calendar, Plus, Send, Users, MapPin, CheckCircle2, X, XCircle,
  Clock, Loader2, ChevronRight, Trash2, Coffee, Monitor, Star,
  Check, PartyPopper, Filter,
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { getDemoProspects } from '../services/prospectApi';
import { sendEmail } from '../services/emailService';
import { getCabinetInfo, getEmailConfig } from '../utils/servicesStorage';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EventType = 'petit-dejeuner' | 'webinaire' | 'seminaire' | 'autre';
export type RsvpStatus = 'invite' | 'inscrit' | 'a-participe' | 'absent';

export interface EventEntry {
  id: string;
  title: string;
  type: EventType;
  date: string;          // ISO date string
  time: string;          // "HH:MM"
  location: string;
  description: string;
  targetDepartment: string;
  createdAt: string;
}

export interface EventInvite {
  eventId: string;
  siren: string;
  nomSociete: string;
  email: string;
  dirigeant: string;
  ville: string;
  rsvp: RsvpStatus;
  invitedAt: string;
}

const STORAGE_KEY_EVENTS   = 'cabinetflow_events';
const STORAGE_KEY_INVITES  = 'cabinetflow_event_invites';

// ─── Persistence helpers ──────────────────────────────────────────────────────

function loadEvents(): EventEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_EVENTS) ?? '[]'); }
  catch { return []; }
}
function saveEvents(events: EventEntry[]): void {
  try { localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(events)); }
  catch { /* ignore */ }
}
function loadInvites(): EventInvite[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_INVITES) ?? '[]'); }
  catch { return []; }
}
function saveInvites(invites: EventInvite[]): void {
  try { localStorage.setItem(STORAGE_KEY_INVITES, JSON.stringify(invites)); }
  catch { /* ignore */ }
}

// ─── Config ───────────────────────────────────────────────────────────────────

const EVENT_TYPE_CONFIG: Record<EventType, { label: string; icon: React.ReactNode; color: string }> = {
  'petit-dejeuner': { label: 'Petit-déjeuner',  icon: <Coffee className="w-4 h-4" />,   color: 'bg-amber-50 text-amber-700 border-amber-200' },
  webinaire:        { label: 'Webinaire',        icon: <Monitor className="w-4 h-4" />,  color: 'bg-blue-50 text-blue-700 border-blue-200' },
  seminaire:        { label: 'Séminaire',        icon: <Star className="w-4 h-4" />,     color: 'bg-violet-50 text-violet-700 border-violet-200' },
  autre:            { label: 'Autre',            icon: <Calendar className="w-4 h-4" />, color: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const RSVP_CONFIG: Record<RsvpStatus, { label: string; pill: string; icon: React.ReactNode }> = {
  invite:       { label: 'Invité',        pill: 'bg-gray-100 text-gray-600',         icon: <Clock className="w-3 h-3" /> },
  inscrit:      { label: 'Inscrit',       pill: 'bg-emerald-100 text-emerald-700',   icon: <Check className="w-3 h-3" /> },
  'a-participe':{ label: 'A participé',   pill: 'bg-blue-100 text-blue-700',         icon: <PartyPopper className="w-3 h-3" /> },
  absent:       { label: 'Absent',        pill: 'bg-red-100 text-red-600',           icon: <XCircle className="w-3 h-3" /> },
};

// ─── Empty event form ─────────────────────────────────────────────────────────

function emptyEvent(): Omit<EventEntry, 'id' | 'createdAt'> {
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
  return {
    title: '',
    type: 'petit-dejeuner',
    date: tomorrow,
    time: '08:30',
    location: '',
    description: '',
    targetDepartment: '',
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EventsCampaign() {
  const [events, setEvents]     = useState<EventEntry[]>(loadEvents);
  const [invites, setInvites]   = useState<EventInvite[]>(loadInvites);

  // Form
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(emptyEvent);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof EventEntry, string>>>({});

  // Selected event
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const selectedEvent = events.find(e => e.id === selectedId) ?? null;

  // Invites for selected event
  const eventInvites = useMemo(
    () => invites.filter(i => i.eventId === selectedId),
    [invites, selectedId],
  );

  // Prospect selection modal
  const [showProspectPicker, setShowProspectPicker]   = useState(false);
  const [pickerFilter, setPickerFilter]               = useState('');
  const [pickerSelected, setPickerSelected]           = useState<Set<string>>(new Set());
  const [sending, setSending]                         = useState(false);

  // RSVP filter
  const [rsvpFilter, setRsvpFilter] = useState<RsvpStatus | 'all'>('all');

  // ── Prospect pool (demo) ────────────────────────────────────────────────
  const allProspects = useMemo(() => getDemoProspects(), []);

  const filteredProspects = useMemo(() => {
    const dept = selectedEvent?.targetDepartment;
    const q = pickerFilter.toLowerCase();
    return allProspects.filter(p => {
      if (dept && p.departement !== dept && !p.codePostal.startsWith(dept)) return false;
      if (q && !p.nomSociete.toLowerCase().includes(q) && !p.ville.toLowerCase().includes(q)) return false;
      // Exclude already invited
      if (eventInvites.some(i => i.siren === p.siren)) return false;
      return true;
    });
  }, [allProspects, selectedEvent, pickerFilter, eventInvites]);

  const filteredEventInvites = useMemo(() => {
    if (rsvpFilter === 'all') return eventInvites;
    return eventInvites.filter(i => i.rsvp === rsvpFilter);
  }, [eventInvites, rsvpFilter]);

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:       eventInvites.length,
    inscrit:     eventInvites.filter(i => i.rsvp === 'inscrit').length,
    aParticipe:  eventInvites.filter(i => i.rsvp === 'a-participe').length,
    absent:      eventInvites.filter(i => i.rsvp === 'absent').length,
  }), [eventInvites]);

  // ── Form validation ──────────────────────────────────────────────────────
  function validateForm(): boolean {
    const errors: typeof formErrors = {};
    if (!form.title.trim())    errors.title    = 'Titre requis';
    if (!form.date)            errors.date     = 'Date requise';
    if (!form.location.trim()) errors.location = 'Lieu requis';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── Create event ─────────────────────────────────────────────────────────
  function createEvent() {
    if (!validateForm()) return;
    const event: EventEntry = {
      ...form,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const updated = [event, ...events];
    setEvents(updated);
    saveEvents(updated);
    setSelectedId(event.id);
    setShowForm(false);
    setForm(emptyEvent());
    toast.success('Événement créé !');
  }

  // ── Delete event ─────────────────────────────────────────────────────────
  function deleteEvent(id: string) {
    if (!confirm('Supprimer cet événement et toutes ses invitations ?')) return;
    const updated = events.filter(e => e.id !== id);
    setEvents(updated);
    saveEvents(updated);
    const updInvites = invites.filter(i => i.eventId !== id);
    setInvites(updInvites);
    saveInvites(updInvites);
    if (selectedId === id) setSelectedId(updated[0]?.id ?? null);
  }

  // ── Send invitations ─────────────────────────────────────────────────────
  async function sendInvitations() {
    if (!selectedEvent || pickerSelected.size === 0) return;
    setSending(true);

    const toInvite = filteredProspects.filter(p => pickerSelected.has(p.siren));
    const cabinet  = getCabinetInfo();
    const emailCfg = getEmailConfig();
    const now      = new Date().toISOString();

    const eventTypeLbl = EVENT_TYPE_CONFIG[selectedEvent.type].label;
    const dateStr = new Date(selectedEvent.date).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    let sentCount = 0;
    for (const p of toInvite) {
      const prenom = p.dirigeantPrincipal?.prenom ?? 'Madame, Monsieur';
      const subject = `Invitation — ${selectedEvent.title}`;
      const body = `Bonjour ${prenom},\n\n` +
        `Nous avons le plaisir de vous inviter à notre ${eventTypeLbl} :\n\n` +
        `📅 ${selectedEvent.title}\n` +
        `📆 ${dateStr} à ${selectedEvent.time}\n` +
        `📍 ${selectedEvent.location}\n\n` +
        (selectedEvent.description ? `${selectedEvent.description}\n\n` : '') +
        `Pour confirmer votre présence, répondez simplement à cet email.\n\n` +
        `Cordialement,\n${cabinet.expertNom || cabinet.nom || 'Le Cabinet'}`;

      if (p.email && !emailCfg.isDemo) {
        try {
          await sendEmail({ to: p.email, subject, htmlContent: body });
          sentCount++;
        } catch { /* continue */ }
      } else {
        sentCount++; // Demo count
      }
    }

    const newInvites: EventInvite[] = toInvite.map(p => ({
      eventId: selectedEvent.id,
      siren: p.siren,
      nomSociete: p.nomSociete,
      email: p.email,
      dirigeant: p.dirigeantPrincipal
        ? `${p.dirigeantPrincipal.prenom} ${p.dirigeantPrincipal.nom}`
        : '',
      ville: p.ville,
      rsvp: 'invite',
      invitedAt: now,
    }));

    const updInvites = [...invites, ...newInvites];
    setInvites(updInvites);
    saveInvites(updInvites);
    setPickerSelected(new Set());
    setShowProspectPicker(false);
    setSending(false);
    toast.success(`${sentCount} invitation${sentCount !== 1 ? 's' : ''} envoyée${sentCount !== 1 ? 's' : ''} !`);
  }

  // ── Update RSVP ──────────────────────────────────────────────────────────
  function updateRsvp(siren: string, rsvp: RsvpStatus) {
    const updated = invites.map(i =>
      i.eventId === selectedId && i.siren === siren ? { ...i, rsvp } : i
    );
    setInvites(updated);
    saveInvites(updated);
  }

  // ── Remove invite ────────────────────────────────────────────────────────
  function removeInvite(siren: string) {
    const updated = invites.filter(i => !(i.eventId === selectedId && i.siren === siren));
    setInvites(updated);
    saveInvites(updated);
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* ══ LEFT — Events list ════════════════════════════════════════════════ */}
      <aside className="w-72 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-none">Événements</p>
              <p className="text-xs text-gray-400 mt-0.5">Webinaires & Petits-déjeuners</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Créer un événement
          </button>
        </div>

        {/* Event list */}
        <div className="flex-1 overflow-y-auto py-2">
          {events.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <Calendar className="w-8 h-8 mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium text-gray-500">Aucun événement</p>
              <p className="text-xs text-gray-400 mt-1">Créez votre premier événement local.</p>
            </div>
          ) : (
            events.map(event => {
              const cfg = EVENT_TYPE_CONFIG[event.type];
              const isSelected = event.id === selectedId;
              const inviteCount = invites.filter(i => i.eventId === event.id).length;
              return (
                <button
                  key={event.id}
                  onClick={() => setSelectedId(event.id)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-l-2 ${
                    isSelected
                      ? 'bg-indigo-50 border-indigo-500'
                      : 'border-transparent hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.color} border`}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium leading-tight truncate ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>
                      {event.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {new Date(event.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · {event.location}
                    </p>
                    {inviteCount > 0 && (
                      <p className="text-xs text-indigo-500 mt-0.5 font-medium">{inviteCount} invité{inviteCount !== 1 ? 's' : ''}</p>
                    )}
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-1" />
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ══ MAIN ══════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Create event form ────────────────────────────────────────────── */}
        {showForm && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-base font-bold text-gray-900">Nouvel événement</h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700">Titre *</label>
                  <Input
                    placeholder="Ex : Petit-déjeuner Loi de Finances 2026"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    className={formErrors.title ? 'border-red-300' : ''}
                  />
                  {formErrors.title && <p className="text-xs text-red-500">{formErrors.title}</p>}
                </div>

                {/* Type + Date + Time */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-700">Type</label>
                    <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as EventType }))}>
                      <SelectTrigger size="sm" className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.entries(EVENT_TYPE_CONFIG) as [EventType, typeof EVENT_TYPE_CONFIG[EventType]][]).map(
                          ([val, cfg]) => <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-700">Date *</label>
                    <Input
                      type="date"
                      value={form.date}
                      onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                      className={`h-9 text-sm ${formErrors.date ? 'border-red-300' : ''}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-700">Heure</label>
                    <Input
                      type="time"
                      value={form.time}
                      onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                {/* Location */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700">Lieu *</label>
                  <Input
                    placeholder="Salle de conférence, lien Zoom…"
                    value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    className={formErrors.location ? 'border-red-300' : ''}
                  />
                  {formErrors.location && <p className="text-xs text-red-500">{formErrors.location}</p>}
                </div>

                {/* Target department */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700">
                    Département cible
                    <span className="ml-1 text-gray-400 font-normal">(filtre prospects, ex : 69)</span>
                  </label>
                  <Input
                    placeholder="69, 75, 13…"
                    value={form.targetDepartment}
                    onChange={e => setForm(f => ({ ...f, targetDepartment: e.target.value }))}
                    className="w-28"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700">Description / programme</label>
                  <Textarea
                    placeholder="Programme de la matinée, intervenants, thèmes abordés…"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className="min-h-[80px] text-sm resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={createEvent}
                    className="flex-1 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Créer l'événement
                  </button>
                  <button
                    onClick={() => { setShowForm(false); setFormErrors({}); }}
                    className="px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── No event selected placeholder ───────────────────────────────── */}
        {!showForm && !selectedEvent && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-sm">
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-indigo-400" />
              </div>
              <p className="text-base font-semibold text-gray-700">Aucun événement sélectionné</p>
              <p className="text-sm text-gray-400 mt-2">
                Créez un événement ou sélectionnez-en un dans la liste.
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4" /> Créer un événement
              </button>
            </div>
          </div>
        )}

        {/* ── Event detail ─────────────────────────────────────────────────── */}
        {!showForm && selectedEvent && (
          <>
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${EVENT_TYPE_CONFIG[selectedEvent.type].color}`}>
                    {EVENT_TYPE_CONFIG[selectedEvent.type].icon}
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-gray-900">{selectedEvent.title}</h1>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(selectedEvent.date).toLocaleDateString('fr-FR', {
                          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                        })} à {selectedEvent.time}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {selectedEvent.location}
                      </span>
                      {selectedEvent.targetDepartment && (
                        <span className="flex items-center gap-1 text-indigo-600">
                          <Filter className="w-3.5 h-3.5" />
                          Dept. {selectedEvent.targetDepartment}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setShowProspectPicker(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Send className="w-4 h-4" /> Inviter des prospects
                  </button>
                  <button
                    onClick={() => deleteEvent(selectedEvent.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Supprimer l'événement"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-100">
                {[
                  { label: 'Invités total',  value: stats.total,      color: 'text-gray-900', icon: <Users className="w-3.5 h-3.5 text-gray-400" /> },
                  { label: 'Inscrits',       value: stats.inscrit,    color: 'text-emerald-700', icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> },
                  { label: 'A participé',    value: stats.aParticipe, color: 'text-blue-700',    icon: <PartyPopper className="w-3.5 h-3.5 text-blue-500" /> },
                  { label: 'Absents',        value: stats.absent,     color: 'text-red-600',     icon: <XCircle className="w-3.5 h-3.5 text-red-400" /> },
                ].map(stat => (
                  <div key={stat.label} className="flex items-center gap-2">
                    {stat.icon}
                    <div>
                      <p className={`text-sm font-bold ${stat.color}`}>{stat.value}</p>
                      <p className="text-xs text-gray-400">{stat.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </header>

            {/* Description */}
            {selectedEvent.description && (
              <div className="bg-indigo-50 border-b border-indigo-100 px-6 py-3 flex-shrink-0">
                <p className="text-sm text-indigo-800">{selectedEvent.description}</p>
              </div>
            )}

            {/* RSVP filter + invitee table */}
            <div className="flex-1 overflow-auto">
              {/* RSVP filter tabs */}
              <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-2 sticky top-0 z-10">
                <span className="text-xs font-medium text-gray-500 mr-2">Filtrer :</span>
                {(['all', 'invite', 'inscrit', 'a-participe', 'absent'] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => setRsvpFilter(status)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      rsvpFilter === status
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {status === 'all' ? 'Tous' : RSVP_CONFIG[status].label}
                    {status !== 'all' && (
                      <span className="ml-1 opacity-70">
                        ({eventInvites.filter(i => i.rsvp === status).length})
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {filteredEventInvites.length === 0 ? (
                <div className="text-center py-16">
                  <Users className="w-8 h-8 mx-auto mb-3 text-gray-200" />
                  <p className="text-sm font-medium text-gray-500">
                    {eventInvites.length === 0 ? 'Aucun invité pour le moment' : 'Aucun résultat pour ce filtre'}
                  </p>
                  {eventInvites.length === 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      Cliquez sur "Inviter des prospects" pour envoyer des invitations.
                    </p>
                  )}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Société</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dirigeant</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ville</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Invité le</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut RSVP</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredEventInvites.map(invite => (
                      <tr key={invite.siren} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3">
                          <p className="font-medium text-gray-900">{invite.nomSociete}</p>
                          {invite.email && <p className="text-xs text-gray-400">{invite.email}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-700">{invite.dirigeant || '—'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-600">{invite.ville}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {new Date(invite.invitedAt).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={invite.rsvp}
                            onChange={e => updateRsvp(invite.siren, e.target.value as RsvpStatus)}
                            className={`rounded-full px-3 py-1 text-xs font-medium border-0 cursor-pointer outline-none ${RSVP_CONFIG[invite.rsvp].pill}`}
                          >
                            {(Object.entries(RSVP_CONFIG) as [RsvpStatus, typeof RSVP_CONFIG[RsvpStatus]][]).map(
                              ([val, cfg]) => <option key={val} value={val}>{cfg.label}</option>
                            )}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => removeInvite(invite.siren)}
                            className="p-1 text-gray-300 hover:text-red-400 transition-colors"
                            title="Retirer l'invité"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>

      {/* ══ PROSPECT PICKER MODAL ═════════════════════════════════════════════ */}
      {showProspectPicker && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-base font-bold text-gray-900">Inviter des prospects</h3>
                <p className="text-xs text-gray-400 mt-0.5">{selectedEvent.title}</p>
              </div>
              <button onClick={() => { setShowProspectPicker(false); setPickerSelected(new Set()); }} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0">
              <Input
                placeholder="Rechercher une société ou une ville…"
                value={pickerFilter}
                onChange={e => setPickerFilter(e.target.value)}
                className="h-9"
              />
              {filteredProspects.length > 0 && (
                <button
                  onClick={() => setPickerSelected(
                    pickerSelected.size === filteredProspects.length
                      ? new Set()
                      : new Set(filteredProspects.map(p => p.siren))
                  )}
                  className="mt-2 text-xs text-blue-600 hover:underline"
                >
                  {pickerSelected.size === filteredProspects.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
              )}
            </div>

            {/* Prospect list */}
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {filteredProspects.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">
                  {selectedEvent.targetDepartment
                    ? `Aucun prospect disponible dans le département ${selectedEvent.targetDepartment}`
                    : 'Tous les prospects sont déjà invités'}
                </p>
              ) : (
                filteredProspects.map(p => {
                  const checked = pickerSelected.has(p.siren);
                  return (
                    <label
                      key={p.siren}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg cursor-pointer transition-colors ${
                        checked ? 'bg-indigo-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => {
                          setPickerSelected(prev => {
                            const next = new Set(prev);
                            if (next.has(p.siren)) next.delete(p.siren); else next.add(p.siren);
                            return next;
                          });
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.nomSociete}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {p.dirigeantPrincipal ? `${p.dirigeantPrincipal.prenom} ${p.dirigeantPrincipal.nom} · ` : ''}{p.ville}
                        </p>
                      </div>
                      {!p.email && (
                        <span className="text-[10px] text-amber-500 flex-shrink-0">Pas d'email</span>
                      )}
                    </label>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
              <p className="text-xs text-gray-500">
                {pickerSelected.size} prospect{pickerSelected.size !== 1 ? 's' : ''} sélectionné{pickerSelected.size !== 1 ? 's' : ''}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowProspectPicker(false); setPickerSelected(new Set()); }}
                  className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={sendInvitations}
                  disabled={pickerSelected.size === 0 || sending}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {sending
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi…</>
                    : <><Send className="w-4 h-4" /> Envoyer les invitations</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
