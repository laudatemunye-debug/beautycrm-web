import { useState } from 'react';
import { C } from '../theme';
import { Modal } from './UI';
import { FieldInput, PrimaryBtn } from './UI';

export const EmployesModal = ({ visible, onClose, bizMode }) => {
  const [empListTab, setEmpListTab] = useState('actifs');
  const [showNouvelEmployeModal, setShowNouvelEmployeModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newNom, setNewNom] = useState('');
  const [newPoste, setNewPoste] = useState('vendeur');
  const [codeCombine, setCodeCombine] = useState('');
  const [codeError, setCodeError] = useState('');
  const [codeGenere, setCodeGenere] = useState(false);

  const handleGenererCode = async () => {
    setCodeError('');
    setCodeGenere(false);
    try {
      const nouveauCode = await bizMode.genererCode(newPoste);
      setCodeCombine(nouveauCode);
      setCodeGenere(true);
    } catch(e) {
      setCodeError(e.message);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible fullscreen onClose={onClose} title="Employes">
      <div style={{ padding: 16 }}>
        <div style={{ display:'flex', gap:8, marginBottom:16 }}>
          <button onClick={() => setShowNouvelEmployeModal(true)} style={{ flex:1, padding:'10px 8px', borderRadius:10, border:'none', backgroundColor: C.success, color: '#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
            + Nouvel employé
          </button>
          <button onClick={() => setEmpListTab('actifs')} style={{ flex:1, padding:'10px 8px', borderRadius:10, border:'none', backgroundColor: empListTab==='actifs' ? C.accent : C.card_bg, color: empListTab==='actifs' ? '#fff' : C.text_primary, fontWeight:700, fontSize:13, cursor:'pointer' }}>
            Employes actifs ({bizMode.employes.length})
          </button>
          <button onClick={() => { setEmpListTab('voles'); bizMode.refreshEmployesVoles(); }} style={{ flex:1, padding:'10px 8px', borderRadius:10, border:'none', backgroundColor: empListTab==='voles' ? '#E8A33D' : C.card_bg, color: empListTab==='voles' ? '#fff' : C.text_primary, fontWeight:700, fontSize:13, cursor:'pointer' }}>
            Vole/Perdu ({bizMode.employesVoles.length})
          </button>
          <button onClick={() => { setEmpListTab('anciens'); bizMode.refreshEmployesRevoques(); }} style={{ flex:1, padding:'10px 8px', borderRadius:10, border:'none', backgroundColor: empListTab==='anciens' ? C.accent : C.card_bg, color: empListTab==='anciens' ? '#fff' : C.text_primary, fontWeight:700, fontSize:13, cursor:'pointer' }}>
            Anciens employes
          </button>
        </div>

        {showNouvelEmployeModal && (
          <Modal visible onClose={() => { setShowNouvelEmployeModal(false); setCodeGenere(false); setCodeCombine(''); setNewNom(''); }} title="Nouvel employé">
          <div style={{ padding: 16 }}>
            <FieldInput label="Nom de l'employé" value={newNom} onChange={v => setNewNom(v)} placeholder="Nom complet" />
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: C.text_secondary, fontWeight: 600, marginBottom: 6 }}>Rôle</div>
              <div style={{ display:'flex', gap:8 }}>
                {['vendeur','gestionnaire'].map(r => (
                  <button key={r} onClick={() => setNewPoste(r)} style={{
                    flex:1, padding:'10px 8px', borderRadius:10, border:'none',
                    backgroundColor: newPoste===r ? C.accent : C.card_bg,
                    color: newPoste===r ? '#fff' : C.text_primary,
                    fontWeight:700, fontSize:13, cursor:'pointer'
                  }}>{r.charAt(0).toUpperCase()+r.slice(1)}</button>
                ))}
              </div>
            </div>
            {codeError && <div style={{ color: C.danger, fontSize: 13, marginBottom: 10 }}>{codeError}</div>}
            {codeGenere && codeCombine && (
              <div style={{ background: C.accent+'15', border:`1px solid ${C.accent}40`, borderRadius:12, padding:16, marginBottom:14, textAlign:'center' }}>
                <div style={{ fontSize:11, color:C.text_secondary, marginBottom:6 }}>Code à transmettre à l'employé</div>
                <div style={{ fontWeight:800, fontSize:22, color:C.accent, letterSpacing:3 }}>{codeCombine}</div>
                <button onClick={() => {
                  navigator.clipboard?.writeText(codeCombine).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }} style={{ marginTop:8, background: copied ? C.accent : 'transparent', border: '1px solid '+C.accent, borderRadius: 8, width: 34, height: 34, cursor:'pointer', fontSize:15, display:'flex', alignItems:'center', justifyContent:'center', color: copied ? '#fff' : C.accent, margin: '8px auto 0' }}>
                  {copied ? '✓' : '📋'}
                </button>
              </div>
            )}
            <PrimaryBtn label={codeGenere ? "Regénérer un code" : "Générer le code"} onClick={handleGenererCode} />
          </div>
          </Modal>
        )}

        {empListTab === 'actifs' && (
          bizMode.employes.length === 0 ? (
            <div style={{ fontSize: 13, color: C.text_secondary, textAlign:'center', padding: 40 }}>Aucun employe connecte.</div>
          ) : (
            bizMode.employes.map(emp => (
              <div key={emp.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 0', borderBottom:'1px solid '+C.card_border }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{emp.nom}</div>
                  <div style={{ fontSize: 12, color: C.text_secondary, marginTop: 2 }}>{emp.poste}</div>
                </div>
              </div>
            ))
          )
        )}

        {empListTab === 'voles' && (
          bizMode.employesVoles.length === 0 ? (
            <div style={{ fontSize: 13, color: C.text_secondary, textAlign:'center', padding: 40 }}>Aucun employe marque vole/perdu.</div>
          ) : (
            bizMode.employesVoles.map(emp => {
              const expired = !emp.vole_code_expiry || emp.vole_code_expiry < Date.now();
              return (
                <div key={emp.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 0', borderBottom:'1px solid '+C.card_border }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{emp.nom}</div>
                    <div style={{ fontSize: 12, color: C.text_secondary, marginTop: 2 }}>{emp.poste}</div>
                    <div style={{ fontSize: 11, color: expired ? C.danger : '#E8A33D', marginTop: 2, fontWeight:600 }}>
                      {expired ? 'Code expire' : 'Code actif'}
                    </div>
                  </div>
                </div>
              );
            })
          )
        )}

        {empListTab === 'anciens' && (
          bizMode.employesRevoques.length === 0 ? (
            <div style={{ fontSize: 13, color: C.text_secondary, textAlign:'center', padding: 40 }}>Aucun ancien employe.</div>
          ) : (
            bizMode.employesRevoques.map(emp => (
              <div key={emp.id} style={{ padding:'14px 0', borderBottom:'1px solid '+C.card_border }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{emp.nom}</div>
                  <div style={{ fontSize: 12, color: C.text_secondary }}>{emp.poste}</div>
                </div>
                <div style={{ fontSize: 12, color: C.text_secondary, marginTop: 4 }}>
                  Revoque le {emp.revoked_at ? new Date(emp.revoked_at).toLocaleDateString('fr-FR') : '—'}
                </div>
                {emp.motif_revocation && (
                  <div style={{ fontSize: 12, color: C.text_secondary, marginTop: 2 }}>Motif : {emp.motif_revocation}</div>
                )}
              </div>
            ))
          )
        )}
      </div>
    </Modal>
  );
};
