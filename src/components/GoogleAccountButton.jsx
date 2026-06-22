import React, { useState } from 'react';
import { useGoogle } from '../hooks/useGoogle';

const CLIENT_ID = '6659063018-gs71riiatkgkk4gc6nuou23b8rut3a6b.apps.googleusercontent.com';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

const S = {
  card: { display:'flex', alignItems:'center', gap:'10px', padding:'8px 12px', background:'#fff', border:'1px solid #e0e0e0', borderRadius:'8px', boxShadow:'0 1px 3px rgba(0,0,0,.08)', minWidth:0 },
  avatar: { width:32, height:32, borderRadius:'50%', objectFit:'cover', flexShrink:0 },
  avatarFallback: { width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#4285F4 0%,#34A853 100%)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:14, flexShrink:0 },
  info: { display:'flex', flexDirection:'column', minWidth:0, flex:1 },
  name: { fontSize:13, fontWeight:600, color:'#1a1a1a', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', lineHeight:1.3 },
  email: { fontSize:11, color:'#666', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', lineHeight:1.3 },
  badge: { display:'flex', alignItems:'center', gap:4, fontSize:10, fontWeight:600, color:'#34A853', letterSpacing:'0.4px', textTransform:'uppercase' },
  dot: { width:6, height:6, borderRadius:'50%', background:'#34A853', flexShrink:0 },
  actions: { display:'flex', alignItems:'center', gap:12, marginLeft:'auto', flexShrink:0 },
  syncBtn: { width:30, height:30, background:'#3D5AFE', border:'none', borderRadius:6, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  syncBtnOff: { width:30, height:30, background:'#3D5AFE99', border:'none', borderRadius:6, cursor:'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  disconnectBtn: { padding:'4px 8px', background:'transparent', border:'1px solid #e0e0e0', borderRadius:6, fontSize:11, color:'#888', cursor:'pointer', flexShrink:0 },
  connectBtn: { display:'flex', alignItems:'center', gap:10, padding:'8px 14px', background:'#fff', border:'1px solid #dadce0', borderRadius:8, cursor:'pointer', boxShadow:'0 1px 3px rgba(0,0,0,.08)', fontSize:13, fontWeight:500, color:'#3c4043', width:'100%' },
  googleLogo: { width:18, height:18, flexShrink:0 },
  meta: { fontSize:10, color:'#999', marginTop:5, paddingLeft:2 },
  warn: { color:'#f59e0b', marginLeft:8 },
  err: { marginTop:6, fontSize:11, color:'#d93025' },
  ok: { marginTop:6, fontSize:11, color:'#34A853' },
};

const GoogleLogo = () => (
  <svg style={S.googleLogo} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const SyncIcon = ({ spinning }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ animation: spinning ? 'gab-spin 0.8s linear infinite' : 'none', display:'block' }}>
    <polyline points="23 4 23 10 17 10"/>
    <polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);

const fmtDate = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' });
};

export const GoogleAccountButton = ({ onSync }) => {
  const { googleUser, authReady, error, connect, disconnect } = useGoogle();
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg]         = useState('');
  const [isOk, setIsOk]       = useState(true);
  const [lastSync, setLastSync] = useState(() => localStorage.getItem('beautycrm_last_sync') || '');
  const initials = googleUser ? (googleUser.name || googleUser.email).slice(0,1).toUpperCase() : '';

  const doSync = async (token) => {
    if (!navigator.onLine) {
      setIsOk(false);
      setMsg('Pas de connexion internet');
      setTimeout(() => setMsg(''), 4000);
      return;
    }
    setSyncing(true);
    setMsg('');
    try {
      const ok = await onSync(token);
      if (ok) {
        const now = new Date().toISOString();
        localStorage.setItem('beautycrm_last_sync', now);
        setLastSync(now);
        setIsOk(true);
        setMsg('Synchronisation reussie');
      } else {
        setIsOk(false);
        setMsg('Echec de la synchronisation');
      }
    } catch(e) {
      setIsOk(false);
      setMsg('Erreur: ' + e.message);
    } finally {
      setSyncing(false);
      setTimeout(() => setMsg(''), 5000);
    }
  };

  const handleSync = () => {
    if (syncing || !onSync) return;
    const cachedToken  = window.__gtoken  || sessionStorage.getItem('__gtoken');
    const cachedExpiry = window.__gexpiry || parseInt(sessionStorage.getItem('__gexpiry') || '0');
    if (cachedToken && cachedExpiry && Date.now() < cachedExpiry) {
      window.__gtoken  = cachedToken;
      window.__gexpiry = cachedExpiry;
      doSync(cachedToken);
      return;
    }
    if (!window.google?.accounts?.oauth2) { setIsOk(false); setMsg('Google non disponible'); return; }
    const tc = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error) { setIsOk(false); setMsg('Erreur token'); setSyncing(false); return; }
        window.__gtoken  = resp.access_token;
        window.__gexpiry = Date.now() + (resp.expires_in - 120) * 1000;
        sessionStorage.setItem('__gtoken',  resp.access_token);
        sessionStorage.setItem('__gexpiry', window.__gexpiry.toString());
        doSync(resp.access_token);
      },
    });
    tc.requestAccessToken({ prompt: 'select_account' });
  };

  if (googleUser) {
    return (
      <div>
        <style>{'@keyframes gab-spin { to { transform: rotate(360deg); } }'}</style>
        <div style={S.card}>
          {googleUser.picture
            ? <img src={googleUser.picture} alt="avatar" style={S.avatar} referrerPolicy="no-referrer" />
            : <div style={S.avatarFallback}>{initials}</div>
          }
          <div style={S.info}>
            <span style={S.name}>{googleUser.name || googleUser.email}</span>
            <span style={S.email}>{googleUser.email}</span>
            <span style={S.badge}>
              <span style={S.dot}/>
              {syncing ? 'Synchronisation...' : 'Drive connecte'}
            </span>
          </div>
          <div style={S.actions}>
            <button style={syncing ? S.syncBtnOff : S.syncBtn} onClick={handleSync} disabled={syncing} title="Synchroniser">
              <SyncIcon spinning={syncing} />
            </button>
            <button style={S.disconnectBtn} onClick={disconnect}>Deconnecter</button>
          </div>
        </div>
        <div style={S.meta}>
          {lastSync ? ('Derniere sync: ' + fmtDate(lastSync)) : 'Jamais synchronise'}
        </div>
        {msg ? <div style={isOk ? S.ok : S.err}>{isOk ? '✓ ' : '✗ '}{msg}</div> : null}
        {error ? <div style={S.err}>{'⚠ ' + error}</div> : null}
      </div>
    );
  }

  return (
    <div>
      <button style={S.connectBtn} onClick={connect} disabled={!authReady}>
        <GoogleLogo />
        {authReady ? 'Se connecter avec Google' : 'Chargement...'}
      </button>
      {error ? <div style={S.err}>{'⚠ ' + error}</div> : null}
    </div>
  );
};

export default GoogleAccountButton;
