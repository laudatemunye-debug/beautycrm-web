import { useState, useEffect, useRef } from 'react';
import { setSetting, getSetting, importAllData } from '../db/index';
import { encryptPayload, decryptPayload } from '../utils/crypto';

const FILE_NAME = 'beautycrm-backup.json';
const FILE_NAME_SHARED = 'beautycrm-shared.json';
const DRIVE_API_KEY = 'AIzaSyDDzkNUvKpN987_Q90hSvhuMoeYpjwU1OQ';
const IZI360_URL = 'https://izi360-backend.vercel.app/api/beautycrm/entreprise';
const IZI360_SECRET = 'beautycrm_izi360_2026';

// Nouveau flux : le refresh_token vit cote serveur (table beautycrm_users_drive).
// Le client ne garde qu'un access_token de courte duree en cache memoire, renouvele
// automatiquement via le serveur sans jamais redemander de connexion a l'utilisateur.
let _accessToken = null;
let _tokenExpiry = 0;
let _pendingTokenFetch = null;

export const useGoogle = () => {
  const [googleUser, setGoogleUser] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [authReady, setAuthReady] = useState(true);
  const [error, setError] = useState('');
  const userRef = useRef(null);

  useEffect(() => {
    getSetting('google_user').then(raw => {
      if (raw) try { const u = JSON.parse(raw); setGoogleUser(u); userRef.current = u; } catch(_) {}
    });

    const handler = (event) => {
      if (event.data && event.data.type === 'izi360_personal_drive_connected') {
        const user = { email: event.data.email, name: event.data.name || event.data.email, picture: event.data.picture || null };
        setGoogleUser(user);
        userRef.current = user;
        setSetting('google_user', JSON.stringify(user));
        setError('');
        _accessToken = null; _tokenExpiry = 0;
        fetchServerToken(user.email).catch(() => {});
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const fetchServerToken = async (email) => {
    if (_pendingTokenFetch) return _pendingTokenFetch;
    _pendingTokenFetch = (async () => {
      try {
        const res = await fetch(`${IZI360_URL}/drive-token-personal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: IZI360_SECRET, email }),
        });
        const data = await res.json();
        if (!res.ok || !data.access_token) throw new Error(data.message || 'Token indisponible');
        _accessToken = data.access_token;
        _tokenExpiry = Date.now() + 50 * 60 * 1000;
        return true;
      } catch (e) {
        _accessToken = null; _tokenExpiry = 0;
        throw e;
      } finally {
        _pendingTokenFetch = null;
      }
    })();
    return _pendingTokenFetch;
  };

  const ensureToken = async () => {
    if (_accessToken && Date.now() < _tokenExpiry) return true;
    const email = userRef.current?.email;
    if (!email) throw new Error('SESSION_EXPIRED');
    await fetchServerToken(email);
    return true;
  };

  const connect = () => {
    setError('');
    const popup = window.open(`${IZI360_URL}/oauth-start-personal`, '_blank');
    if (!popup) { setError('Fenetre bloquee, autorisez les popups et reessayez.'); return; }
  };

  const disconnect = async () => {
    _accessToken = null;
    _tokenExpiry = 0;
    setGoogleUser(null);
    userRef.current = null;
    setError('');
    await setSetting('google_user', '');
  };

  const authFetch = async (url, opts = {}) => {
    try {
      await ensureToken();
    } catch (_) {
      throw new Error('SESSION_EXPIRED');
    }
    return fetch(url, { ...opts, headers: { ...opts.headers, Authorization: `Bearer ${_accessToken}` } });
  };

  const findFile = async () => {
    const res = await authFetch(`https://www.googleapis.com/drive/v3/files?q=name='${FILE_NAME}' and trashed=false&spaces=drive&fields=files(id,name)`);
    const data = await res.json();
    return data.files?.[0] || null;
  };

  const uploadBackup = async (data) => {
    setSyncing(true); setError('');
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const existing = await findFile();
      const meta = { name: FILE_NAME, mimeType: 'application/json' };
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
      form.append('file', blob);
      const url = existing
        ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
      const res = await authFetch(url, { method: existing ? 'PATCH' : 'POST', body: form });
      if (!res.ok) throw new Error('Upload echoue ' + res.status);
      return true;
    } catch(e) {
      setError(e.message === 'SESSION_EXPIRED' ? 'Session expiree, reconnectez Google.' : e.message);
      return false;
    } finally { setSyncing(false); }
  };

  const findSharedFile = async () => {
    const res = await authFetch(`https://www.googleapis.com/drive/v3/files?q=name='${FILE_NAME_SHARED}' and trashed=false&spaces=drive&fields=files(id,name)`);
    const data = await res.json();
    return data.files?.[0] || null;
  };

  const uploadSharedData = async (secret, dataObj) => {
    setSyncing(true); setError('');
    try {
      const encrypted = await encryptPayload(secret, dataObj);
      const blob = new Blob([JSON.stringify(encrypted)], { type: 'application/json' });
      const existing = await findSharedFile();
      const meta = { name: FILE_NAME_SHARED, mimeType: 'application/json' };
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
      form.append('file', blob);
      const url = existing
        ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
      const res = await authFetch(url, { method: existing ? 'PATCH' : 'POST', body: form });
      if (!res.ok) throw new Error('Upload partage echoue ' + res.status);
      return existing ? existing.id : (await res.json()).id;
    } catch(e) {
      setError(e.message);
      return null;
    } finally { setSyncing(false); }
  };

  // Telechargement cote employe : pas besoin d'auth Google, fichier en lecture publique
  const downloadSharedData = async (fileId, secret) => {
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${DRIVE_API_KEY}`);
      if (!res.ok) throw new Error('Fichier partage introuvable (' + res.status + ')');
      const encrypted = await res.json();
      const data = await decryptPayload(secret, encrypted);
      return data;
    } catch(e) {
      setError('Erreur lecture partage: ' + e.message);
      return null;
    }
  };

  const shareFileForEmployees = async () => {
    try {
      const file = await findSharedFile();
      if (!file) return null;
      await authFetch(`https://www.googleapis.com/drive/v3/files/${file.id}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
      });
      return file.id;
    } catch(e) {
      setError('Erreur partage: ' + e.message);
      return null;
    }
  };

  const downloadBackup = async () => {
    setSyncing(true); setError('');
    try {
      const file = await findFile();
      if (!file) { setError('Aucune sauvegarde trouvee.'); return null; }
      const res = await authFetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`);
      if (!res.ok) throw new Error('Download echoue ' + res.status);
      return await res.json();
    } catch(e) {
      setError(e.message === 'SESSION_EXPIRED' ? 'Session expiree, reconnectez Google.' : e.message);
      return null;
    } finally { setSyncing(false); }
  };

  const mergeSync = async (localData, freshToken) => {
    if (freshToken) { _accessToken = freshToken; _tokenExpiry = Date.now() + 55 * 60 * 1000; }
    setSyncing(true); setError('');
    try {
      console.log('mergeSync start, localData keys:', Object.keys(localData));
      const tables = ['clients','produits','ventes','prospects','rdvs','seminaires','participants'];
      
      // 1. Telecharge Drive
      const remote = await downloadBackup();
      
      // 2. Si pas de donnees remote, upload local directement
      if (!remote) {
        await uploadBackup(localData);
        return true;
      }
      
      // 3. Fusion: pour chaque table, garde l'enregistrement le plus recent
      const merged = {};
      for (const table of tables) {
        const localItems  = localData[table]  || [];
        const remoteItems = remote[table] || [];
        
        // Index par _id
        const map = {};
        for (const item of remoteItems) {
          map[item._id] = item;
        }
        for (const item of localItems) {
          const existing = map[item._id];
          if (!existing) {
            map[item._id] = item;
          } else {
            const localTime  = item.updated_at     || item.created_at     || '';
            const remoteTime = existing.updated_at || existing.created_at || '';
            if (localTime >= remoteTime) {
              map[item._id] = item;
            }
          }
        }
        merged[table] = Object.values(map);
      }
      merged.exported_at = new Date().toISOString();
      
      // 4. Sauvegarde merged en local
      await importAllData(merged);
      
      // 5. Upload merged sur Drive
      await uploadBackup(merged);
      
      return true;
    } catch(e) {
      setError(e.message === 'SESSION_EXPIRED' ? 'Session expiree, reconnectez Google.' : e.message);
      return false;
    } finally { setSyncing(false); }
  };

  return { googleUser, syncing, authReady, error, connect, disconnect, uploadBackup, downloadBackup, mergeSync, shareFileForEmployees, uploadSharedData, downloadSharedData };
};
