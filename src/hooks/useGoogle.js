import { useState, useEffect, useCallback, useRef } from 'react';
import { setSetting, getSetting } from '../db/index';

const CLIENT_ID   = '6659063018-gs71riiatkgkk4gc6nuou23b8rut3a6b.apps.googleusercontent.com';
const SCOPES      = 'https://www.googleapis.com/auth/drive.file';
const FILE_NAME   = 'beautycrm-backup.json';
const REFRESH_MS  = 45 * 60 * 1000;

let _tokenClient  = null;
let _accessToken  = null;
let _tokenExpiry  = 0;
let _refreshTimer = null;

export const useGoogle = () => {
  const [googleUser,  setGoogleUser]  = useState(null);
  const [syncing,     setSyncing]     = useState(false);
  const [authReady,   setAuthReady]   = useState(false);
  const [error,       setError]       = useState('');

  const pendingResolvers = useRef([]);

  useEffect(() => {
    getSetting('google_user').then(raw => {
      try { if (raw) setGoogleUser(JSON.parse(raw)); } catch (_) {}
    });

    if (document.querySelector('script[src*="accounts.google.com/gsi"]')) {
      initTokenClient();
      return;
    }

    const script = document.createElement('script');
    script.src   = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload  = initTokenClient;
    script.onerror = () => setError("Impossible de charger l'authentification Google.");
    document.head.appendChild(script);

    return () => clearTimeout(_refreshTimer);
  }, []);

  const handleTokenResponse = useCallback(async (response) => {
    if (response.error) {
      if (response.error !== 'interaction_required') {
        setError('Erreur Google : ' + response.error);
      }
      pendingResolvers.current.forEach(r => r(false));
      pendingResolvers.current = [];
      return;
    }

    _accessToken = response.access_token;
    _tokenExpiry = Date.now() + (response.expires_in - 60) * 1000;

    clearTimeout(_refreshTimer);
    _refreshTimer = setTimeout(silentRefresh, REFRESH_MS);

    pendingResolvers.current.forEach(r => r(true));
    pendingResolvers.current = [];

    const stored = await getSetting('google_user');
    if (!stored) {
      try {
        const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: 'Bearer ' + _accessToken },
        }).then(r => r.json());

        if (!info.email) { setError('Email non disponible.'); return; }

        const user = { email: info.email, name: info.name || info.email, picture: info.picture || null };
        setGoogleUser(user);
        await setSetting('google_user', JSON.stringify(user));
      } catch (_) {
        setError('Impossible de recuperer le profil Google.');
      }
    } else {
      try { setGoogleUser(JSON.parse(stored)); } catch (_) {}
    }

    setError('');
  }, []);

  const silentRefresh = useCallback(() => {
    if (!_tokenClient) return;
    _tokenClient.callback = handleTokenResponse;
    _tokenClient.requestAccessToken({ prompt: '' });
  }, [handleTokenResponse]);

  const initTokenClient = useCallback(() => {
    if (!window.google?.accounts?.oauth2) return;
    _tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope:     SCOPES,
      callback:  handleTokenResponse,
    });
    setAuthReady(true);
    getSetting('google_user').then(raw => {
      if (raw) silentRefresh();
    });
  }, [handleTokenResponse, silentRefresh]);

  const getToken = useCallback(() => new Promise((resolve) => {
    if (_accessToken && Date.now() < _tokenExpiry) { resolve(true); return; }
    if (!_tokenClient) { resolve(false); return; }
    pendingResolvers.current.push(resolve);
    if (pendingResolvers.current.length === 1) {
      _tokenClient.callback = handleTokenResponse;
      _tokenClient.requestAccessToken({ prompt: '' });
    }
  }), [handleTokenResponse]);

  const connect = useCallback(() => {
    setError('');
    if (!_tokenClient) { setError('Authentification non prete. Reessayez dans un instant.'); return; }
    _tokenClient.callback = handleTokenResponse;
    _tokenClient.requestAccessToken({ prompt: 'select_account' });
  }, [handleTokenResponse]);

  const disconnect = useCallback(async () => {
    clearTimeout(_refreshTimer);
    if (_accessToken) window.google?.accounts.oauth2.revoke(_accessToken, () => {});
    _accessToken = null;
    _tokenExpiry = 0;
    setGoogleUser(null);
    setError('');
    await setSetting('google_user', '');
  }, []);

  const authFetch = useCallback(async (url, options = {}) => {
    const ok = await getToken();
    if (!ok) throw new Error('SESSION_EXPIRED');
    return fetch(url, {
      ...options,
      headers: { ...options.headers, Authorization: 'Bearer ' + _accessToken },
    });
  }, [getToken]);

  const findFile = useCallback(async () => {
    const res  = await authFetch(
      "https://www.googleapis.com/drive/v3/files?q=name='" + FILE_NAME + "' and trashed=false&spaces=drive&fields=files(id,name,modifiedTime)"
    );
    const data = await res.json();
    return data.files?.[0] || null;
  }, [authFetch]);

  const uploadBackup = useCallback(async (data) => {
    setSyncing(true); setError('');
    try {
      const json     = JSON.stringify(data, null, 2);
      const blob     = new Blob([json], { type: 'application/json' });
      const existing = await findFile();
      const metadata = { name: FILE_NAME, mimeType: 'application/json' };
      const form     = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', blob);
      const url = existing
        ? 'https://www.googleapis.com/upload/drive/v3/files/' + existing.id + '?uploadType=multipart'
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
      const res = await authFetch(url, { method: existing ? 'PATCH' : 'POST', body: form });
      if (!res.ok) throw new Error('Echec de la sauvegarde (HTTP ' + res.status + ')');
      return true;
    } catch (e) {
      setError(e.message === 'SESSION_EXPIRED'
        ? 'Session expiree. Reconnectez votre compte Google.'
        : e.message);
      return false;
    } finally { setSyncing(false); }
  }, [authFetch, findFile]);

  const downloadBackup = useCallback(async () => {
    setSyncing(true); setError('');
    try {
      const file = await findFile();
      if (!file) { setError('Aucune sauvegarde trouvee sur Drive.'); return null; }
      const res = await authFetch('https://www.googleapis.com/drive/v3/files/' + file.id + '?alt=media');
      if (!res.ok) throw new Error('Echec du telechargement (HTTP ' + res.status + ')');
      return await res.json();
    } catch (e) {
      setError(e.message === 'SESSION_EXPIRED'
        ? 'Session expiree. Reconnectez votre compte Google.'
        : e.message);
      return null;
    } finally { setSyncing(false); }
  }, [authFetch, findFile]);

  return { googleUser, syncing, authReady, error, connect, disconnect, uploadBackup, downloadBackup };
};
