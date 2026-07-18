import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { getSetting, setSetting, importAllData, resetDB } from './db/index';
import { syncIfNeeded } from './hooks/useTracker';
import { useNetwork } from './hooks/useNetwork';
import { useDevise } from './hooks/useDevise';
import { useAnnonces } from './hooks/useAnnonces';
import { useEntreprise } from './hooks/useEntreprise';
import { useGoogle } from "./hooks/useGoogle";
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { AccountSelectorPage } from './pages/AccountSelectorPage';
import { getAccounts, setActiveAccountId, clearActiveAccountId, generateAccountId, ensureDefaultAccountRegistered } from './hooks/useAccounts';
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ClientsPage = lazy(() => import('./pages/ClientsPage').then(m => ({ default: m.ClientsPage })));
const ContactsPage = lazy(() => import('./pages/ContactsPage').then(m => ({ default: m.ContactsPage })));
const VentesPage = lazy(() => import('./pages/VentesPage').then(m => ({ default: m.VentesPage })));
const ProduitsPage = lazy(() => import('./pages/ProduitsPage').then(m => ({ default: m.ProduitsPage })));
const CreditsPage = lazy(() => import('./pages/CreditsPage').then(m => ({ default: m.CreditsPage })));
const SeminairesPage = lazy(() => import('./pages/SeminairesPage').then(m => ({ default: m.SeminairesPage })));
const RdvsPage = lazy(() => import('./pages/RdvsPage').then(m => ({ default: m.RdvsPage })));
const RelancesPage = lazy(() => import('./pages/RelancesPage').then(m => ({ default: m.RelancesPage })));
const RapportsPage = lazy(() => import('./pages/RapportsPage').then(m => ({ default: m.RapportsPage })));
const ParametresPage = lazy(() => import('./pages/ParametresPage').then(m => ({ default: m.ParametresPage })));
const ComptabilitePage = lazy(() => import('./pages/ComptabilitePage'));

