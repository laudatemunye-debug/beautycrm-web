import { useState, useEffect, useRef } from 'react';
import { setSetting, getSetting } from '../db/index';

const CLIENT_ID = '6659063018-gs71riiatkgkk4gc6nuou23b8rut3a6b.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';
const FILE_NAME = 'beautycrm-backup.json';

let _tokenClient = null;
let _accessToken = null;
let _tokenExpiry = 0;

export const useGoogle = () => {
  const [googleUser, setGoogleUser] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [error, setError] = useState('');
  const resolvers = useRef([]);

  useEffect(() => {
    getSetting('google_user').then(raw => {
      if (raw) try { setGoogleUser(JSON.parse(raw)); } catch(_) {}
    });

    const existing = document.querySelector('script[src*="accounts.google.com/gsi"]');
    if (existing) { initClient(); return; }

    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = initClient;
    document.head.appendChild(s);
  }, []);

  const initClient = () => {
    if (!window.google?.accounts?.oauth2) return;
    _tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: onToken,
    });
    setAuthReady(true);
  };

  const onToken = async (resp) => {
    if (resp.error) {
      if (resp.error !== 'interaction_required' && resp.error !== 'access_denied') {
        setError('Erreur: ' + resp.error);
      }
      resolvers.current.forEach(r => r(false));
      resolvers.current = [];
      return;
    }

    _accessToken = resp.access_token;
    _tokenExpiry = Date.now() + (resp.expires_in - 120) * 1000;

    resolvers.current.forEach(r => r(true));
    resolvers.current = [];

    setTimeout(silentRefresh, (resp.expires_in - 180) * 1000);

    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${resp.access_token}` },
      });
      const info = await res.json();
      if (info.email) {
        const user = { email: info.email, name: info.name || info.email, picture: info.picture || null };
        setGoogleUser(user);
        await setSetting('google_user', JSON.stringify(user));
        setError('');
      } else {
        setError('Email non recu: ' + JSON.stringify(info));
      }
    } catch(e) {
      setError('Erreur profil: ' + e.message);
    }
  };

  const silentRefresh = () => {
    if (!_tokenClient) return;
    try {
      _tokenClient.callback = onToken;
      _tokenClient.requestAccessToken({ prompt: 'none' });
    } catch(_) {}
  };

  const getToken = () => new Promise(resolve => {
    if (_accessToken && Date.now() < _tokenExpiry) { resolve(true); return; }
    if (!_tokenClient) { resolve(false); return; }
    resolvers.current.push(resolve);
    if (resolvers.current.length === 1) {
      _tokenClient.callback = (resp) => {
        if (resp.error) {
          resolvers.current.forEach(r => r(false));
          resolvers.current = [];
          return;
        }
        _accessToken = resp.access_token;
        _tokenExpiry = Date.now() + (resp.expires_in - 120) * 1000;
        resolvers.current.forEach(r => r(true));
        resolvers.current = [];
      };
      _tokenClient.requestAccessToken({ prompt: 'none' });
    }
  });

  const connect = () => {
    setError('');
    if (!_tokenClient) { setError('Non pret, reessayez.'); return; }
    _tokenClient.callback = onToken;
    _tokenClient.requestAccessToken({ prompt: 'select_account' });
  };

  const disconnect = async () => {
    if (_accessToken) window.google?.accounts.oauth2.revoke(_accessToken, () => {});
    _accessToken = null;
    _tokenExpiry = 0;
    setGoogleUser(null);
    setError('');
    await setSetting('google_user', '');
  };

  const authFetch = async (url, opts = {}) => {
    const ok = await getToken();
    if (!ok) throw new Error('SESSION_EXPIRED');
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

  return { googleUser, syncing, authReady, error, connect, disconnect, uploadBackup, downloadBackup };
};
