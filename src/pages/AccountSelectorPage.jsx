import { useState } from 'react';
import { C } from '../theme';
import { getAccounts, setActiveAccountId } from '../hooks/useAccounts';

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
  const [accounts] = useState(() => getAccounts());

  const handleSelect = (acc) => {
    setActiveAccountId(acc.id);
    onSelect(acc);
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

      <div style={{ marginTop: 24, textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 1.8 }}>
        La gestion de ton business devient facile,<br />tout au meme endroit dans ton smartphone
      </div>
    </div>
  );
};
