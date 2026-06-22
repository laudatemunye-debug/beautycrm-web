import { useState, useEffect, useCallback } from 'react';
import { C } from '../theme';
import { getProduits, saveProduit, deleteProduit } from '../db/index';
import { Card, SearchBar, SectionTitle, PrimaryBtn, FieldInput, Modal, FormFooter, fmtMoney } from '../components/UI';

const ProduitForm = ({ produit, onClose, onSaved }) => {
  const [form, setForm] = useState({
    nom: produit?.nom || '',
    prix_achat: produit?.prix_achat ? String(produit.prix_achat) : '',
    prix_vente: produit?.prix_vente ? String(produit.prix_vente) : '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setError('');
    if (!form.nom.trim()) { setError('Le nom est obligatoire.'); return; }
    setLoading(true);
    try {
      if (!produit) {
        const all = await getProduits();
        const dup = all.find(p => p.nom.toLowerCase() === form.nom.toLowerCase().trim());
        if (dup) { setError('Un produit avec ce nom existe deja.'); setLoading(false); return; }
      }
      await saveProduit({
        _id: produit?._id,
        nom: form.nom.trim(),
        prix_achat: parseFloat(form.prix_achat) || null,
        prix_vente: parseFloat(form.prix_vente) || null,
      });
      onSaved();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const marge = (parseFloat(form.prix_vente)||0) - (parseFloat(form.prix_achat)||0);
  const pct = parseFloat(form.prix_vente) ? Math.round(marge / parseFloat(form.prix_vente) * 100) : 0;

  return (
    <Modal visible onClose={onClose} title={produit ? 'Modifier produit' : 'Nouveau produit'}>
      <div style={{ padding: 16 }}>
        {error && <div style={{ color: C.danger, backgroundColor: C.danger+'15', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13 }}>{error}</div>}
        <FieldInput label="Nom du produit *" value={form.nom} onChange={v => setForm(f=>({...f,nom:v}))} placeholder="Ex: Creme hydratante" />
        <FieldInput label="Prix d'achat (votre cout)" value={form.prix_achat} onChange={v => setForm(f=>({...f,prix_achat:v}))} type="number" />
        <FieldInput label="Prix de vente" value={form.prix_vente} onChange={v => setForm(f=>({...f,prix_vente:v}))} type="number" />
        {form.prix_vente && (
          <div style={{ backgroundColor: C.success+'15', borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.text_secondary }}>Marge prevue</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: C.success }}>{fmtMoney(marge)} ({pct}%)</div>
          </div>
        )}
      </div>
      <FormFooter onSave={save} onClose={onClose} loading={loading} />
    </Modal>
  );
};

export const ProduitsPage = () => {
  const [produits, setProduits] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProduit, setEditProduit] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getProduits();
    setProduits(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const del = (p) => {
    if (!window.confirm(`Supprimer ${p.nom} ?`)) return;
    deleteProduit(p._id).then(load);
  };

  const filtered = produits.filter(p =>
    p.nom.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '14px', paddingBottom: 80, width: '100%', boxSizing: 'border-box' }}>
      <SearchBar value={search} onChange={setSearch} placeholder="Rechercher un produit..." />
      <PrimaryBtn label="+ Nouveau produit" onClick={() => { setEditProduit(null); setShowForm(true); }} style={{ marginBottom: 14 }} />
      <SectionTitle title={`${filtered.length} produit(s)`} />

      {loading
        ? <div style={{ textAlign: 'center', padding: 40, color: C.text_secondary }}>Chargement...</div>
        : filtered.length === 0
          ? <div style={{ textAlign:'center', padding:40 }}>
              <div style={{ fontSize:40, marginBottom:10 }}>📦</div>
              <div style={{ fontSize:14, color:C.text_secondary, marginBottom:16 }}>Aucun produit dans votre catalogue.</div>
              <button onClick={() => { setEditProduit(null); setShowForm(true); }} style={{ backgroundColor:C.accent, color:'#fff', border:'none', borderRadius:12, padding:'12px 24px', fontWeight:700, fontSize:14, cursor:'pointer' }}>+ Ajouter un produit</button>
            </div>
          : filtered.map(p => {
            const marge = (p.prix_vente||0) - (p.prix_achat||0);
            const pct = p.prix_vente ? Math.round(marge / p.prix_vente * 100) : 0;
            return (
              <div key={p._id} style={{ marginBottom: 10 }}>
                <Card>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      backgroundColor: C.pink+'15',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22,
                    }}>📦</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: C.text_primary }}>{p.nom}</div>
                      <div style={{ fontSize: 11, color: C.text_secondary, marginTop: 2 }}>
                        Achat : {fmtMoney(p.prix_achat)} · Vente : {fmtMoney(p.prix_vente)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: C.success }}>{pct}%</div>
                      <div style={{ fontSize: 10, color: C.text_secondary }}>marge</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <button onClick={() => { setEditProduit(p); setShowForm(true); }} style={{ backgroundColor: C.accent, border: 'none', borderRadius: 7, width: 28, height: 28, cursor: 'pointer', color: '#fff' }}>✏</button>
                        <button onClick={() => del(p)} style={{ backgroundColor: C.danger, border: 'none', borderRadius: 7, width: 28, height: 28, cursor: 'pointer', color: '#fff' }}>🗑</button>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })
      }

      {showForm && (
        <ProduitForm
          produit={editProduit}
          onClose={() => { setShowForm(false); setEditProduit(null); }}
          onSaved={() => { setShowForm(false); setEditProduit(null); load(); }}
        />
      )}
    </div>
  );
};
