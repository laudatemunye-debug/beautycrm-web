import { useState, useEffect, useCallback } from 'react';
import { C } from '../theme';
import { getVentes, getClients, saveVente, getProduits, today, deleteVente } from '../db/index';
import { Card, SearchBar, SectionTitle, PrimaryBtn, FieldInput, PickerSelect, Modal, FormFooter, Badge, fmtMoney, fmtDate } from "../components/UI";
import { useDevise } from "../hooks/useDevise";

const VenteRapideForm = ({ onClose, onSaved, venteEdit, onNavigate }) => {
  const [clients, setClients] = useState([]);
  const [produits, setProduits] = useState([]);
  const [clientNomSelected, setClientNomSelected] = useState("");

  const [form, setForm] = useState({ produit: '', prix_achat: '', prix_vente: '', quantite: '1', methode: 'Cash', notes: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getClients().then(cs => {
      setClients(cs);
      if (venteEdit) {
        const cl = cs.find(c => c._id === venteEdit.client_id);
        if (cl) setClientNomSelected(cl.nom);
      }
    });
    getProduits().then(setProduits);
    if (venteEdit) {
      setForm({
        produit: venteEdit.produit || '',
        prix_achat: String(venteEdit.prix_achat ?? ''),
        prix_vente: String(venteEdit.prix_vente ?? ''),
        quantite: String(venteEdit.quantite ?? '1'),
        methode: venteEdit.methode_paiement || 'Cash',
        notes: venteEdit.notes || '',
      });
    }
  }, []);

  const onProduitChange = (nom) => {
    const p = produits.find(x => x.nom === nom);
    setForm(f => ({
      ...f, produit: nom,
      prix_achat: p?.prix_achat ? String(p.prix_achat) : f.prix_achat,
      prix_vente: p?.prix_vente ? String(p.prix_vente) : f.prix_vente,
    }));
  };

  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async () => {
    if (!venteEdit) return;
    setLoading(true);
    try {
      await deleteVente(venteEdit._id);
      onSaved();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const save = async () => {
    setError('');
    const clientFound = clients.find(c => c.nom === clientNomSelected);
    if (!clientFound) { setError("Choisissez un client."); return; }
    const clientId = clientFound._id;
    if (!form.produit.trim()) { setError('Choisissez un produit.'); return; }
    const pv = parseFloat(form.prix_vente);
    if (!pv || pv <= 0) { setError('Prix de vente invalide.'); return; }
    setLoading(true);
    try {
      await saveVente({
        ...(venteEdit ? { _id: venteEdit._id } : {}),
        client_id: clientId,
        produit: form.produit,
        quantite: parseInt(form.quantite) || 1,
        prix_achat: parseFloat(form.prix_achat) || 0,
        prix_vente: pv,
        date_vente: venteEdit ? venteEdit.date_vente : today(),
        methode_paiement: form.methode,
        notes: form.notes,
      });
      onSaved();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible onClose={onClose} title={venteEdit ? "Modifier la vente" : "Vente rapide"}>
      <div style={{ padding: 16 }}>
        {error && <div style={{ color: C.danger, backgroundColor: C.danger+'15', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13 }}>{error}</div>}
        <PickerSelect label="Client *" value={clientNomSelected} onChange={setClientNomSelected} options={clients.length === 0 ? ["Aucun client enregistre"] : ["", ...clients.map(c => c.nom)]} />
        {clients.length === 0 && (
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10, marginTop:-8 }}><button onClick={onClose} style={{ background:'#3D5AFE', color:'#fff', border:'none', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:700, cursor:'pointer' }} onClick={() => { onClose(); onNavigate && onNavigate('clients'); }}>+ Ajouter un client</button></div>
        )}
        {clientNomSelected && (
          <div style={{ fontSize: 12, color: C.accent, marginBottom: 10, fontWeight: 600 }}>
            {clientNomSelected}
          </div>
        )}
        <PickerSelect label="Produit *" value={form.produit} onChange={onProduitChange} options={produits.length === 0 ? ["Aucun produit enregistre"] : ['', ...produits.map(p => p.nom)]} />
        {produits.length === 0 && (
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10, marginTop:-8 }}><button onClick={onClose} style={{ background:'#3D5AFE', color:'#fff', border:'none', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:700, cursor:'pointer' }} onClick={() => { onClose(); onNavigate && onNavigate('produits'); }}>+ Ajouter un produit</button></div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><FieldInput label="Prix achat" value={form.prix_achat} onChange={v => setForm(f=>({...f,prix_achat:v}))} type="number" /></div>
          <div style={{ flex: 1 }}><FieldInput label="Prix vente *" value={form.prix_vente} onChange={v => setForm(f=>({...f,prix_vente:v}))} type="number" /></div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><FieldInput label="Quantite" value={form.quantite} onChange={v => setForm(f=>({...f,quantite:v}))} type="number" /></div>
          <div style={{ flex: 1 }}><PickerSelect label="Paiement" value={form.methode} onChange={v => setForm(f=>({...f,methode:v}))} options={['Cash','Mobile Money','Virement','Credit','Autre']} /></div>
        </div>
        {form.prix_vente && (
          <div style={{ backgroundColor: C.success+'15', borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.text_secondary }}>Total</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: C.success }}>
              {fmtMoney((parseFloat(form.prix_vente)||0) * (parseInt(form.quantite)||1))}
            </div>
          </div>
        )}
      </div>
      {confirmDelete ? (
        <div style={{ padding: 16, borderTop: '1px solid '+C.card_border }}>
          <div style={{ fontSize: 13, color: C.danger, marginBottom: 10, fontWeight: 600 }}>Supprimer cette vente ?</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid '+C.card_border, background: '#fff', fontWeight: 700, fontSize: 13 }}>Annuler</button>
            <button onClick={handleDelete} disabled={loading} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: C.danger, color: '#fff', fontWeight: 700, fontSize: 13 }}>{loading ? '...' : 'Confirmer'}</button>
          </div>
        </div>
      ) : (
        <>
          <FormFooter onSave={save} onClose={onClose} loading={loading} saveColor={C.success} saveLabel="Enregistrer" />
          {venteEdit && (
            <div style={{ padding: '0 16px 16px' }}>
              <button onClick={() => setConfirmDelete(true)} style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid '+C.danger, background: 'transparent', color: C.danger, fontWeight: 700, fontSize: 13 }}>Supprimer cette vente</button>
            </div>
          )}
        </>
      )}
    </Modal>
  );
};

