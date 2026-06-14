export const C = {
  sidebar_bg:    '#1A1F36',
  accent:        '#3D5AFE',
  accent2:       '#5C6BC0',
  success:       '#26A69A',
  warning:       '#FFA726',
  danger:        '#EF5350',
  pink:          '#D4537E',
  page_bg:       '#F5F6FA',
  card_bg:       '#FFFFFF',
  card_border:   '#E8EAF0',
  text_primary:  '#1A1F36',
  text_secondary:'#6B7280',
  text_light:    '#9CA3AF',
  input_bg:      '#F9FAFB',
  input_border:  '#D1D5DB',
  tag_whatsapp:  '#25D366',
  tag_prospect:  '#7C3AED',
  tag_fb:        '#1877F2',
  tag_bouche:    '#D97706',
  tag_web:       '#0EA5E9',
  tag_event:     '#8B5CF6',
  table_header:  '#F8F9FF',
};
export const CANAL_COLORS = {
  'Facebook / Instagram': '#1877F2',
  'Prospection directe':  '#7C3AED',
  'Bouche à oreille':     '#D97706',
  'WhatsApp / Telegram':  '#25D366',
  'Site web partenaire':  '#0EA5E9',
  'Autre':                '#6B7280',
};
export const CANAUX = Object.keys(CANAL_COLORS);
export const METHODES = ['Cash', 'Mobile Money', 'Virement', 'Credit', 'Autre'];
export const STATUTS_RDV = ['planifie', 'confirme', 'effectue', 'annule'];
export const TYPES_EVENT = ['Seminaire', 'Formation', 'Atelier', 'Webinar', 'Reunion', 'Lancement produit', 'Autre'];
export const STATUTS_EVENT = ['planifie', 'en_cours', 'termine', 'annule'];
export const STATUTS_PRESENCE = ['inscrit', 'confirme', 'present', 'absent'];
export const SECURITY_QUESTIONS = [
  'Quel est le prenom de votre mere ?',
  'Quel est le nom de votre premier animal ?',
  'Dans quelle ville etes-vous ne(e) ?',
  'Quel est le prenom de votre meilleur(e) ami(e) ?',
  'Quel est le nom de votre ecole primaire ?',
];

export const DEVISES = [
  { code: 'CDF', symbol: 'FC', label: 'Franc Congolais (FC)' },
  { code: 'USD', symbol: '$', label: 'Dollar américain ($)' },
  { code: 'EUR', symbol: '€', label: 'Euro (€)' },
  { code: 'XAF', symbol: 'FCFA', label: 'Franc CFA (FCFA)' },
  { code: 'GHS', symbol: 'GH₵', label: 'Cedi ghanéen (GH₵)' },
  { code: 'NGN', symbol: '₦', label: 'Naira nigérian (₦)' },
  { code: 'KES', symbol: 'KSh', label: 'Shilling kenyan (KSh)' },
  { code: 'ZAR', symbol: 'R', label: 'Rand sud-africain (R)' },
  { code: 'MAD', symbol: 'DH', label: 'Dirham marocain (DH)' },
  { code: 'RWF', symbol: 'RF', label: 'Franc rwandais (RF)' },
];
