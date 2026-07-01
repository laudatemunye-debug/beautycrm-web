import { useState, useEffect, useRef } from 'react';
import { C } from '../theme';
import { useNetwork } from '../hooks/useNetwork';
import { useUpdateSW } from '../hooks/useUpdateSW';

const NAV_ITEMS = [
  { id: 'dashboard',  icon: '⊞', label: 'Tableau de bord' },
  { id: 'clients',    icon: '👤', label: 'Clients' },
  { id: 'contacts',   icon: '🤝', label: 'Contacts' },
  { id: 'ventes',     icon: '🛍', label: 'Ventes' },
  { id: 'credits',    icon: '💳', label: 'Crédits' },
  { id: 'produits',   icon: '📦', label: 'Gestion de stock' },
  { id: 'seminaires', icon: '🎓', label: 'Seminaires' },
  { id: 'rdvs',       icon: '📅', label: 'Rendez-vous' },
  { id: 'relances',   icon: '🔔', label: 'Relances' },
  { id: 'stock', icon: '📦', label: 'Stock' },
  { id: 'rapports', icon: '📊', label: 'Rapport' },
  { id: 'parametres', icon: '⚙', label: 'Parametres' },
];

const BOTTOM_NAV = [
  { id: 'dashboard',  icon: '⊞', label: 'Accueil' },
  { id: 'clients',    icon: '👤', label: 'Clients' },
  { id: 'ventes',     icon: '🛍', label: 'Ventes' },
  { id: 'credits',    icon: '💳', label: 'Crédits' },
  { id: 'contacts',   icon: '🤝', label: 'Contacts' },
  { id: 'stock', icon: '📦', label: 'Stock' },
];

export const PAGE_TITLES = {
  dashboard:  'Tableau de bord',
  clients:    'Clients',
  contacts:   'Contacts',
  ventes:     'Ventes',
  credits:    'Crédits',
  produits:   'Catalogue produits',
  relances:   'Relances',
  rapports:   'Rapports',
  parametres: 'Parametres',
  seminaires: 'Seminaires',
  rdvs:       'Tous les rendez-vous',
};

