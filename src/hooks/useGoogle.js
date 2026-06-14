import { useState, useEffect } from 'react';
import { setSetting, getSetting } from '../db/index';

const CLIENT_ID = '6659063018-gs71riiatkgkk4gc6nuou23b8rut3a6b.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const FILE_NAME = 'beautycrm-backup.json';

let tokenClient = null;
let accessToken = null;

export const useGoogle = () => {
  const [googleUser, setGoogleUser] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getSetting("google_email").then(email => { if (email && email !== "null") setGoogleUser(email); });
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (response) => {
          if (response.error) { setError('Erreur Google : ' + response.error); return; }
          accessToken = response.access_token;
          const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: 'Bearer ' + accessToken },
          }).then(r => r.json());
          const email = info.email || 'Compte Google';
          setGoogleUser(email);
          await setSetting('google_email', email);
          setError('');
        },
      });
    };
    document.head.appendChild(script);
  }, []);

  const connect = () => {
    setError('');
    if (!tokenClient) { setError('Google non charge. Reessayez.'); return; }
    tokenClient.requestAccessToken();
  };

  const disconnect = async () => {
    if (accessToken) window.google?.accounts.oauth2.revoke(accessToken);
    accessToken = null;
    setGoogleUser(null);
    await setSetting("google_email", "");
  };

  const findFile = async () => {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${FILE_NAME}' and trashed=false&spaces=drive&fields=files(id,name,modifiedTime)`,
      { headers: { Authorization: 'Bearer ' + accessToken } }
    ).then(r => r.json());
    return res.files?.[0] || null;
  };

  const refreshToken = () => new Promise((resolve) => {
    if (!tokenClient) { resolve(false); return; }
    tokenClient.callback = async (response) => {
      if (response.error) { resolve(false); return; }
      accessToken = response.access_token;
      resolve(true);
    };
    tokenClient.requestAccessToken({ prompt: "" });
  });

  const uploadBackup = async (data) => {
    setSyncing(true); setError('');
    try {
      if (!accessToken) { const ok = await refreshToken(); if (!ok) { setError("Reconnectez Google."); setSyncing(false); return false; } }
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const existing = await findFile();
      const metadata = { name: FILE_NAME, mimeType: 'application/json' };
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', blob);
      const url = existing
        ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
      const method = existing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { Authorization: 'Bearer ' + accessToken },
        body: form,
      });
      if (!res.ok) throw new Error('Upload echoue : ' + res.status);
      return true;
    } catch(e) { setError(e.message); return false; }
    finally { setSyncing(false); }
  };

  const downloadBackup = async () => {
    setSyncing(true); setError('');
    try {
      const file = await findFile();
      if (!file) { setError('Aucun backup trouve sur Drive.'); return null; }
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        { headers: { Authorization: 'Bearer ' + accessToken } }
      );
      if (!res.ok) throw new Error('Download echoue : ' + res.status);
      return await res.json();
    } catch(e) { setError(e.message); return null; }
    finally { setSyncing(false); }
  };

  return { googleUser, syncing, error, connect, disconnect, uploadBackup, downloadBackup };
};
