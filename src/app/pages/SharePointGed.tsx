/**
 * SharePointGed — GED Moderne (Module 7)
 *
 * Fonctionnalités :
 * - Layout Split Pane : sidebar clients (gauche) + arborescence fichiers (droite)
 * - Drag & Drop pour upload multiple dans le panneau de droite
 * - Barre de recherche Full-Text filtrant les documents en temps réel
 * - Génération automatique des sous-dossiers standards lors de la création d'un client
 */

import { useState, useCallback, useRef, useMemo, useEffect, DragEvent } from 'react';
import {
  FolderOpen,
  Folder,
  FileText,
  Upload,
  Search,
  Plus,
  ChevronRight,
  ChevronDown,
  X,
  CheckCircle,
  AlertCircle,
  Users,
  FolderPlus,
  ArrowLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Longueur maximale d'un numéro SIREN (9 chiffres) */
const SIREN_MAX_LENGTH = 9;

/** Intervalle en ms entre deux incréments de progression d'upload simulé */
const UPLOAD_PROGRESS_INTERVAL_MS = 200;

/** Incrément maximum aléatoire de progression d'upload simulé (%) */
const UPLOAD_MAX_PROGRESS_INCREMENT = 30;

/** Incrément minimum de progression d'upload simulé (%) */
const UPLOAD_MIN_PROGRESS_INCREMENT = 10;

/** Sous-dossiers standards générés automatiquement pour chaque nouveau client */
export const STANDARD_SUBFOLDERS = [
  { id: '01-compta',   name: '01-Compta',   icon: '📊', description: 'Bilans, comptes annuels, grand livre' },
  { id: '02-fiscal',   name: '02-Fiscal',   icon: '🧾', description: 'Déclarations IS, TVA, liasses fiscales' },
  { id: '03-social',   name: '03-Social',   icon: '👥', description: 'Bulletins de paie, contrats, DSN' },
  { id: '04-juridique', name: '04-Juridique', icon: '⚖️', description: 'Statuts, KBIS, pièces d\'identité' },
] as const;

interface GedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  status: 'uploading' | 'done' | 'error';
  progress: number;
}

interface GedFolder {
  id: string;
  name: string;
  icon: string;
  description: string;
  files: GedFile[];
  isOpen: boolean;
}