export const VentesPage = ({ onNavigate }) => {
  const [ventes, setVentes] = useState([]);
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingVente, setEditingVente] = useState(null);
  const devise = useDevise();

  const load = useCallback(async () => {
    setLoading(true);
    const [v, c] = await Promise.all([getVentes(), getClients()]);
    setVentes(v);
    setClients(c);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const getClientNom = (id) => clients.find(c => c._id === id)?.nom || 'Inconnu';

  const filtered = ventes.filter(v =>
    getClientNom(v.client_id).toLowerCase().includes(search.toLowerCase()) ||
    (v.produit || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalCA = filtered.reduce((s,v) => s + v.prix_vente * v.quantite, 0);
  const totalMarge = filtered.reduce((s,v) => s + (v.prix_vente - v.prix_achat) * v.quantite, 0);

  const exportCSV = () => {
    const header = 'Date,Client,Produit,Quantite,Prix achat,Prix vente,Marge,Paiement\n';
    const rows = filtered.map(v => [
      v.date_vente,
      getClientNom(v.client_id),
      v.produit,
      v.quantite,
      v.prix_achat,
      v.prix_vente,
      (v.prix_vente - v.prix_achat) * v.quantite,
      v.methode_paiement,
    ].map(x => `"${String(x??'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ventes_${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: '14px', paddingBottom: 80, width: '100%', boxSizing: 'border-box' }}>
      <div style={{ backgroundColor: C.accent, borderRadius: 14, padding: 16, marginBottom: 14, color: '#fff' }}>
        <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>CA total · Marge</div>
        <div style={{ fontWeight: 800, fontSize: 20 }}>{fmtMoney(totalCA)} · {fmtMoney(totalMarge)}</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <PrimaryBtn label="⚡ Vente rapide" onClick={() => setShowForm(true)} style={{ flex: 1 }} />
        <button onClick={exportCSV} style={{
          backgroundColor: C.success+'20', border: `1px solid ${C.success}40`,
          borderRadius: 12, padding: '13px 16px', color: C.success,
          fontWeight: 700, fontSize: 12, cursor: 'pointer',
        }}>⬇ CSV</button>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Chercher client ou produit..." />
      <SectionTitle title={`${filtered.length} vente(s)`} />

      {loading
        ? <div style={{ textAlign: 'center', padding: 40, color: C.text_secondary }}>Chargement...</div>
        : filtered.length === 0
          ? <div style={{ textAlign: 'center', padding: 40, color: C.text_secondary, fontSize: 13 }}>Aucune vente enregistree.</div>
          : filtered.map(v => (
            <div key={v._id} style={{ marginBottom: 10 }} onClick={() => setEditingVente(v)}>
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 4, cursor: 'pointer' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.text_primary }}>{getClientNom(v.client_id)}</div>
                    <div style={{ fontSize: 11, color: C.text_secondary, marginTop: 2 }}>{v.produit} ×{v.quantite}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                      <Badge label={v.methode_paiement} color={C.accent} />
                      <span style={{ fontSize: 11, color: C.text_secondary }}>{fmtDate(v.date_vente)}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.success }}>{fmtMoney(v.prix_vente * v.quantite)}</div>
                    <div style={{ fontSize: 11, color: C.success }}>+{fmtMoney((v.prix_vente - v.prix_achat) * v.quantite)}</div>
                  </div>
                </div>
              </Card>
            </div>
          ))
      }

      {showForm && (
        <VenteRapideForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} onNavigate={onNavigate} />
      )}
      {editingVente && (
        <VenteRapideForm
          venteEdit={editingVente}
          onClose={() => setEditingVente(null)}
          onSaved={() => { setEditingVente(null); load(); }}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
};
