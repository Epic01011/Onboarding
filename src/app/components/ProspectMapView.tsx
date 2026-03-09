/**
 * ProspectMapView — Vue Cartographique (Chantier 11)
 *
 * Carte Leaflet + OpenStreetMap avec :
 *  - Un marqueur coloré par score (rouge→vert) pour chaque prospect
 *  - Popup au clic : nom société, dirigeant, bouton "Ajouter à la campagne locale"
 *  - Centrage automatique sur la France métropolitaine
 */

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { Building2, User, Send } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// ─── Department → approximate center coordinates ──────────────────────────────

const DEPT_COORDS: Record<string, [number, number]> = {
  '01': [46.20, 5.23], '02': [49.57, 3.62], '03': [46.34, 3.30], '04': [44.09, 6.24],
  '05': [44.66, 6.35], '06': [43.70, 7.25], '07': [44.75, 4.48], '08': [49.77, 4.72],
  '09': [42.96, 1.60], '10': [48.32, 4.07], '11': [43.21, 2.35], '12': [44.35, 2.57],
  '13': [43.53, 5.45], '14': [49.07, -0.37], '15': [45.04, 2.55], '16': [45.65, 0.16],
  '17': [45.75, -0.64], '18': [47.08, 2.40], '19': [45.27, 1.77], '21': [47.32, 5.04],
  '22': [48.51, -2.76], '23': [46.10, 2.07], '24': [45.18, 0.72], '25': [47.24, 6.02],
  '26': [44.73, 5.01], '27': [49.08, 1.17], '28': [48.44, 1.49], '29': [48.23, -4.18],
  '2A': [41.57, 9.00], '2B': [42.38, 9.21], '30': [44.02, 4.23], '31': [43.60, 1.44],
  '32': [43.64, 0.59], '33': [44.84, -0.58], '34': [43.61, 3.88], '35': [48.12, -1.68],
  '36': [46.81, 1.69], '37': [47.39, 0.69], '38': [45.19, 5.72], '39': [46.67, 5.55],
  '40': [44.00, -0.65], '41': [47.59, 1.33], '42': [45.43, 4.39], '43': [45.04, 3.88],
  '44': [47.22, -1.55], '45': [47.90, 1.91], '46': [44.62, 1.67], '47': [44.35, 0.47],
  '48': [44.52, 3.50], '49': [47.47, -0.55], '50': [49.13, -1.23], '51': [49.04, 4.03],
  '52': [48.11, 5.14], '53': [48.07, -0.77], '54': [48.69, 6.18], '55': [49.16, 5.38],
  '56': [47.84, -2.83], '57': [49.12, 6.18], '58': [47.10, 3.50], '59': [50.63, 3.06],
  '60': [49.41, 2.83], '61': [48.43, 0.09], '62': [50.52, 2.13], '63': [45.76, 3.37],
  '64': [43.29, -0.37], '65': [43.23, 0.07], '66': [42.70, 2.89], '67': [48.57, 7.75],
  '68': [47.75, 7.34], '69': [45.76, 4.83], '70': [47.63, 6.16], '71': [46.79, 4.55],
  '72': [48.00, 0.20], '73': [45.57, 6.40], '74': [46.05, 6.41], '75': [48.86, 2.35],
  '76': [49.44, 1.09], '77': [48.61, 2.66], '78': [48.79, 1.99], '79': [46.56, -0.33],
  '80': [49.92, 2.30], '81': [43.93, 2.15], '82': [44.02, 1.35], '83': [43.46, 6.22],
  '84': [43.95, 5.08], '85': [46.67, -1.43], '86': [46.58, 0.34], '87': [45.84, 1.26],
  '88': [48.17, 6.45], '89': [47.80, 3.57], '90': [47.64, 6.86], '91': [48.63, 2.16],
  '92': [48.83, 2.25], '93': [48.91, 2.48], '94': [48.78, 2.46], '95': [49.05, 2.08],
  '971': [16.17, -61.53], '972': [14.64, -61.02], '973': [3.93, -53.13], '974': [-21.11, 55.53],
};

/** City name → [lat, lng] for well-known French cities used in demo data */
const CITY_COORDS: Record<string, [number, number]> = {
  LYON:        [45.7578, 4.8320],
  PARIS:       [48.8566, 2.3522],
  MARSEILLE:   [43.2965, 5.3698],
  BORDEAUX:    [44.8378, -0.5792],
  TOULOUSE:    [43.6047, 1.4442],
  NANTES:      [47.2184, -1.5536],
  STRASBOURG:  [48.5734, 7.7521],
  LILLE:       [50.6292, 3.0573],
  NICE:        [43.7102, 7.2620],
  RENNES:      [48.1173, -1.6778],
  GRENOBLE:    [45.1885, 5.7245],
  MONTPELLIER: [43.6108, 3.8767],
  DIJON:       [47.3220, 5.0415],
  NANCY:       [48.6921, 6.1844],
  CLERMONT:    [45.7772, 3.0870],
  REIMS:       [49.2583, 4.0317],
  TOURS:       [47.3941, 0.6848],
  ANGERS:      [47.4784, -0.5632],
  NIMES:       [43.8367, 4.3601],
  ROUEN:       [49.4432, 1.0993],
};

