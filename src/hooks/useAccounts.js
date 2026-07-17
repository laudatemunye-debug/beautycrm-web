import { getSetting } from '../db/index';

const ACCOUNTS_KEY = 'beautycrm_accounts';
const ACTIVE_KEY = 'beautycrm_active_account';

export function getAccounts() {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY)) || []; }
  catch { return []; }
}

function saveAccounts(list) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
}

export function upsertAccount({ id, nom, email }) {
  const list = getAccounts();
  const idx = list.findIndex(a => a.id === id);
  const entry = { id, nom, email, lastLogin: Date.now() };
  if (idx >= 0) list[idx] = { ...list[idx], ...entry };
  else list.push(entry);
  saveAccounts(list);
}

export async function registerCurrentAccount(nom, email) {
  upsertAccount({ id: getActiveAccountId(), nom, email });
}

export function removeAccount(id) {
  saveAccounts(getAccounts().filter(a => a.id !== id));
  if (getActiveAccountId() === id) clearActiveAccountId();
}

export function setActiveAccountId(id) {
  if (id === null || id === undefined) localStorage.removeItem(ACTIVE_KEY);
  else localStorage.setItem(ACTIVE_KEY, id);
}

export function getActiveAccountId() {
  return localStorage.getItem(ACTIVE_KEY) || null;
}

export function clearActiveAccountId() {
  localStorage.removeItem(ACTIVE_KEY);
}

export function generateAccountId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Détecte le compte historique (base 'beautycrm' sans suffixe, déjà utilisée
// par tes utilisateurs actuels) et l'ajoute au registre s'il n'y est pas encore.
export async function ensureDefaultAccountRegistered() {
  if (getAccounts().some(a => a.id === null)) return;
  const prevActive = getActiveAccountId();
  clearActiveAccountId(); // force la lecture sur la base par défaut
  try {
    const nom = await getSetting('username');
    if (nom) {
      const email = await getSetting('email') || '';
      upsertAccount({ id: null, nom, email });
    }
  } finally {
    setActiveAccountId(prevActive);
  }
}