const Drawer = ({ open, onClose, onNavigate, active, user }) => {
  const drawerRef = useRef(null);
  const [showParrain, setShowParrain] = useState(false);
  const [nbFilleuls, setNbFilleuls] = useState(0);
  const code = localStorage.getItem('beautycrm_referral_code') || '';
  const link = window.location.origin + (code ? '?ref=' + code : '');

  useEffect(() => {
    if (code) {
      fetch('https://izi360-backend.vercel.app/api/beautycrm/parrainage/count?code=' + code)
        .then(r => r.json())
        .then(d => setNbFilleuls(d.count || 0))
        .catch(() => {})
    }
  }, [code]);

  useEffect(() => {
    if (drawerRef.current) {
      drawerRef.current.style.transform = open ? 'translateX(0)' : 'translateX(-280px)';
    }
  }, [open]);

  return (
    <>
      {open && (
        <div onClick={onClose} style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(26,31,54,0.5)',
          zIndex: 200,
        }} />
      )}
      <div ref={drawerRef} style={{
        position: 'fixed',
        left: 0, top: 0, bottom: 0,
        width: 270,
        backgroundColor: C.sidebar_bg,
        zIndex: 201,
        transform: 'translateX(-100%)',
        transition: 'transform 260ms ease',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}>
        <div style={{ padding: '24px 20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            backgroundColor: C.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24,
          }}>💄</div>
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 17 }}>BeautyCRM</div>
            <div style={{ color: '#A0A8D0', fontSize: 11 }}>Ton Agenda Numerique</div>
          </div>
        </div>

        {user && (
          <div style={{ padding: '0 20px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 16,
              backgroundColor: C.pink + '40',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.pink, fontWeight: 700, fontSize: 13,
            }}>
              {user.charAt(0).toUpperCase()}
            </div>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{user}</span>
          </div>
        )}

        <div style={{ height: 1, backgroundColor: '#2A3050' }} />

        <div style={{ flex: 1, overflowY: 'auto', paddingTop: 8 }}>
          {NAV_ITEMS.map(item => (
            <div
              key={item.id}
              onClick={() => { onNavigate(item.id); onClose(); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 20px',
                cursor: 'pointer',
                borderLeft: active === item.id ? `3px solid ${C.accent}` : '3px solid transparent',
                backgroundColor: active === item.id ? '#252B48' : 'transparent',
              }}
            >
              <span style={{ fontSize: 18, width: 26 }}>{item.icon}</span>
              <span style={{
                fontSize: 13,
                color: active === item.id ? '#fff' : '#A0A8D0',
                fontWeight: active === item.id ? 700 : 400,
              }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        <div style={{ padding: '0 20px 16px' }}>
          <div style={{ height: 1, backgroundColor: '#2A3050', marginBottom: 16 }} />
          <div onClick={() => setShowParrain(true)} style={{ backgroundColor: '#252B48', border: '1px solid #2A3050', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>📲</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>Recommander l'app</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{nbFilleuls} personne{nbFilleuls > 1 ? 's' : ''} invitée{nbFilleuls > 1 ? 's' : ''}</div>
            </div>
            {nbFilleuls > 0 && <span style={{ backgroundColor: '#1D9E75', color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{nbFilleuls}</span>}
          </div>

          {/* Modal Parrainage */}
          {showParrain && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              <div style={{ backgroundColor: '#1A1D27', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 480 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>📲 Recommander BeautyCRM</div>
                  <button onClick={() => setShowParrain(false)} style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: 22, cursor: 'pointer' }}>×</button>
                </div>

                {/* Stats */}
                <div style={{ backgroundColor: '#252B48', borderRadius: 12, padding: '16px', marginBottom: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 700, color: '#1D9E75' }}>{nbFilleuls}</div>
                  <div style={{ color: '#9CA3AF', fontSize: 13 }}>personne{nbFilleuls > 1 ? 's' : ''} invitée{nbFilleuls > 1 ? 's' : ''} grâce à toi</div>
                </div>

                {/* Code */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ color: '#9CA3AF', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>TON CODE DE PARRAINAGE</div>
                  <div style={{ backgroundColor: '#252B48', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#1D9E75', fontFamily: 'monospace', fontWeight: 700, fontSize: 18 }}>{code || '—'}</span>
                    <button onClick={() => { navigator.clipboard.writeText(link); alert('Lien copié !') }} style={{ backgroundColor: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Copier lien</button>
                  </div>
                </div>

                {/* Boutons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button onClick={() => {
                    const msg = `👋 Tu cherches une app pour gérer tes contacts, clients et ventes dans le MLM ?

💄 *BeautyCRM* par IZIsoft — 100% gratuit, fonctionne sans internet !

✅ Gestion clients & contacts
✅ Suivi des ventes & marges
✅ Agenda & rendez-vous
✅ Rapports automatiques

📲 Installe-la ici : ${link}`
                    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank')
                  }} style={{ backgroundColor: '#25D366', color: '#fff', border: 'none', borderRadius: 12, padding: '14px', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
                    Partager sur WhatsApp
                  </button>
                  <button onClick={() => {
                    const msg = `👋 Tu cherches une app pour gérer tes contacts, clients et ventes dans le MLM ?

💄 *BeautyCRM* par IZIsoft — 100% gratuit, fonctionne sans internet !

✅ Gestion clients & contacts
✅ Suivi des ventes & marges
✅ Agenda & rendez-vous
✅ Rapports automatiques

📲 Installe-la ici : ${link}`
                    navigator.clipboard.writeText(msg).then(() => alert('Message copié !'))
                  }} style={{ backgroundColor: '#252B48', color: '#fff', border: '1px solid #2A3050', borderRadius: 12, padding: '14px', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                    Copier le message
                  </button>
                </div>
              </div>
            </div>
          )}
          <div style={{ color: '#A0A8D0', fontSize: 11, textAlign: 'center' }}>
            V2.1 © 2026 IZIsoft
          </div>
        </div>
      </div>
    </>
  );
};

const Header = ({ title, onMenu, user }) => {
  const isOnline = useNetwork();
  return (
    <div style={{
      backgroundColor: C.card_bg,
      borderBottom: `1px solid ${C.card_border}`,
      display: 'flex',
      alignItems: 'center',
      padding: '10px 14px',
      gap: 12,
      minHeight: 56,
      position: "fixed",
      left: 0,
      right: 0,
      top: 0,
      zIndex: 100,
    }}>
      <div onClick={onMenu} style={{ cursor: 'pointer', padding: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {[24, 18, 24].map((w, i) => (
          <div key={i} style={{ width: w, height: 2, backgroundColor: C.text_primary, borderRadius: 2 }} />
        ))}
      </div>
      <span style={{ flex: 1, fontWeight: 700, fontSize: 16, color: C.text_primary }}>{title}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: isOnline ? C.success : C.danger,
        }} title={isOnline ? 'En ligne' : 'Hors ligne'} />
        <span style={{ fontSize: 10, color: C.text_secondary }}>
          {new Date().toLocaleDateString('fr-FR')}
        </span>
      </div>
    </div>
  );
};

const BottomNav = ({ active, onNavigate }) => (
  <div style={{
    position: 'fixed',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTop: `1px solid ${C.card_border}`,
    display: 'flex',
    zIndex: 100,
    maxWidth: '100%',
    margin: '0 auto',
  }}>
    {BOTTOM_NAV.map(item => (
      <div
        key={item.id}
        onClick={() => onNavigate(item.id)}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '10px 0 8px',
          cursor: 'pointer',
          gap: 2,
        }}
      >
        <span style={{ fontSize: 20 }}>{item.icon}</span>
        <span style={{ fontSize: 9, color: active === item.id ? C.accent : C.text_secondary, fontWeight: active === item.id ? 700 : 400 }}>
          {item.label}
        </span>
        {active === item.id && (
          <div style={{ width: 18, height: 3, backgroundColor: C.accent, borderRadius: 2 }} />
        )}
      </div>
    ))}
  </div>
);

export const Layout = ({ page, onNavigate, user, children, autoSyncing, hideHeader }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { updateAvailable, applyUpdate } = useUpdateSW();

  return (
    <div style={{ backgroundColor: C.page_bg, minHeight: '100vh', maxWidth: '100%', margin: '0 auto', position: 'relative' }}>
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onNavigate={onNavigate} active={page} user={user} />
      {!hideHeader && <Header title={PAGE_TITLES[page]} onMenu={() => setDrawerOpen(true)} user={user} />}

      {autoSyncing && (
        <div style={{
          backgroundColor: C.accent + '15',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '4px 0', gap: 6,
        }}>
          <span style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}>Synchronisation en cours...</span>
        </div>
      )}

      {updateAvailable && (
        <div style={{
          backgroundColor: C.warning + '20',
          borderBottom: `1px solid ${C.warning}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 14px',
        }}>
          <span style={{ fontSize: 12, color: C.text_primary, fontWeight: 600 }}>
            Mise a jour disponible
          </span>
          <button onClick={applyUpdate} style={{
            backgroundColor: C.warning,
            color: '#fff', border: 'none', borderRadius: 8,
            padding: '4px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer',
          }}>
            Mettre a jour
          </button>
        </div>
      )}

      <div style={{ paddingBottom: 80, paddingTop: hideHeader ? 0 : 56 }}>
        {children}
      </div>

      {!hideHeader && <BottomNav active={page} onNavigate={onNavigate} />}
    </div>
  );
};