/** Maximum degrees of lat/lng offset to apply so multiple prospects in same dept don't stack */
const JITTER_DEGREES = 0.6;

function getCoords(codePostal: string, ville: string): [number, number] | null {
  const cityKey = ville.toUpperCase().split(' ')[0];
  if (cityKey && CITY_COORDS[cityKey]) return CITY_COORDS[cityKey];

  const dept = codePostal.startsWith('97')
    ? codePostal.slice(0, 3)
    : codePostal.slice(0, 2);
  if (dept && DEPT_COORDS[dept]) {
    // Jitter slightly so multiple prospects in same dept don't stack
    const base = DEPT_COORDS[dept];
    const jitter = (): number => (Math.random() - 0.5) * JITTER_DEGREES;
    return [base[0] + jitter(), base[1] + jitter()];
  }
  return null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MapProspect {
  siren: string;
  nomSociete: string;
  formeJuridique: string;
  secteur: string;
  ville: string;
  codePostal: string;
  dirigeantPrincipal: { nom: string; prenom: string } | null;
  email: string;
  leadScore: number;
}

interface ProspectMapViewProps {
  prospects: MapProspect[];
  onAddToCampaign: (siren: string) => void;
}

// ─── Auto-fit bounds ──────────────────────────────────────────────────────────

function AutoFitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 10);
    } else {
      map.fitBounds(positions.map(p => p as [number, number]), { padding: [50, 50], maxZoom: 10 });
    }
  }, [map, positions]);
  return null;
}

// ─── Score → circle color ─────────────────────────────────────────────────────

function scoreToColor(score: number): { color: string; fillColor: string } {
  if (score >= 70) return { color: '#059669', fillColor: '#10b981' }; // emerald
  if (score >= 40) return { color: '#d97706', fillColor: '#f59e0b' }; // amber
  return               { color: '#dc2626',    fillColor: '#f87171' }; // red
}

// ─── Map component ────────────────────────────────────────────────────────────

export function ProspectMapView({ prospects, onAddToCampaign }: ProspectMapViewProps) {
  const markers = useMemo(() => {
    return prospects.flatMap(p => {
      const coords = getCoords(p.codePostal, p.ville);
      if (!coords) return [];
      return [{ prospect: p, coords }];
    });
  }, [prospects]);

  const positions: [number, number][] = markers.map(m => m.coords);

  return (
    <div className="flex-1 overflow-hidden relative" style={{ minHeight: 0 }}>
      {/* Legend */}
      <div className="absolute top-3 right-3 z-[1000] bg-white rounded-xl shadow-lg border border-gray-200 px-4 py-3 text-xs space-y-1.5">
        <p className="font-semibold text-gray-700 mb-2">Score des leads</p>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0" />
          <span className="text-gray-600">Chaud (≥ 70 pts)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-400 flex-shrink-0" />
          <span className="text-gray-600">Tiède (40–69 pts)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-400 flex-shrink-0" />
          <span className="text-gray-600">Froid (&lt; 40 pts)</span>
        </div>
        <p className="text-gray-400 text-[10px] pt-1 border-t border-gray-100">
          {markers.length} / {prospects.length} géolocalisés
        </p>
      </div>

      <MapContainer
        center={[46.6034, 1.8883]}
        zoom={5}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {positions.length > 0 && <AutoFitBounds positions={positions} />}

        {markers.map(({ prospect, coords }) => {
          const colors = scoreToColor(prospect.leadScore);
          return (
            <CircleMarker
              key={prospect.siren}
              center={coords}
              radius={10 + Math.round(prospect.leadScore / 20)}
              pathOptions={{
                color: colors.color,
                fillColor: colors.fillColor,
                fillOpacity: 0.85,
                weight: 2,
              }}
            >
              <Popup minWidth={240} maxWidth={280}>
                <div className="p-1 space-y-2">
                  {/* Company */}
                  <div className="flex items-start gap-2">
                    <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900 text-sm leading-tight">
                        {prospect.nomSociete}
                      </p>
                      <p className="text-xs text-gray-500">
                        {prospect.formeJuridique} · {prospect.secteur}
                      </p>
                      <p className="text-xs text-gray-400">{prospect.ville}</p>
                    </div>
                  </div>

                  {/* Manager */}
                  {prospect.dirigeantPrincipal && (
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <p className="text-xs text-gray-700">
                        {prospect.dirigeantPrincipal.prenom} {prospect.dirigeantPrincipal.nom}
                      </p>
                    </div>
                  )}

                  {/* Score badge */}
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 rounded-full flex-1"
                      style={{
                        background: `linear-gradient(to right, ${colors.fillColor} ${prospect.leadScore}%, #e5e7eb ${prospect.leadScore}%)`,
                      }}
                    />
                    <span className="text-xs font-bold text-gray-700">{prospect.leadScore}/100</span>
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => onAddToCampaign(prospect.siren)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    <Send className="w-3 h-3" />
                    Ajouter à la campagne locale
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