export default function App() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [checking, setChecking] = useState(true);
  const [showSelector, setShowSelector] = useState(false);
  const [accountsChecked, setAccountsChecked] = useState(false);

  useEffect(() => {
    ensureDefaultAccountRegistered().then(() => {
      const accounts = getAccounts();
      if (accounts.length > 1) {
        // Plusieurs comptes -> afficher le selecteur
        setShowSelector(true);
      } else if (accounts.length === 1) {
        // Un seul compte -> l'activer automatiquement sans passer par le selecteur
        setActiveAccountId(accounts[0].id);
      }
      setAccountsChecked(true);
    });
  }, []);

  const handleAccountSelected = (acc) => {
    setActiveAccountId(acc.id);
    setShowSelector(false);
    setUser(null);
    setLoginKey(k => k + 1);
    setChecking(true);
  };

  const handleAddAccount = () => {
    setActiveAccountId(generateAccountId());
    setShowSelector(false);
    setUser(null);
    setLoginKey(k => k + 1);
    setChecking(true);
  };
  const [loginKey, setLoginKey] = useState(0);
  const [canDismiss, setCanDismiss] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [hideHeader, setHideHeader] = useState(false);
  const isOnline = useNetwork();
  useDevise();
  const { annonce, dismiss } = useAnnonces();
  const { connect: googleConnect, downloadBackup, googleUser: gUser, disconnect: googleDisconnect } = useGoogle();
  const bizMode = useEntreprise();
  const [revoked, setRevoked] = useState(false);
  const [adminWhatsapp, setAdminWhatsapp] = useState('');
  const [motifRevocation, setMotifRevocation] = useState('');
  const [entrepriseFermee, setEntrepriseFermee] = useState(false);
  const [suspendue, setSuspendue] = useState(false);
  const [supprimee, setSupprimee] = useState(false);
  const [suppressionMotif, setSuppressionMotif] = useState('');
  const [suppressionContact, setSuppressionContact] = useState(null);
  const [checkingBlock, setCheckingBlock] = useState(true);
  const [suspensionMotif, setSuspensionMotif] = useState('');
  const [suspensionContact, setSuspensionContact] = useState(null);
  const [supprimePersonnel, setSupprimePersonnel] = useState(false);
  const [suppressionMotifPersonnel, setSuppressionMotifPersonnel] = useState('');
  const [suppressionContactPersonnel, setSuppressionContactPersonnel] = useState(null);
  const [suspenduPersonnel, setSuspenduPersonnel] = useState(false);
  const [suspensionMotifPersonnel, setSuspensionMotifPersonnel] = useState('');
  const [suspensionContactPersonnel, setSuspensionContactPersonnel] = useState(null);
  const [vole, setVole] = useState(false);
  const [voleCode, setVoleCode] = useState('');
  const [voleError, setVoleError] = useState('');
  const [voleSubmitting, setVoleSubmitting] = useState(false);

  useEffect(() => {
    if (!user) { setCheckingBlock(false); return; }
    setCheckingBlock(true);
    // Si pas de connexion internet, bypass immediat
    if (!navigator.onLine) { setCheckingBlock(false); return; }
    // Timeout de securite : apres 3s on debloque l'app quoi qu'il arrive
    const timeout = setTimeout(() => setCheckingBlock(false), 3000);

    Promise.all([
      bizMode.checkSuspension().then((data) => {
        if (data.blocked && data.reason === 'supprimee') {
          setSupprimee(true);
          setSuppressionMotif(data.motif || '');
          setSuppressionContact(data.contact || null);
          return;
        }
        if (data.blocked && data.reason === 'suspendue') {
          setSuspendue(true);
          setSuspensionMotif(data.motif || '');
          setSuspensionContact(data.contact || null);
        }
      }).catch(() => {}),
      bizMode.checkEmployeStatus().then(({ revoked: r, entreprise_fermee, admin_whatsapp, motif, vole: v }) => {
        if (v) {
          setVole(true);
          if (admin_whatsapp) setAdminWhatsapp(admin_whatsapp);
          else return getSetting('entreprise_admin_whatsapp').then(w => setAdminWhatsapp(w || ''));
          return;
        }
        if (r) {
          setRevoked(true);
          setEntrepriseFermee(!!entreprise_fermee);
          setMotifRevocation(motif || '');
          if (admin_whatsapp) setAdminWhatsapp(admin_whatsapp);
          else return getSetting('entreprise_admin_whatsapp').then(w => setAdminWhatsapp(w || ''));
        }
      }).catch(() => {}),
      bizMode.checkStatutPersonnel().then((data) => {
        if (data.blocked && data.reason === 'supprimee') {
          setSupprimePersonnel(true);
          setSuppressionMotifPersonnel(data.motif || '');
          setSuppressionContactPersonnel(data.contact || null);
          return;
        }
        if (data.blocked && data.reason === 'suspendue') {
          setSuspenduPersonnel(true);
          setSuspensionMotifPersonnel(data.motif || '');
          setSuspensionContactPersonnel(data.contact || null);
        }
      }).catch(() => {})
    ]).finally(() => { clearTimeout(timeout); setCheckingBlock(false); });
  }, [user]);


  const soumettreCodeVole = async () => {
    if (!voleCode.trim()) { setVoleError('Entrez le code recu.'); return; }
    setVoleSubmitting(true);
    setVoleError('');
    try {
      await bizMode.verifierCodeVole(voleCode.trim());
      await setSetting('vole_attempts', '0');
      setVole(false);
      setVoleCode('');
    } catch (e) {
      const attemptsRaw = await getSetting('vole_attempts');
      const attempts = (parseInt(attemptsRaw, 10) || 0) + 1;
      await setSetting('vole_attempts', String(attempts));
      if (attempts >= 5) {
        try {
          resetDB();
          await new Promise(resolve => { const req = indexedDB.deleteDatabase("beautycrm"); req.onsuccess = resolve; req.onerror = resolve; req.onblocked = resolve; });
        } catch(_) {}
        setTimeout(() => window.location.reload(), 300);
        return;
      }
      setVoleError((e.message || 'Code incorrect.') + ` (Tentative ${attempts}/5)`);
    } finally {
      setVoleSubmitting(false);
    }
  };

  const fermerRevocation = async () => {
    try {
      resetDB();
      await new Promise(resolve => { const req = indexedDB.deleteDatabase("beautycrm"); req.onsuccess = resolve; req.onerror = resolve; req.onblocked = resolve; });
      setTimeout(() => window.location.reload(), 300);
    } catch(_) {
      window.location.reload();
    }
  };

  // Suspension = reversible, on ne touche a AUCUNE donnee locale, on masque juste l'ecran.
  const fermerSuspension = () => {
    setSuspendue(false);
    setSuspensionMotif('');
    setSuspensionContact(null);
  };

  // Suppression = definitive et irreversible : purge Drive (backend) puis purge locale complete.
  const fermerSuppression = async () => {
    try {
      await bizMode.purgerEntrepriseSupprimee();
    } catch(_) {}
    try {
      resetDB();
      await new Promise(resolve => { const req = indexedDB.deleteDatabase("beautycrm"); req.onsuccess = resolve; req.onerror = resolve; req.onblocked = resolve; });
      setTimeout(() => window.location.reload(), 300);
    } catch(_) {
      window.location.reload();
    }
  };

  // Suspension du compte personnel = reversible, on ne touche a AUCUNE donnee locale.
  const fermerSuspensionPersonnelle = () => {
    setSuspenduPersonnel(false);
    setSuspensionMotifPersonnel('');
    setSuspensionContactPersonnel(null);
  };

  // Suppression du compte personnel = definitive et irreversible : purge Drive (backend) puis purge locale complete.
  const fermerSuppressionPersonnelle = async () => {
    try {
      await bizMode.purgerCompteSupprime();
    } catch(_) {}
    try {
      resetDB();
      await new Promise(resolve => { const req = indexedDB.deleteDatabase("beautycrm"); req.onsuccess = resolve; req.onerror = resolve; req.onblocked = resolve; });
      setTimeout(() => window.location.reload(), 300);
    } catch(_) {
      window.location.reload();
    }
  };

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

  if (!accountsChecked) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1F36' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>💄</div>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>BeautyCRM</div>
      </div>
    </div>
  );

  if (showSelector) return <AccountSelectorPage onSelect={handleAccountSelected} onAddAccount={handleAddAccount} />;

  if (checking) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1F36' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>💄</div>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>BeautyCRM</div>
        <div style={{ color: '#A0A8D0', fontSize: 12, marginTop: 6 }}>Chargement...</div>
      </div>
    </div>
  );

  if (!user) return <LoginPage key={loginKey} onSuccess={setUser} googleConnect={googleConnect} downloadBackup={downloadBackup} googleUser={gUser} googleDisconnect={googleDisconnect} importAllData={importAllData} />;

  if (checkingBlock) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1F36' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>💄</div>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>BeautyCRM</div>
        <div style={{ color: '#A0A8D0', fontSize: 12, marginTop: 6 }}>Chargement...</div>
      </div>
    </div>
  );

  if (supprimePersonnel) {
    const whatsappUrlP = suppressionContactPersonnel?.whatsapp ? `https://wa.me/${suppressionContactPersonnel.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Bonjour, mon compte a ete supprime. Pouvez-vous me donner plus d informations ?')}` : null;
    const mailUrlP = suppressionContactPersonnel?.email ? `mailto:${suppressionContactPersonnel.email}` : null;
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 3000, backgroundColor: '#1A1F36', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🗑️</div>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 20, marginBottom: 10 }}>Compte supprime</div>
        <div style={{ color: '#A0A8D0', fontSize: 14, marginBottom: suppressionMotifPersonnel ? 14 : 28, lineHeight: 1.6, maxWidth: 320 }}>
          Votre compte a ete supprime. Contactez l'equipe IZISOFT.
        </div>
        {suppressionMotifPersonnel && (
          <div style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid #3A4166', borderRadius: 10, padding: '10px 14px', marginBottom: 28, maxWidth: 320 }}>
            <div style={{ color: '#7A83B0', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>MOTIF</div>
            <div style={{ color: '#fff', fontSize: 13, lineHeight: 1.5 }}>{suppressionMotifPersonnel}</div>
          </div>
        )}
        {whatsappUrlP && (
          <button onClick={() => window.open(whatsappUrlP, '_blank')} style={{ width: '100%', maxWidth: 320, backgroundColor: '#25D366', color: '#fff', border: 'none', borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 12 }}>
            💬 Contacter le support (WhatsApp)
          </button>
        )}
        {mailUrlP && (
          <button onClick={() => window.open(mailUrlP, '_blank')} style={{ width: '100%', maxWidth: 320, backgroundColor: 'transparent', color: '#fff', border: '1px solid #3A4166', borderRadius: 12, padding: 14, fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: 12 }}>
            ✉️ Contacter le support (Email)
          </button>
        )}
        <button onClick={fermerSuppressionPersonnelle} style={{ width: '100%', maxWidth: 320, backgroundColor: 'transparent', color: '#A0A8D0', border: '1px solid #3A4166', borderRadius: 12, padding: 14, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
          Fermer
        </button>
      </div>
    );
  }

  if (suspenduPersonnel) {
    const whatsappUrlSP = suspensionContactPersonnel?.whatsapp ? `https://wa.me/${suspensionContactPersonnel.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Bonjour, mon compte a ete suspendu. Pouvez-vous me donner plus d informations ?')}` : null;
    const mailUrlSP = suspensionContactPersonnel?.email ? `mailto:${suspensionContactPersonnel.email}` : null;
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 3000, backgroundColor: '#1A1F36', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⛔</div>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 20, marginBottom: 10 }}>Compte desactive</div>
        <div style={{ color: '#A0A8D0', fontSize: 14, marginBottom: suspensionMotifPersonnel ? 14 : 28, lineHeight: 1.6, maxWidth: 320 }}>
          Votre compte a ete desactive. Contactez-nous pour le reactiver.
        </div>
        {suspensionMotifPersonnel && (
          <div style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid #3A4166', borderRadius: 10, padding: '10px 14px', marginBottom: 28, maxWidth: 320 }}>
            <div style={{ color: '#7A83B0', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>MOTIF</div>
            <div style={{ color: '#fff', fontSize: 13, lineHeight: 1.5 }}>{suspensionMotifPersonnel}</div>
          </div>
        )}
        {whatsappUrlSP && (
          <button onClick={() => window.open(whatsappUrlSP, '_blank')} style={{ width: '100%', maxWidth: 320, backgroundColor: '#25D366', color: '#fff', border: 'none', borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 12 }}>
            💬 Contacter le support (WhatsApp)
          </button>
        )}
        {mailUrlSP && (
          <button onClick={() => window.open(mailUrlSP, '_blank')} style={{ width: '100%', maxWidth: 320, backgroundColor: 'transparent', color: '#fff', border: '1px solid #3A4166', borderRadius: 12, padding: 14, fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: 12 }}>
            ✉️ Contacter le support (Email)
          </button>
        )}
      </div>
    );
  }

  if (supprimee) {
    const isAdminSideS = suppressionContact?.type === 'support';
    const whatsappUrlS = suppressionContact?.whatsapp ? `https://wa.me/${suppressionContact.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(isAdminSideS ? 'Bonjour, mon compte entreprise a ete supprime. Pouvez-vous me donner plus d informations ?' : 'Bonjour, mon compte a ete supprime car l entreprise est supprimee. Pouvez-vous me donner plus d informations ?')}` : null;
    const mailUrlS = isAdminSideS ? `mailto:${suppressionContact.email}` : null;
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 3000, backgroundColor: '#1A1F36', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🗑️</div>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 20, marginBottom: 10 }}>
          {isAdminSideS ? 'Votre entreprise a ete supprimee' : 'Compte supprime'}
        </div>
        <div style={{ color: '#A0A8D0', fontSize: 14, marginBottom: suppressionMotif ? 14 : 28, lineHeight: 1.6, maxWidth: 320 }}>
          {isAdminSideS
            ? "Votre entreprise a ete supprimee. Contactez l'equipe IZISOFT."
            : "Compte suspendu"}
        </div>
        {suppressionMotif && (
          <div style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid #3A4166', borderRadius: 10, padding: '10px 14px', marginBottom: 28, maxWidth: 320 }}>
            <div style={{ color: '#7A83B0', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>MOTIF</div>
            <div style={{ color: '#fff', fontSize: 13, lineHeight: 1.5 }}>{suppressionMotif}</div>
          </div>
        )}
        {whatsappUrlS && (
          <button onClick={() => window.open(whatsappUrlS, '_blank')} style={{ width: '100%', maxWidth: 320, backgroundColor: '#25D366', color: '#fff', border: 'none', borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 12 }}>
            {isAdminSideS ? "💬 Contacter le support (WhatsApp)" : "💬 Contacter l'entreprise (WhatsApp)"}
          </button>
        )}
        {isAdminSideS && mailUrlS && (
          <button onClick={() => window.open(mailUrlS, '_blank')} style={{ width: '100%', maxWidth: 320, backgroundColor: 'transparent', color: '#fff', border: '1px solid #3A4166', borderRadius: 12, padding: 14, fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: 12 }}>
            ✉️ Contacter le support (Email)
          </button>
        )}
        <button onClick={fermerSuppression} style={{ width: '100%', maxWidth: 320, backgroundColor: 'transparent', color: '#A0A8D0', border: '1px solid #3A4166', borderRadius: 12, padding: 14, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
          Fermer
        </button>
      </div>
    );
  }

  if (suspendue) {
    const isAdminSide = suspensionContact?.type === 'support';
    const whatsappUrl = suspensionContact?.whatsapp ? `https://wa.me/${suspensionContact.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(isAdminSide ? 'Bonjour, mon compte entreprise a ete suspendu. Pouvez-vous me donner plus d informations ?' : 'Bonjour, mon compte a ete suspendu car l entreprise est suspendue. Pouvez-vous me donner plus d informations ?')}` : null;
    const mailUrl = isAdminSide ? `mailto:${suspensionContact.email}` : null;
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 3000, backgroundColor: '#1A1F36', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⛔</div>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 20, marginBottom: 10 }}>Compte suspendu</div>
        <div style={{ color: '#A0A8D0', fontSize: 14, marginBottom: suspensionMotif ? 14 : 28, lineHeight: 1.6, maxWidth: 320 }}>
          {isAdminSide
            ? "Votre compte entreprise a ete suspendu. Contactez le support pour plus d'informations."
            : "Cette entreprise a ete suspendue. Veuillez contacter votre entreprise pour plus d'informations."}
        </div>
        {suspensionMotif && (
          <div style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid #3A4166', borderRadius: 10, padding: '10px 14px', marginBottom: 28, maxWidth: 320 }}>
            <div style={{ color: '#7A83B0', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>MOTIF</div>
            <div style={{ color: '#fff', fontSize: 13, lineHeight: 1.5 }}>{suspensionMotif}</div>
          </div>
        )}
        {whatsappUrl && (
          <button onClick={() => window.open(whatsappUrl, '_blank')} style={{ width: '100%', maxWidth: 320, backgroundColor: '#25D366', color: '#fff', border: 'none', borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 12 }}>
            {isAdminSide ? "💬 Contacter le support (WhatsApp)" : "💬 Contacter l'entreprise (WhatsApp)"}
          </button>
        )}
        {isAdminSide && mailUrl && (
          <button onClick={() => window.open(mailUrl, '_blank')} style={{ width: '100%', maxWidth: 320, backgroundColor: 'transparent', color: '#fff', border: '1px solid #3A4166', borderRadius: 12, padding: 14, fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: 12 }}>
            ✉️ Contacter le support (Email)
          </button>
        )}
        <button onClick={fermerSuspension} style={{ width: '100%', maxWidth: 320, backgroundColor: 'transparent', color: '#A0A8D0', border: '1px solid #3A4166', borderRadius: 12, padding: 14, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
          Fermer
        </button>
      </div>
    );
  }

  if (vole) {
    const whatsappUrlVole = adminWhatsapp ? `https://wa.me/${adminWhatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Bonjour, mon appareil BeautyCRM a ete marque comme vole/perdu. Pouvez-vous me communiquer le code de deverrouillage ?')}` : null;
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 3000, backgroundColor: '#1A1F36', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 20, marginBottom: 10 }}>Appareil verrouille</div>
        <div style={{ color: '#A0A8D0', fontSize: 14, marginBottom: 24, lineHeight: 1.6, maxWidth: 320 }}>
          Cet appareil a ete signale comme vole ou perdu par l'administrateur. Entrez le code de deverrouillage qui vous a ete communique pour continuer.
        </div>
        <input
          value={voleCode}
          onChange={e => setVoleCode(e.target.value)}
          placeholder="Code a 6 chiffres"
          style={{ width: '100%', maxWidth: 320, backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid #3A4166', borderRadius: 12, padding: 14, color: '#fff', fontSize: 16, textAlign: 'center', letterSpacing: 4, marginBottom: 10 }}
        />
        {voleError && (
          <div style={{ color: '#FF6B6B', fontSize: 13, marginBottom: 14 }}>{voleError}</div>
        )}
        <button onClick={soumettreCodeVole} disabled={voleSubmitting} style={{ width: '100%', maxWidth: 320, backgroundColor: '#3D5AFE', color: '#fff', border: 'none', borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 14, cursor: voleSubmitting ? 'not-allowed' : 'pointer', marginBottom: 12, opacity: voleSubmitting ? 0.6 : 1 }}>
          {voleSubmitting ? 'Verification...' : 'Deverrouiller'}
        </button>
        {whatsappUrlVole && (
          <button onClick={() => window.open(whatsappUrlVole, '_blank')} style={{ width: '100%', maxWidth: 320, backgroundColor: '#25D366', color: '#fff', border: 'none', borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            💬 Demander le code via WhatsApp
          </button>
        )}
      </div>
    );
  }

  if (revoked) {
    const whatsappUrl = adminWhatsapp ? `https://wa.me/${adminWhatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(entrepriseFermee ? 'Bonjour, le mode entreprise a ete ferme. Pouvez-vous me donner plus d informations ?' : 'Bonjour, mon acces a ete revoque. Pouvez-vous me donner plus d informations ?')}` : null;
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 3000, backgroundColor: '#1A1F36', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 20, marginBottom: 10 }}>{entrepriseFermee ? "Entreprise fermee" : "Acces revoque"}</div>
        <div style={{ color: '#A0A8D0', fontSize: 14, marginBottom: motifRevocation ? 14 : 28, lineHeight: 1.6, maxWidth: 320 }}>
          {entrepriseFermee
            ? "L'entreprise a ferme le mode entreprise. Veuillez contacter l'entreprise pour plus d'informations."
            : "Vous avez ete revoque par l'entreprise. Veuillez contacter l'entreprise pour plus d'informations."}
        </div>
        {motifRevocation && (
          <div style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid #3A4166', borderRadius: 10, padding: '10px 14px', marginBottom: 28, maxWidth: 320 }}>
            <div style={{ color: '#7A83B0', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>MOTIF</div>
            <div style={{ color: '#fff', fontSize: 13, lineHeight: 1.5 }}>{motifRevocation}</div>
          </div>
        )}
        {whatsappUrl && (
          <button onClick={() => window.open(whatsappUrl, '_blank')} style={{ width: '100%', maxWidth: 320, backgroundColor: '#25D366', color: '#fff', border: 'none', borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 12 }}>
            💬 Contacter via WhatsApp
          </button>
        )}
        <button onClick={fermerRevocation} style={{ width: '100%', maxWidth: 320, backgroundColor: 'transparent', color: '#A0A8D0', border: '1px solid #3A4166', borderRadius: 12, padding: 14, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
          Fermer
        </button>
      </div>
    );
  }

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
      case 'parametres': return <ParametresPage user={user} onLogout={() => { setUser(null); clearActiveAccountId(); setShowSelector(true); }} />;
      case 'comptabilite': return <ComptabilitePage onNavigate={setPage} />;
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
      <Layout page={page} onNavigate={setPage} user={user} hideHeader={hideHeader} entrepriseMode={bizMode.mode}>
        <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Chargement...</div>}>
          {renderPage()}
        </Suspense>
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
