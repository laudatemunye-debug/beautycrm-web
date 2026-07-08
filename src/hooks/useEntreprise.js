import { useState, useEffect } from 'react';
import { getSetting, setSetting, exportAllData, importAllData } from '../db/index';
import { DEVISES } from '../theme';

const IZI360_URL = 'https://izi360-backend.vercel.app/api/beautycrm/entreprise';
const IZI360_SECRET = 'beautycrm_izi360_2026';

export const useEntreprise = () => {
  const [mode, setMode] = useState(null); // 'admin' | 'employe' | null
  const [role, setRole] = useState(null); // 'admin' | 'vendeur' | 'gestionnaire'
  const [code, setCode] = useState(null);
  const [codeExpiry, setCodeExpiry] = useState(null);
  const [employes, setEmployes] = useState([]);
  const [adminEmail, setAdminEmail] = useState(null); // email de l'admin (cote employe) ou soi-meme (cote admin)
  const [loading, setLoading] = useState(true);
  const [driveConnecte, setDriveConnecte] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const [m, r, c, exp, adminEm] = await Promise.all([
      getSetting('entreprise_mode'),
      getSetting('entreprise_role'),
      getSetting('entreprise_code'),
      getSetting('entreprise_code_expiry'),
      getSetting('entreprise_admin_email'),
    ]);
    setMode(m || null);
    setRole(r || null);
    setCode(c || null);
    setCodeExpiry(exp ? parseInt(exp) : null);
    setAdminEmail(adminEm || null);
    setLoading(false);

    if (m === 'admin' && adminEm) {
      refreshEmployes(adminEm);
    }

    // Auto-sync au chargement si mode entreprise actif et connexion internet disponible
    if ((m === 'admin' || m === 'employe') && adminEm && navigator.onLine) {
      autoSync(adminEm);
    }
  };

  const autoSync = async (adminEm) => {
    try {
      const localData = await exportAllData();

      const downRes = await fetch(`${IZI360_URL}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: IZI360_SECRET, admin_email: adminEm, action: 'download' }),
      });
      if (!downRes.ok) return;
      const downData = await downRes.json();
      const remote = downData.data;
      const tables = ['clients','produits','ventes','prospects','rdvs','seminaires','participants','approvisionnements'];

      if (!remote) {
        await fetch(`${IZI360_URL}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: IZI360_SECRET, admin_email: adminEm, action: 'upload', payload: localData }),
        });
        return;
      }

      const merged = {};
      for (const table of tables) {
        const localItems = localData[table] || [];
        const remoteItems = remote[table] || [];
        const map = {};
        for (const item of remoteItems) map[item._id] = item;
        for (const item of localItems) {
          const existing = map[item._id];
          if (!existing) {
            map[item._id] = item;
          } else {
            const localTime = item.updated_at || item.created_at || '';
            const remoteTime = existing.updated_at || existing.created_at || '';
            if (localTime >= remoteTime) map[item._id] = item;
          }
        }
        merged[table] = Object.values(map);
      }
      merged.exported_at = new Date().toISOString();

      await importAllData(merged);
      await fetch(`${IZI360_URL}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: IZI360_SECRET, admin_email: adminEm, action: 'upload', payload: merged }),
      });
    } catch(_) {
      // Echec silencieux - l'utilisateur peut toujours synchroniser manuellement via le bouton
    }
  };

  const isCodeValid = () => code && codeExpiry && Date.now() < codeExpiry;

  const activerModeAdmin = async () => {
    const email = await getSetting('email');
    await setSetting('entreprise_mode', 'admin');
    await setSetting('entreprise_role', 'admin');
    await setSetting('entreprise_admin_email', email || '');
    setMode('admin');
    setRole('admin');
    setAdminEmail(email || null);
    const dev = await getSetting('devise');
    if (dev && email) {
      fetch(`${IZI360_URL}/set-devise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: IZI360_SECRET, admin_email: email, devise: dev }),
      }).catch(() => {});
    }
  };

  const changerDevise = async (deviseValue) => {
    if (!deviseValue) return;
    await setSetting('devise', deviseValue);
    const found = DEVISES.find(d => d.label === deviseValue || d.code === deviseValue);
    window.__DEVISE_SYMBOL__ = found?.symbol || 'FC';
    window.dispatchEvent(new Event('devise-changed'));
    const email = await getSetting('email');
    if (email && mode === 'admin') {
      fetch(`${IZI360_URL}/set-devise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: IZI360_SECRET, admin_email: email, devise: deviseValue }),
      }).catch(() => {});
    }
  };

  const forcerDeviseEmploye = async (deviseValue) => {
    if (!deviseValue) return;
    await setSetting('devise', deviseValue);
    const found = DEVISES.find(d => d.label === deviseValue || d.code === deviseValue);
    window.__DEVISE_SYMBOL__ = found?.symbol || 'FC';
    window.dispatchEvent(new Event('devise-changed'));
  };

  const pushFactureEntreprise = async (fact) => {
    const email = await getSetting('email');
    if (!email) return;
    try {
      await fetch(`${IZI360_URL}/set-facture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: IZI360_SECRET, admin_email: email, ...fact }),
      });
    } catch(_) {}
  };

  const forcerFactureEmploye = async (fact) => {
    if (!fact) return;
    await setSetting('facture_entreprise_nom', fact.nom || '');
    await setSetting('facture_entreprise_adresse', fact.adresse || '');
    await setSetting('facture_entreprise_telephone', fact.telephone || '');
    await setSetting('facture_entreprise_email', fact.email || '');
    await setSetting('facture_entreprise_logo', fact.logo || '');
    if (fact.nom) await setSetting('entreprise', fact.nom);
    window.dispatchEvent(new Event('entreprise-changed'));
  };

  const fermerEntreprise = async (motif) => {
    const email = adminEmail || await getSetting('email');
    if (!email) throw new Error('Email admin introuvable');
    await fetch(`${IZI360_URL}/fermer-entreprise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: IZI360_SECRET, admin_email: email, motif: motif || '' }),
    });
    await desactiverMode();
  };

  const desactiverMode = async () => {
    await setSetting('entreprise_mode', '');
    await setSetting('entreprise_role', '');
    await setSetting('entreprise_code', '');
    await setSetting('entreprise_code_expiry', '');
    await setSetting('entreprise_admin_email', '');
    setMode(null);
    setRole(null);
    setCode(null);
    setCodeExpiry(null);
    setAdminEmail(null);
    setEmployes([]);
  };

  // Ouvre la connexion Google Drive pour le mode entreprise (necessaire avant de generer un code)
  const connecterDriveEntreprise = async () => {
    const email = await getSetting('email');
    if (!email) throw new Error('Email non configure - impossible de connecter Drive');
    const url = `${IZI360_URL}/oauth-start?admin_email=${encodeURIComponent(email)}`;
    window.open(url, '_blank');

    return new Promise((resolve) => {
      const handler = (event) => {
        if (event.data && event.data.type === 'izi360_drive_connected') {
          window.removeEventListener('message', handler);
          setDriveConnecte(true);
          resolve(true);
        }
      };
      window.addEventListener('message', handler);
    });
  };

  const genererCode = async () => {
    const email = await getSetting('email');
    if (!email) throw new Error('Email admin introuvable');
    const telephoneEntreprise = await getSetting('facture_entreprise_telephone');

    const res = await fetch(`${IZI360_URL}/generate-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: IZI360_SECRET, admin_email: email, admin_whatsapp: telephoneEntreprise || '' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erreur lors de la generation du code');

    await setSetting('entreprise_code', data.code);
    await setSetting('entreprise_code_expiry', data.expiry.toString());
    setCode(data.code);
    setCodeExpiry(data.expiry);
    setDriveConnecte(true);
    return data.code;
  };

  const refreshEmployes = async (adminEm) => {
    const email = adminEm || adminEmail || await getSetting('email');
    if (!email) return;
    try {
      const res = await fetch(`${IZI360_URL}/employes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: IZI360_SECRET, admin_email: email }),
      });
      const data = await res.json();
      if (res.ok) setEmployes(data);
    } catch(_) {}
  };

  const revoquerEmploye = async (id, motif) => {
    const email = adminEmail || await getSetting('email');
    await fetch(`${IZI360_URL}/revoke-employe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: IZI360_SECRET, admin_email: email, employe_id: id, motif: motif || '' }),
    });
    await refreshEmployes(email);
  };

  const [employesRevoques, setEmployesRevoques] = useState([]);
  const refreshEmployesRevoques = async (adminEm) => {
    const email = adminEm || adminEmail || await getSetting('email');
    if (!email) return;
    try {
      const res = await fetch(`${IZI360_URL}/employes-revoques`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: IZI360_SECRET, admin_email: email }),
      });
      const data = await res.json();
      if (res.ok) setEmployesRevoques(data);
    } catch(_) {}
  };

  const [employesVoles, setEmployesVoles] = useState([]);
  const refreshEmployesVoles = async (adminEm) => {
    const email = adminEm || adminEmail || await getSetting('email');
    if (!email) return;
    try {
      const res = await fetch(`${IZI360_URL}/employes-voles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: IZI360_SECRET, admin_email: email }),
      });
      const data = await res.json();
      if (res.ok) setEmployesVoles(data);
    } catch(_) {}
  };

  // codeSaisi = les 6 chiffres tels que transmis par l'admin (plus besoin de fileId, izi360 gere tout)
  const rejoindreEntreprise = async (codeSaisi, nomEmploye, posteChoisi) => {
    const res = await fetch(`${IZI360_URL}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: IZI360_SECRET, code: codeSaisi, nom: nomEmploye, poste: posteChoisi }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erreur lors de la connexion');

    await setSetting('entreprise_mode', 'employe');
    await setSetting('entreprise_role', posteChoisi);
    await setSetting('entreprise_admin_email', data.admin_email);
    await setSetting('entreprise_employe_id', String(data.employe_id));
    await setSetting('entreprise_admin_whatsapp', data.admin_whatsapp || '');
    setMode('employe');
    setRole(posteChoisi);
    setAdminEmail(data.admin_email);
    if (data.devise) await forcerDeviseEmploye(data.devise);
    if (data.facture) await forcerFactureEmploye(data.facture);
    try {
      await syncEntreprise();
    } catch (_) {
      // Echec silencieux - l'employe pourra synchroniser manuellement via le bouton Sync
    }
  };

  // Verifie aupres du serveur si l'employe courant a ete revoque
  const checkEmployeStatus = async () => {
    const mEmploye = await getSetting('entreprise_mode');
    if (mEmploye !== 'employe') return { revoked: false };
    const employeId = await getSetting('entreprise_employe_id');
    const adminEm = await getSetting('entreprise_admin_email');
    if (!employeId || !adminEm) return { revoked: false };
    try {
      const res = await fetch(`${IZI360_URL}/check-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: IZI360_SECRET, admin_email: adminEm, employe_id: employeId }),
      });
      const data = await res.json();
      if (!res.ok) return { revoked: false };
      if (data.admin_whatsapp) await setSetting('entreprise_admin_whatsapp', data.admin_whatsapp);
      if (data.devise) await forcerDeviseEmploye(data.devise);
      if (data.devise) await forcerDeviseEmploye(data.devise);
      if (data.facture) await forcerFactureEmploye(data.facture);
      return { revoked: !!data.revoked, entreprise_fermee: !!data.entreprise_fermee, admin_whatsapp: data.admin_whatsapp || '', motif: data.motif || '', vole: !!data.vole, vole_expiry: data.vole_expiry || null };
    } catch(_) {
      return { revoked: false };
    }
  };

  // Admin : marque un employe comme "vole/perdu" -> genere un code de deverrouillage a transmettre manuellement
  const marquerEmployeVole = async (employeId) => {
    const email = await getSetting('email');
    if (!email) throw new Error('Email admin introuvable');
    const res = await fetch(`${IZI360_URL}/marquer-vole`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: IZI360_SECRET, admin_email: email, employe_id: employeId }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Erreur lors du marquage');
    return { code: data.code, expiry: data.expiry };
  };

  // Employe : verifie le code transmis par l'admin pour deverrouiller son acces
  const verifierCodeVole = async (code) => {
    const employeId = await getSetting('entreprise_employe_id');
    const adminEm = await getSetting('entreprise_admin_email');
    if (!employeId || !adminEm) throw new Error('Contexte employe introuvable');
    const res = await fetch(`${IZI360_URL}/verifier-vole`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: IZI360_SECRET, admin_email: adminEm, employe_id: employeId, code }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Code incorrect');
    return true;
  };

  // Verifie si l'entreprise (admin OU employe) a ete suspendue par le support izi360
  const checkSuspension = async () => {
    const m = await getSetting('entreprise_mode');
    if (m !== 'admin' && m !== 'employe') return { blocked: false };
    const adminEm = m === 'admin' ? (await getSetting('email')) : (await getSetting('entreprise_admin_email'));
    if (!adminEm) return { blocked: false };
    try {
      const res = await fetch(`${IZI360_URL}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: IZI360_SECRET, admin_email: adminEm, role: m }),
      });
      const data = await res.json();
      if (!res.ok) return { blocked: false };
      if (data.devise) await forcerDeviseEmploye(data.devise);
      if (data.facture) await forcerFactureEmploye(data.facture);
      return data;
    } catch(_) {
      return { blocked: false };
    }
  };

  // Purge definitive (Drive + revocation) suite a une suppression par le support izi360.
  // A appeler uniquement quand l'utilisateur confirme (clic "Fermer" sur l'ecran "entreprise supprimee").
  const purgerEntrepriseSupprimee = async () => {
    const m = await getSetting('entreprise_mode');
    const adminEm = m === 'admin' ? (await getSetting('email')) : (await getSetting('entreprise_admin_email'));
    if (!adminEm) return;
    try {
      await fetch(IZI360_URL + '/purge-supprimee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: IZI360_SECRET, admin_email: adminEm }),
      });
    } catch(_) {
      // Meme si l'appel reseau echoue, on purge quand meme le local (voir App.jsx)
    }
  };

  // Synchronise les donnees partagees de l'entreprise via le proxy izi360 (fusion bidirectionnelle)
  const syncEntreprise = async () => {
    const email = adminEmail || await getSetting('entreprise_admin_email');
    if (!email) throw new Error('Aucune entreprise configuree');

    const localData = await exportAllData();

    // 1. Telecharger les donnees partagees actuelles
    const downRes = await fetch(`${IZI360_URL}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: IZI360_SECRET, admin_email: email, action: 'download' }),
    });
    const downData = await downRes.json();
    if (!downRes.ok) throw new Error(downData.message || 'Erreur telechargement sync');

    const remote = downData.data;
    const tables = ['clients','produits','ventes','prospects','rdvs','seminaires','participants','approvisionnements'];

    if (!remote) {
      // Rien sur le serveur - upload direct des donnees locales
      const upRes = await fetch(`${IZI360_URL}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: IZI360_SECRET, admin_email: email, action: 'upload', payload: localData }),
      });
      if (!upRes.ok) throw new Error('Erreur upload initial');
      await setSetting('entreprise_last_sync', new Date().toISOString());
      return true;
    }

    // 2. Fusion: pour chaque table, garder l'enregistrement le plus recent
    const merged = {};
    for (const table of tables) {
      const localItems = localData[table] || [];
      const remoteItems = remote[table] || [];
      const map = {};
      for (const item of remoteItems) map[item._id] = item;
      for (const item of localItems) {
        const existing = map[item._id];
        if (!existing) {
          map[item._id] = item;
        } else {
          const localTime = item.updated_at || item.created_at || '';
          const remoteTime = existing.updated_at || existing.created_at || '';
          if (localTime >= remoteTime) map[item._id] = item;
        }
      }
      merged[table] = Object.values(map);
    }
    merged.exported_at = new Date().toISOString();

    // 3. Sauvegarder localement
    await importAllData(merged);

    // 4. Renvoyer la version fusionnee au serveur
    const upRes2 = await fetch(`${IZI360_URL}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: IZI360_SECRET, admin_email: email, action: 'upload', payload: merged }),
    });
    if (!upRes2.ok) throw new Error('Erreur upload fusion');

    await setSetting('entreprise_last_sync', new Date().toISOString());
    return true;
  };

  // Permissions selon le role
  const permissions = {
    canAddClient:   ['admin', 'vendeur', 'gestionnaire'].includes(role),
    canDeleteClient:['admin'].includes(role),
    canAddVente:    ['admin', 'vendeur', 'gestionnaire'].includes(role),
    canDeleteVente: ['admin'].includes(role),
    canViewAllVentes: ['admin', 'gestionnaire'].includes(role),
    canViewRapports:  ['admin', 'gestionnaire'].includes(role),
    canManageProducts:['admin', 'gestionnaire'].includes(role),
    canAccessParams:  ['admin'].includes(role),
  };

  const checkPendingSync = async () => {
    try {
      const lastSync = await getSetting('entreprise_last_sync');
      if (!lastSync) return true;
      const localData = await exportAllData();
      const tables = ['clients','produits','ventes','prospects','rdvs','seminaires','participants','approvisionnements'];
      for (const table of tables) {
        const items = localData[table] || [];
        for (const item of items) {
          const t = item.updated_at || item.created_at || '';
          if (t && t > lastSync) return true;
        }
      }
      return false;
    } catch(_) {
      return true;
    }
  };

  return {
    mode, role, code, codeExpiry, employes, employesRevoques, employesVoles, adminEmail, loading,
    isCodeValid, activerModeAdmin, desactiverMode, connecterDriveEntreprise,
    genererCode, refreshEmployes, refreshEmployesRevoques, refreshEmployesVoles, revoquerEmploye, rejoindreEntreprise, syncEntreprise, checkEmployeStatus, fermerEntreprise, checkSuspension,
    marquerEmployeVole, verifierCodeVole, purgerEntrepriseSupprimee,
    permissions,
    isAdmin: role === 'admin',
    isEmploye: mode === 'employe',
    forcerDeviseEmploye,
    changerDevise,
    checkPendingSync,
    pushFactureEntreprise,
  };
};
