import { useState, useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { getSetting, setSetting, importAllData } from './db/index';
import { syncIfNeeded } from './hooks/useTracker';
import { useNetwork } from './hooks/useNetwork';
import { useDevise } from './hooks/useDevise';
import { useAnnonces } from './hooks/useAnnonces';
import { useGoogle } from "./hooks/useGoogle";
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ClientsPage } from './pages/ClientsPage';
import { ContactsPage } from './pages/ContactsPage';
import { VentesPage } from './pages/VentesPage';
import { ProduitsPage } from './pages/ProduitsPage';
import { CreditsPage } from './pages/CreditsPage';
import { SeminairesPage } from './pages/SeminairesPage';
import { RdvsPage } from './pages/RdvsPage';
import { RelancesPage } from './pages/RelancesPage';
import { RapportsPage } from './pages/RapportsPage';
import { ParametresPage } from './pages/ParametresPage';

export default function App() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [checking, setChecking] = useState(true);
  const [loginKey, setLoginKey] = useState(0);
  const [canDismiss, setCanDismiss] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [hideHeader, setHideHeader] = useState(false);
  const isOnline = useNetwork();
  useDevise();
  const { annonce, dismiss } = useAnnonces();
  const { connect: googleConnect, downloadBackup, googleUser: gUser } = useGoogle();

  useEffect(() => {
    if (!annonce) return;
    setCanDismiss(false);
    setCountdown(4);
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(timer); setCanDismiss(true); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [annonce]);

  useEffect(() => {
    getSetting("password").then(pw => {
      if (!pw) {
        getSetting('username').then(name => {
          if (name) setUser(name);
          setChecking(false);
        });
      } else {
        getSetting('username').then(() => setChecking(false));
      }
    }).catch(() => setChecking(false));
  }, [checking]);

  useEffect(() => {
    if (isOnline && user) {
      syncIfNeeded(getSetting, setSetting);
    }
  }, [isOnline, user]);

  if (checking) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1F36' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>💄</div>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>BeautyCRM</div>
        <div style={{ color: '#A0A8D0', fontSize: 12, marginTop: 6 }}>Chargement...</div>
      </div>
    </div>
  );

  if (!user) return <LoginPage key={loginKey} onSuccess={setUser} googleConnect={googleConnect} downloadBackup={downloadBackup} googleUser={gUser} importAllData={importAllData} />;

  const renderPage = () => {
    switch(page) {
      case 'dashboard':  return <DashboardPage onNavigate={setPage} />;
      case 'clients':    return <ClientsPage />;
      case 'contacts':   return <ContactsPage />;
      case 'ventes':     return <VentesPage onNavigate={setPage} />;
      case 'produits':   return <ProduitsPage onHideHeader={setHideHeader} />;
      case 'stock':      return <ProduitsPage onHideHeader={setHideHeader} />;
      case 'credits':    return <CreditsPage onNavigate={setPage} />;
      case 'seminaires': return <SeminairesPage />;
      case 'rdvs':       return <RdvsPage />;
      case 'relances':   return <RelancesPage />;
      case 'rapports':   return <RapportsPage />;
      case 'parametres': return <ParametresPage user={user} onLogout={() => { setUser(null); setLoginKey(k => k+1); setChecking(true); setTimeout(() => setChecking(false), 200); }} />;
      default:           return <DashboardPage onNavigate={setPage} />;
    }
  };

  return (
    <>
      {annonce && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(26,31,54,0.7)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 380, textAlign: 'center' }}>
            {annonce.video ? (
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#1A1F36', marginBottom: 12 }}>{annonce.titre}</div>
                <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 12, position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                  <iframe src={annonce.video} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} frameBorder="0" allowFullScreen title="annonce" />
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📢</div>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#1A1F36', marginBottom: 10 }}>{annonce.titre}</div>
                <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 16, lineHeight: 1.6 }}>{annonce.message}</div>
                {annonce.lien && (
                  <button onClick={() => window.open(annonce.lien, '_blank')} style={{ width: '100%', backgroundColor: '#3D5AFE', color: '#fff', border: 'none', borderRadius: 12, padding: 13, fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 10 }}>
                    En savoir plus
                  </button>
                )}
              </div>
            )}
            {!canDismiss && <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>Ignorer dans {countdown}s</div>}
            <button onClick={dismiss} disabled={!canDismiss} style={{ width: '100%', backgroundColor: canDismiss ? '#F5F6FA' : '#E5E7EB', color: '#6B7280', border: '1px solid #E8EAF0', borderRadius: 12, padding: 13, fontWeight: 600, fontSize: 14, cursor: canDismiss ? 'pointer' : 'not-allowed' }}>
              Ignorer
            </button>
          </div>
        </div>
      )}
      <Layout page={page} onNavigate={setPage} user={user} hideHeader={hideHeader}>
        {renderPage()}
      </Layout>
      {needRefresh && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#1A1F36', border: '1px solid #3D5AFE', borderRadius: 12,
          padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)', zIndex: 9999, minWidth: 280,
        }}>
          <span style={{ fontSize: 13, color: '#fff', flex: 1 }}>🔄 Nouvelle version disponible</span>
          <button onClick={() => updateServiceWorker(true)} style={{
            background: '#3D5AFE', color: '#fff', border: 'none', borderRadius: 8,
            padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>Mettre à jour</button>
        </div>
      )}
    </>
  );
}