interface GedClient {
  id: string;
  name: string;
  siren: string;
  folders: GedFolder[];
  createdAt: string;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Génère automatiquement les sous-dossiers standards pour un nouveau client.
 */
export function generateStandardFolders(): GedFolder[] {
  return STANDARD_SUBFOLDERS.map(sub => ({
    id: sub.id,
    name: sub.name,
    icon: sub.icon,
    description: sub.description,
    files: [],
    isOpen: false,
  }));
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function buildInitialClients(): GedClient[] {
  return [
    {
      id: 'demo-1',
      name: 'Dupont & Associés',
      siren: '123456789',
      createdAt: new Date().toISOString(),
      folders: generateStandardFolders().map((f, i) =>
        i === 0
          ? {
              ...f,
              isOpen: true,
              files: [
                {
                  id: 'f1',
                  name: 'Bilan_2023.pdf',
                  size: 204800,
                  type: 'application/pdf',
                  uploadedAt: new Date().toISOString(),
                  status: 'done',
                  progress: 100,
                },
                {
                  id: 'f2',
                  name: 'Grand_livre_2023.xlsx',
                  size: 512000,
                  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                  uploadedAt: new Date().toISOString(),
                  status: 'done',
                  progress: 100,
                },
              ],
            }
          : f,
      ),
    },
    {
      id: 'demo-2',
      name: 'Martin SAS',
      siren: '987654321',
      createdAt: new Date().toISOString(),
      folders: generateStandardFolders(),
    },
  ];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FileIcon({ type }: { type: string }) {
  if (type.includes('pdf')) return <FileText className="w-4 h-4 text-red-500" />;
  if (type.includes('sheet') || type.includes('excel') || type.includes('csv'))
    return <FileText className="w-4 h-4 text-green-600" />;
  if (type.includes('word') || type.includes('document'))
    return <FileText className="w-4 h-4 text-blue-600" />;
  return <FileText className="w-4 h-4 text-gray-500" />;
}

interface FolderItemProps {
  folder: GedFolder;
  searchQuery: string;
  onToggle: (folderId: string) => void;
  onFileDrop: (folderId: string, files: File[]) => void;
  onFileRemove: (folderId: string, fileId: string) => void;
}

function FolderItem({ folder, searchQuery, onToggle, onFileDrop, onFileRemove }: FolderItemProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return folder.files;
    const q = searchQuery.toLowerCase().trim();
    return folder.files.filter(f => f.name.toLowerCase().includes(q));
  }, [folder.files, searchQuery]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) {
        onFileDrop(folder.id, droppedFiles);
      }
    },
    [folder.id, onFileDrop],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files ?? []);
      if (selectedFiles.length > 0) {
        onFileDrop(folder.id, selectedFiles);
      }
      e.target.value = '';
    },
    [folder.id, onFileDrop],
  );

  const isVisible =
    !searchQuery.trim() ||
    filteredFiles.length > 0 ||
    folder.name.toLowerCase().includes(searchQuery.toLowerCase());

  if (!isVisible) return null;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Folder header */}
      <button
        onClick={() => onToggle(folder.id)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        {folder.isOpen
          ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
        <span className="text-base">{folder.icon}</span>
        <span className="font-medium text-sm text-gray-800 flex-1">{folder.name}</span>
        <span className="text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded-full">
          {folder.files.length}
        </span>
      </button>

      {/* Folder content */}
      {folder.isOpen && (
        <div className="p-3 space-y-2">
          {/* Drag & Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative border-2 border-dashed rounded-lg px-4 py-5 text-center cursor-pointer transition-all
              ${isDragOver
                ? 'border-blue-400 bg-blue-50 scale-[1.01]'
                : 'border-gray-300 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/50'}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="sr-only"
              onChange={handleFileInput}
            />
            <Upload className={`w-6 h-6 mx-auto mb-1.5 ${isDragOver ? 'text-blue-500' : 'text-gray-400'}`} />
            <p className={`text-sm font-medium ${isDragOver ? 'text-blue-600' : 'text-gray-500'}`}>
              {isDragOver ? 'Déposez ici' : 'Glissez-déposez ou cliquez pour ajouter des fichiers'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">PDF, Word, Excel — multiple fichiers acceptés</p>
          </div>

          {/* File list */}
          {filteredFiles.length > 0 && (
            <ul className="space-y-1 mt-2">
              {filteredFiles.map(file => (
                <li
                  key={file.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all group"
                >
                  <FileIcon type={file.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                    <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                  </div>
                  {file.status === 'uploading' && (
                    <div className="w-16">
                      <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {file.status === 'done' && (
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  )}
                  {file.status === 'error' && (
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  )}
                  <button
                    onClick={() => onFileRemove(folder.id, file.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-50"
                    aria-label="Supprimer"
                  >
                    <X className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {filteredFiles.length === 0 && searchQuery.trim() && (
            <p className="text-center text-sm text-gray-400 py-3">
              Aucun fichier correspondant à « {searchQuery} »
            </p>
          )}

          {filteredFiles.length === 0 && !searchQuery.trim() && (
            <p className="text-center text-xs text-gray-400 py-2">
              Aucun fichier — glissez-déposez pour commencer
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SharePointGed() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<GedClient[]>(buildInitialClients);
  const [selectedClientId, setSelectedClientId] = useState<string>(clients[0]?.id ?? '');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientSiren, setNewClientSiren] = useState('');

  // ── Filtered clients for the sidebar search ──────────────────────────────
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.siren.includes(q) ||
        c.folders.some(
          f =>
            f.name.toLowerCase().includes(q) ||
            f.files.some(file => file.name.toLowerCase().includes(q)),
        ),
    );
  }, [clients, searchQuery]);

  const selectedClient = useMemo(
    () => clients.find(c => c.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );

  // ── Auto-select first client when filtered list changes ───────────────────
  useEffect(() => {
    if (filteredClients.length > 0 && !filteredClients.find(c => c.id === selectedClientId)) {
      setSelectedClientId(filteredClients[0].id);
    }
  }, [filteredClients, selectedClientId]);

  // ── Folder toggle ─────────────────────────────────────────────────────────
  const handleFolderToggle = useCallback((folderId: string) => {
    setClients(prev =>
      prev.map(c =>
        c.id === selectedClientId
          ? {
              ...c,
              folders: c.folders.map(f =>
                f.id === folderId ? { ...f, isOpen: !f.isOpen } : f,
              ),
            }
          : c,
      ),
    );
  }, [selectedClientId]);

  // ── File drop handler (simulates upload with fake progress) ───────────────
  const handleFileDrop = useCallback((folderId: string, files: File[]) => {
    const newFiles: GedFile[] = files.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      uploadedAt: new Date().toISOString(),
      status: 'uploading',
      progress: 0,
    }));

    // Add files immediately with "uploading" status
    setClients(prev =>
      prev.map(c =>
        c.id === selectedClientId
          ? {
              ...c,
              folders: c.folders.map(f =>
                f.id === folderId
                  ? { ...f, isOpen: true, files: [...f.files, ...newFiles] }
                  : f,
              ),
            }
          : c,
      ),
    );

    // Simulate upload progress then mark as done
    newFiles.forEach(newFile => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * UPLOAD_MAX_PROGRESS_INCREMENT + UPLOAD_MIN_PROGRESS_INCREMENT;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setClients(prev =>
            prev.map(c =>
              c.id === selectedClientId
                ? {
                    ...c,
                    folders: c.folders.map(f =>
                      f.id === folderId
                        ? {
                            ...f,
                            files: f.files.map(fi =>
                              fi.id === newFile.id
                                ? { ...fi, status: 'done', progress: 100 }
                                : fi,
                            ),
                          }
                        : f,
                    ),
                  }
                : c,
            ),
          );
        } else {
          setClients(prev =>
            prev.map(c =>
              c.id === selectedClientId
                ? {
                    ...c,
                    folders: c.folders.map(f =>
                      f.id === folderId
                        ? {
                            ...f,
                            files: f.files.map(fi =>
                              fi.id === newFile.id ? { ...fi, progress } : fi,
                            ),
                          }
                        : f,
                    ),
                  }
                : c,
            ),
          );
        }
      }, UPLOAD_PROGRESS_INTERVAL_MS);
    });
  }, [selectedClientId]);

  // ── File remove ───────────────────────────────────────────────────────────
  const handleFileRemove = useCallback((folderId: string, fileId: string) => {
    setClients(prev =>
      prev.map(c =>
        c.id === selectedClientId
          ? {
              ...c,
              folders: c.folders.map(f =>
                f.id === folderId
                  ? { ...f, files: f.files.filter(fi => fi.id !== fileId) }
                  : f,
              ),
            }
          : c,
      ),
    );
  }, [selectedClientId]);

  // ── Create new client with standard folders ───────────────────────────────
  const handleCreateClient = useCallback(() => {
    if (!newClientName.trim()) return;
    const newClient: GedClient = {
      id: `client-${Date.now()}`,
      name: newClientName.trim(),
      siren: newClientSiren.trim(),
      createdAt: new Date().toISOString(),
      folders: generateStandardFolders(),
    };
    setClients(prev => [...prev, newClient]);
    setSelectedClientId(newClient.id);
    setNewClientName('');
    setNewClientSiren('');
    setShowNewClientModal(false);
    setSearchQuery('');
  }, [newClientName, newClientSiren]);

  // ── Total file count for selected client ──────────────────────────────────
  const totalFiles = selectedClient
    ? selectedClient.folders.reduce((acc, f) => acc + f.files.length, 0)
    : 0;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 flex-shrink-0">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Tableau de bord
        </button>
        <div className="h-4 w-px bg-gray-300" />
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <FolderOpen className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900 leading-tight">
              GED — Gestion Électronique des Documents
            </h1>
            <p className="text-xs text-gray-500">
              {clients.length} client{clients.length > 1 ? 's' : ''} · {clients.reduce((a, c) => a + c.folders.reduce((b, f) => b + f.files.length, 0), 0)} fichiers
            </p>
          </div>
        </div>

        {/* Full-text search */}
        <div className="ml-auto flex items-center gap-3">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Rechercher un client, dossier, fichier…"
              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
              >
                <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Split Pane ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — Client list */}
        <aside className="w-72 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Clients</span>
              <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                {filteredClients.length}
              </span>
            </div>
            <button
              onClick={() => setShowNewClientModal(true)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors px-2 py-1 rounded-lg hover:bg-blue-50"
            >
              <Plus className="w-3.5 h-3.5" />
              Nouveau
            </button>
          </div>

          <ul className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
            {filteredClients.length === 0 ? (
              <li className="py-8 text-center text-sm text-gray-400">
                {searchQuery ? `Aucun résultat pour « ${searchQuery} »` : 'Aucun client'}
              </li>
            ) : (
              filteredClients.map(client => {
                const fileCount = client.folders.reduce((a, f) => a + f.files.length, 0);
                const isSelected = client.id === selectedClientId;
                return (
                  <li key={client.id}>
                    <button
                      onClick={() => setSelectedClientId(client.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg transition-all group ${
                        isSelected
                          ? 'bg-blue-50 border border-blue-200 shadow-sm'
                          : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'bg-blue-100' : 'bg-gray-100 group-hover:bg-gray-200'
                        }`}>
                          <Folder className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${isSelected ? 'text-blue-800' : 'text-gray-800'}`}>
                            {client.name}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {client.siren ? `SIREN: ${client.siren}` : 'SIREN non renseigné'}
                          </p>
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                          isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {fileCount}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        {/* Right panel — File tree */}
        <main className="flex-1 overflow-y-auto">
          {selectedClient ? (
            <div className="p-6 max-w-4xl">
              {/* Client header */}
              <div className="mb-5">
                <div className="flex items-center gap-3 mb-1">
                  <FolderOpen className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-gray-900">{selectedClient.name}</h2>
                  {selectedClient.siren && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      SIREN {selectedClient.siren}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 ml-8">
                  {totalFiles} fichier{totalFiles > 1 ? 's' : ''} réparti{totalFiles > 1 ? 's' : ''} dans{' '}
                  {selectedClient.folders.length} dossier{selectedClient.folders.length > 1 ? 's' : ''}
                </p>
              </div>

              {/* Standard subfolders hint */}
              {totalFiles === 0 && (
                <div className="mb-5 p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                  <FolderPlus className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">Structure standard générée automatiquement</p>
                    <p className="text-xs text-blue-600 mt-0.5">
                      Les dossiers 01-Compta, 02-Fiscal, 03-Social et 04-Juridique ont été créés. Glissez-déposez vos fichiers dans chaque dossier.
                    </p>
                  </div>
                </div>
              )}

              {/* Folder list with drag & drop */}
              <div className="space-y-2">
                {selectedClient.folders.map(folder => (
                  <FolderItem
                    key={folder.id}
                    folder={folder}
                    searchQuery={searchQuery}
                    onToggle={handleFolderToggle}
                    onFileDrop={handleFileDrop}
                    onFileRemove={handleFileRemove}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <FolderOpen className="w-16 h-16 text-gray-200 mb-4" />
              <p className="text-gray-500 font-medium">Sélectionnez un client</p>
              <p className="text-sm text-gray-400 mt-1">Choisissez un client dans la liste pour afficher ses dossiers.</p>
            </div>
          )}
        </main>
      </div>

      {/* ── New Client Modal ─────────────────────────────────────────────── */}
      {showNewClientModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowNewClientModal(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Nouveau client</h2>
              </div>
              <button
                onClick={() => setShowNewClientModal(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du client <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateClient(); }}
                  placeholder="Ex : Dupont & Associés"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SIREN
                </label>
                <input
                  type="text"
                  value={newClientSiren}
                  onChange={e => setNewClientSiren(e.target.value.replace(/\D/g, '').slice(0, SIREN_MAX_LENGTH))}
                  placeholder="9 chiffres"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Preview of auto-generated folders */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-600 mb-2">Dossiers créés automatiquement :</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {STANDARD_SUBFOLDERS.map(sub => (
                    <div key={sub.id} className="flex items-center gap-1.5 text-xs text-gray-600">
                      <span>{sub.icon}</span>
                      <span>{sub.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowNewClientModal(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateClient}
                disabled={!newClientName.trim()}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <FolderPlus className="w-4 h-4" />
                Créer le client
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}