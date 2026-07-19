import { useState } from 'react';
import { C } from '../theme';
import { getAccounts, setActiveAccountId, removeAccount } from '../hooks/useAccounts';
import { deleteAccountDB } from '../db/index';
import { useGoogle } from '../hooks/useGoogle';

const Avatar = ({ nom, size = 48 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    background: `linear-gradient(135deg, ${C.accent} 0%, ${C.accent2} 100%)`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: 800, fontSize: size * 0.4, flexShrink: 0,
  }}>
    {(nom || '?').charAt(0).toUpperCase()}
  </div>
);

export const AccountSelectorPage = ({ onSelect, onAddAccount }) => {
  const [accounts, setAccounts] = useState(() => getAccounts());
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const { deleteBackup } = useGoogle();

  const handleSelect = (acc) => {
    setActiveAccountId(acc.id);
    onSelect(acc);
  };

  const handleDelete = async (acc) => {
    setDeleting(true);
    try {
      // 1. Activer le compte a supprimer pour acceder a sa DB et son Drive
      setActiveAccountId(acc.id);
      // 2. Supprimer le fichier Drive
      await deleteBackup();
      // 3. Supprimer la DB locale
      await deleteAccountDB(acc.id);
      // 4. Retirer du registre
      removeAccount(acc.id);
      setAccounts(getAccounts());
    } catch(e) {
      console.error('Erreur suppression:', e);
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.sidebar_bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 24, padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 12px' }}>💄</div>
          <div style={{ fontWeight: 800, fontSize: 20, color: C.text_primary }}>BeautyCRM</div>
          <div style={{ fontSize: 13, color: C.text_secondary, marginTop: 4 }}>Choisissez un compte</div>
        </div>

        {accounts.map(acc => (
          <div
            key={acc.id}
            onClick={() => handleSelect(acc)}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              backgroundColor: C.input_bg, border: `1px solid ${C.input_border}`,
              borderRadius: 14, padding: '12px 14px', marginBottom: 10, cursor: 'pointer',
              transition: 'border-color .15s ease, background-color .15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.input_border; }}
          >
            <Avatar nom={acc.nom} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.text_primary }}>{acc.nom}</div>
              {acc.email && <div style={{ fontSize: 12, color: C.text_secondary, marginTop: 2 }}>{acc.email}</div>}
              {acc.entreprise && <div style={{ fontSize: 11, color: C.accent, marginTop: 2 }}>{acc.entreprise}</div>}
            </div>
            <button
              onClick={e => { e.stopPropagation(); setConfirmDelete(acc); }}
              style={{ background:'transparent', border:'none', color:'#ccc', fontSize:20, cursor:'pointer', padding:'4px 8px', flexShrink:0 }}
            >✕</button>
          </div>
        ))}

        {accounts.length === 0 && (
          <div style={{ textAlign: 'center', color: C.text_secondary, fontSize: 13, marginBottom: 14 }}>
            Aucun compte. Créez votre premier compte.
          </div>
        )}

        {accounts.length < 3 && (
          <button
            onClick={onAddAccount}
            style={{
              margin: accounts.length > 0 ? '6px auto 0' : '0 auto', padding: '8px 16px', borderRadius: 10, border: 'none',
              backgroundColor: C.accent, color: '#fff', fontWeight: 600, fontSize: 12,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 6,
            }}
          >
            <span style={{ fontSize: 18 }}>+</span>
            Ajouter un compte {accounts.length > 0 ? `(${accounts.length}/3)` : ''}
          </button>
        )}
      </div>

      {confirmDelete && (
        <div style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:24, zIndex:1000 }}>
          <div style={{ backgroundColor:'#fff', borderRadius:20, padding:24, width:'100%', maxWidth:360, textAlign:'center' }}>
            <div style={{ fontWeight:800, fontSize:17, color:C.danger, marginBottom:8 }}>Supprimer le compte</div>
            <div style={{ fontSize:13, color:'#555', marginBottom:20, lineHeight:1.6 }}>
              Supprimer <strong>{confirmDelete.nom}</strong> ?<br/>
              Toutes les données locales et sur Google Drive seront effacées définitivement.
            </div>
            <button onClick={() => handleDelete(confirmDelete)} disabled={deleting} style={{ width:'100%', padding:13, borderRadius:12, border:'none', backgroundColor:C.danger, color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', marginBottom:10, opacity: deleting ? 0.7 : 1 }}>
              {deleting ? 'Suppression...' : 'Oui, supprimer'}
            </button>
            <button onClick={() => setConfirmDelete(null)} disabled={deleting} style={{ width:'100%', padding:13, borderRadius:12, border:'1px solid #ddd', backgroundColor:'#fff', color:'#555', fontWeight:600, fontSize:14, cursor:'pointer' }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 24, textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 1.8 }}>
        La gestion de ton business devient facile,<br />tout au meme endroit dans ton smartphone
      </div>
    </div>
  );
};
