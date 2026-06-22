import { C } from '../theme';

export const Card = ({ children, style, onClick }) => (
  <div onClick={onClick} style={{
    backgroundColor: C.card_bg,
    borderRadius: 14,
    border: `1px solid ${C.card_border}`,
    padding: 14,
    overflow: 'hidden',

    ...style,
  }}>
    {children}
  </div>
);

const spinStyle = `
@keyframes primBtn-spin {
  to { transform: rotate(360deg); }
}
`;

export const PrimaryBtn = ({ label, onClick, color, style, disabled, loading }) => (
  <>
    <style>{`@keyframes primBtn-spin { to { transform: rotate(360deg); } }`}</style>
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        backgroundColor: disabled || loading ? (color || C.accent) + '80' : (color || C.accent),
        color: '#fff',
        border: 'none',
        borderRadius: 12,
        padding: '13px 16px',
        fontWeight: 700,
        fontSize: 14,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        transition: 'background-color 0.2s ease',
        ...style,
      }}
    >
      {loading ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 16, height: 16,
            border: '2px solid rgba(255,255,255,0.4)',
            borderTopColor: '#fff',
            borderRadius: '50%',
            display: 'inline-block',
            animation: 'primBtn-spin 0.7s linear infinite',
          }} />
          {label}
        </span>
      ) : label}
    </button>
  </>
);

export const GhostBtn = ({ label, onClick, style }) => (
  <button
    onClick={onClick}
    style={{
      backgroundColor: '#fff',
      color: C.text_secondary,
      border: `1px solid ${C.card_border}`,
      borderRadius: 12,
      padding: '12px 16px',
      fontWeight: 600,
      fontSize: 13,
      cursor: 'pointer',
      width: '100%',
      ...style,
    }}
  >
    {label}
  </button>
);

export const FieldInput = ({ label, value, onChange, placeholder, multiline, type }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <div style={{ fontSize: 11, color: C.text_secondary, fontWeight: 600, marginBottom: 6 }}>{label}</div>}
    {multiline ? (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || ''}
        rows={3}
        style={{
          backgroundColor: C.input_bg,
          border: `1px solid ${C.input_border}`,
          borderRadius: 10,
          padding: 13,
          fontSize: 14,
          color: C.text_primary,
          width: '100%',
          boxSizing: 'border-box',
          resize: 'vertical',
          fontFamily: 'inherit',
        }}
      />
    ) : (
      <input
        type={type || 'text'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || ''}
        style={{
          backgroundColor: C.input_bg,
          border: `1px solid ${C.input_border}`,
          borderRadius: 10,
          padding: 13,
          fontSize: 14,
          color: C.text_primary,
          width: '100%',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
        }}
      />
    )}
  </div>
);

export const SearchBar = ({ value, onChange, placeholder }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    backgroundColor: C.input_bg,
    border: `1px solid ${C.input_border}`,
    borderRadius: 12,
    padding: '0 12px',
    marginBottom: 14,
  }}>
    <span style={{ marginRight: 8, color: C.text_secondary }}>🔍</span>
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder || 'Rechercher...'}
      style={{
        flex: 1,

        border: 'none',
        background: 'transparent',
        fontSize: 13,
        color: C.text_primary,
        padding: '11px 0',
        outline: 'none',
        fontFamily: 'inherit',
      }}
    />
    {value && (
      <span onClick={() => onChange('')} style={{ cursor: 'pointer', color: C.text_light, fontSize: 18 }}>×</span>
    )}
  </div>
);

export const Badge = ({ label, color }) => (
  <span style={{
    backgroundColor: (color || C.accent) + '20',
    color: color || C.accent,
    borderRadius: 6,
    padding: '3px 8px',
    fontSize: 11,
    fontWeight: 600,
  }}>
    {label}
  </span>
);

export const Avatar = ({ nom, size = 40, color }) => (
  <div style={{
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: (color || C.accent) + '20',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }}>
    <span style={{ fontWeight: 700, color: color || C.accent, fontSize: size * 0.4 }}>
      {nom ? nom.charAt(0).toUpperCase() : '?'}
    </span>
  </div>
);

export const Divider = () => (
  <div style={{ height: 1, backgroundColor: C.card_border }} />
);

export const SectionTitle = ({ title, action, onAction }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
    <span style={{ fontWeight: 700, fontSize: 14, color: C.text_primary }}>{title}</span>
    {action && (
      <span onClick={onAction} style={{ color: C.accent, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
        {action}
      </span>
    )}
  </div>
);

export const PickerSelect = ({ label, value, onChange, options }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <div style={{ fontSize: 11, color: C.text_secondary, fontWeight: 600, marginBottom: 6 }}>{label}</div>}
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        backgroundColor: C.input_bg,
        border: `1px solid ${C.input_border}`,
        borderRadius: 10,
        padding: 13,
        fontSize: 14,
        color: C.text_primary,
        width: '100%',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
        cursor: 'pointer',
      }}
    >
      {options.map(opt => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  </div>
);

export const Modal = ({ visible, onClose, title, children }) => {
  if (!visible) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(26,31,54,0.55)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      padding: 0,
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '20px 20px 0 0',
        width: '100%',
        maxWidth: '100vw',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 16,
          borderBottom: `1px solid ${C.card_border}`,
        }}>
          <span style={{ fontWeight: 800, fontSize: 16, color: C.text_primary }}>{title}</span>
          <span onClick={onClose} style={{ fontSize: 22, cursor: 'pointer', color: C.text_secondary }}>×</span>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
};

export const FormFooter = ({ onSave, onClose, saveLabel, saveColor, loading }) => (
  <div style={{
    padding: 16,
    borderTop: `1px solid ${C.card_border}`,
    backgroundColor: C.page_bg,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  }}>
    <PrimaryBtn label={saveLabel || 'Enregistrer'} onClick={onSave} color={saveColor} loading={loading} />
    <GhostBtn label="Annuler" onClick={onClose} />
  </div>
);

export const KpiCard = ({ title, value, color, icon, onClick }) => (
  <div onClick={onClick} style={{
    backgroundColor: C.card_bg,
    borderRadius: 14,
    border: `1px solid ${C.card_border}`,
    padding: 14,
    flex: 1,

  }}>
    <div style={{ height: 3, backgroundColor: color, borderRadius: 2, marginBottom: 10 }} />
    <div style={{ fontSize: 22 }}>{icon}</div>
    <div style={{ fontSize: 11, color: C.text_secondary, marginTop: 4 }}>{title}</div>
    <div style={{ fontSize: 20, fontWeight: 800, color: C.text_primary, marginTop: 2 }}>{value}</div>
  </div>
);

// Variable globale devise
window.__DEVISE_SYMBOL__ = window.__DEVISE_SYMBOL__ || 'FC';

export const setDeviseSymbol = (symbol) => { window.__DEVISE_SYMBOL__ = symbol; };
export const getDeviseSymbol = () => window.__DEVISE_SYMBOL__ || 'FC';

export const fmtMoney = (v, symbol) => {
  symbol = symbol || window.__DEVISE_SYMBOL__ || "FC";
  const n = parseFloat(v) || 0;
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 0 }) + " " + symbol;
};

export const fmtDate = (d) => {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('fr-FR'); } catch { return d; }
};
