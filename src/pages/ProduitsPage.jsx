import { useState, useEffect, useCallback } from 'react';
import { useDevise } from '../hooks/useDevise';
import { C } from '../theme';
import { getProduits, saveProduit, deleteProduit, getTendances, addStock, saveApprovisionnement, getApprovisionnements, getVentes, today } from '../db/index';
import { SearchBar, SectionTitle, FieldInput, Modal, FormFooter, fmtMoney } from '../components/UI';

const ProduitForm = ({ produit, onClose, onSaved }) => {
  const [form, setForm] = useState({
    nom: produit?.nom || '',
    prix_achat: produit?.prix_achat ? String(produit.prix_achat) : '',
    prix_vente: produit?.prix_vente ? String(produit.prix_vente) : '',
    stock: produit?.stock != null ? String(produit.stock) : '',
    seuil_alerte: produit?.seuil_alerte != null ? String(produit.seuil_alerte) : '5',
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
        stock: form.stock === '' ? null : parseInt(form.stock) || 0,
        seuil_alerte: parseInt(form.seuil_alerte) || 5,
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
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><FieldInput label="Stock disponible" value={form.stock} onChange={v => setForm(f=>({...f,stock:v}))} type="number" placeholder="Ex: 20" /></div>
          <div style={{ flex: 1 }}><FieldInput label="Seuil alerte" value={form.seuil_alerte} onChange={v => setForm(f=>({...f,seuil_alerte:v}))} type="number" placeholder="Ex: 5" /></div>
        </div>
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

const ApprovForm = ({ produits, onClose, onSaved }) => {
  const [nom, setNom] = useState('');
  const [qte, setQte] = useState('');
  const [prixAchat, setPrixAchat] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const devise = useDevise();

  const produitSelectionne = produits.find(p => p.nom === nom) || null;
  const ancienPrix = produitSelectionne?.prix_achat ?? null;
  const nouveauPrix = parseFloat(prixAchat) || null;
  const prixEffectif = nouveauPrix || ancienPrix;
  const pv = produitSelectionne?.prix_vente ?? null;
  const marge = prixEffectif && pv ? pv - prixEffectif : null;
  const pct = marge != null && pv ? Math.round(marge / pv * 100) : null;

  const save = async () => {
    setError('');
    if (!nom) { setError('Choisissez un produit.'); return; }
    const q = parseInt(qte);
    if (!q || q <= 0) { setError('Quantite invalide.'); return; }
    setLoading(true);
    try {
      await addStock(nom, q);
      if (nouveauPrix && produitSelectionne) {
        await saveProduit({ ...produitSelectionne, prix_achat: nouveauPrix });
      }
      await saveApprovisionnement({
        produit: nom,
        quantite: q,
        prix_achat: prixEffectif || 0,
        date: today(),
      });
      onSaved();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible onClose={onClose} title="Approvisionnement">
      <div style={{ padding: 16 }}>
        {error && <div style={{ color: C.danger, backgroundColor: C.danger+'15', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13 }}>{error}</div>}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: C.text_secondary, marginBottom: 6 }}>Produit *</div>
          <select value={nom} onChange={e => setNom(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid '+C.border, fontSize: 14, backgroundColor: C.surface, color: C.text_primary, boxSizing: 'border-box' }}>
            <option value="">-- Choisir un produit --</option>
            {produits.map(p => <option key={p._id} value={p.nom}>{p.nom} (stock: {p.stock ?? '?'})</option>)}
          </select>
        </div>
        <FieldInput label="Quantite a ajouter *" value={qte} onChange={setQte} type="number" placeholder="Ex: 50" />
        <FieldInput label="Nouveau prix d'achat (optionnel)" value={prixAchat} onChange={setPrixAchat} type="number" placeholder={ancienPrix != null ? 'Actuel : '+ancienPrix+' '+devise : 'Ex: 500'} />
        {nom && prixEffectif && pv && (
          <div style={{ backgroundColor: nouveauPrix ? C.accent+'15' : C.success+'15', borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.text_secondary, marginBottom: 2 }}>
              {nouveauPrix ? 'Nouvelle marge apres reappro' : 'Marge actuelle'}
            </div>
            <div style={{ fontWeight: 800, fontSize: 16, color: nouveauPrix ? C.accent : C.success }}>
              {fmtMoney(marge)} ({pct}%)
            </div>
            {nouveauPrix && ancienPrix && (
              <div style={{ fontSize: 11, color: C.text_secondary, marginTop: 4 }}>
                Ancien prix achat : {ancienPrix} {devise} {'→'} Nouveau : {nouveauPrix} {devise}
              </div>
            )}
          </div>
        )}
      </div>
      <FormFooter onSave={save} onClose={onClose} loading={loading} />
    </Modal>
  );
};

const OngletProduit = ({ produits, topVendus, alertesStock, search, setSearch, onEdit, onDelete }) => {
  const filtered = produits.filter(p => p.nom.toLowerCase().includes(search.toLowerCase()));
  return (
    <div>
      <SearchBar value={search} onChange={setSearch} placeholder="Rechercher un produit..." />
      {alertesStock.length > 0 && (
        <div style={{ backgroundColor: C.danger+'15', borderRadius: 10, padding: 12, marginTop: 10, marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: C.danger, marginBottom: 4 }}>Stock bas ({alertesStock.length})</div>
          {alertesStock.map(p => (
            <div key={p._id} style={{ fontSize: 12, color: C.text_secondary }}>{p.nom} — {p.stock} restant(s)</div>
          ))}
        </div>
      )}
      <SectionTitle title={filtered.length+' produit(s)'} />
      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:30, color: C.text_secondary, fontSize: 13 }}>Aucun produit.</div>
      ) : (
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1.5px solid '+C.border }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', backgroundColor: C.accent+'18', borderBottom: '2px solid '+C.border }}>
            {['PRODUIT','ACHAT','VENTE','STOCK',''].map((col, ci) => (
              <div key={col+ci} style={{ fontSize: 11, fontWeight: 800, color: C.text_secondary, padding: '9px 10px', textAlign: ci === 0 ? 'left' : 'center', borderRight: ci < 4 ? '1px solid '+C.border : 'none' }}>{col}</div>
            ))}
          </div>
          {filtered.map((p, i) => {
            const stockBas = p.stock != null && p.stock <= (p.seuil_alerte ?? 5);
            const tendance = topVendus.includes(p.nom);
            const cellStyle = (ci) => ({ padding: '10px 10px', borderRight: ci < 4 ? '1px solid '+C.border : 'none', borderTop: '1px solid '+C.border, display: 'flex', alignItems: 'center', justifyContent: ci === 0 ? 'flex-start' : 'center', backgroundColor: i % 2 === 0 ? C.surface : C.accent+'05' });
            return (
              <div key={p._id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
                <div style={cellStyle(0)}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: C.text_primary }}>
                    {p.nom}{tendance && ' 🔥'}
                  </div>
                  {stockBas && <span style={{ marginLeft: 6, fontSize: 9, backgroundColor: C.danger+'20', color: C.danger, borderRadius: 5, padding: '1px 5px', fontWeight: 700 }}>bas</span>}
                </div>
                <div style={cellStyle(1)}><span style={{ fontSize: 12, color: C.text_secondary }}>{fmtMoney(p.prix_achat)}</span></div>
                <div style={cellStyle(2)}><span style={{ fontSize: 12, fontWeight: 600, color: C.text_primary }}>{fmtMoney(p.prix_vente)}</span></div>
                <div style={cellStyle(3)}><span style={{ fontSize: 13, fontWeight: 700, color: stockBas ? C.danger : C.text_primary }}>{p.stock != null ? p.stock : '—'}</span></div>
                <div style={cellStyle(4)}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => onEdit(p)} style={{ backgroundColor: C.accent, border: 'none', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', color: '#fff', fontSize: 12 }}>✏</button>
                    <button onClick={() => onDelete(p)} style={{ backgroundColor: C.danger, border: 'none', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', color: '#fff', fontSize: 12 }}>🗑</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const OngletHistorique = ({ approvisionnements }) => {
  const devise = useDevise();
  return (
    <div>
      <SectionTitle title={approvisionnements.length+' approvisionnement(s)'} />
      {approvisionnements.length === 0 ? (
        <div style={{ textAlign:'center', padding:30, color: C.text_secondary, fontSize: 13 }}>Aucun approvisionnement enregistre.</div>
      ) : (
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1.5px solid '+C.border }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.3fr 1fr 1fr', backgroundColor: C.accent+'18', borderBottom: '2px solid '+C.border }}>
            {['PRODUIT','DATE','QTE','PRIX ACHAT'].map((col, ci) => (
              <div key={col} style={{ fontSize: 11, fontWeight: 800, color: C.text_secondary, padding: '9px 10px', textAlign: ci === 0 ? 'left' : 'center', borderRight: ci < 3 ? '1px solid '+C.border : 'none' }}>{col}</div>
            ))}
          </div>
          {approvisionnements.map((a, i) => {
            const cellStyle = (ci) => ({ padding: '10px 10px', borderRight: ci < 3 ? '1px solid '+C.border : 'none', borderTop: '1px solid '+C.border, display: 'flex', alignItems: 'center', justifyContent: ci === 0 ? 'flex-start' : 'center', backgroundColor: i % 2 === 0 ? C.surface : C.accent+'05' });
            return (
              <div key={a._id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.3fr 1fr 1fr' }}>
                <div style={cellStyle(0)}><span style={{ fontWeight: 700, fontSize: 13, color: C.text_primary }}>{a.produit}</span></div>
                <div style={cellStyle(1)}><span style={{ fontSize: 12, color: C.text_secondary }}>{a.date}</span></div>
                <div style={cellStyle(2)}><span style={{ fontSize: 13, fontWeight: 700, color: C.text_primary }}>+{a.quantite}</span></div>
                <div style={cellStyle(3)}><span style={{ fontSize: 12, fontWeight: 600, color: C.text_primary }}>{a.prix_achat} {devise}</span></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const OngletBenefice = ({ produits, ventes }) => {
  const totaux = {};
  for (const v of ventes) {
    if (!totaux[v.produit]) totaux[v.produit] = { qte: 0, ca: 0, benefice: 0 };
    const q = v.quantite || 0;
    totaux[v.produit].qte += q;
    totaux[v.produit].ca += (v.prix_vente||0) * q;
    totaux[v.produit].benefice += ((v.prix_vente||0) - (v.prix_achat||0)) * q;
  }
  const lignes = Object.entries(totaux).sort((a,b) => b[1].benefice - a[1].benefice);
  const totalCA = lignes.reduce((s,[,t]) => s + t.ca, 0);
  const totalBenefice = lignes.reduce((s,[,t]) => s + t.benefice, 0);

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, backgroundColor: C.accent+'15', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: C.text_secondary }}>Chiffre d'affaires total</div>
          <div style={{ fontWeight: 800, fontSize: 16, color: C.accent }}>{fmtMoney(totalCA)}</div>
        </div>
        <div style={{ flex: 1, backgroundColor: C.success+'15', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: C.text_secondary }}>Benefice total</div>
          <div style={{ fontWeight: 800, fontSize: 16, color: C.success }}>{fmtMoney(totalBenefice)}</div>
        </div>
      </div>
      <SectionTitle title="Benefice par produit" />
      {lignes.length === 0 ? (
        <div style={{ textAlign:'center', padding:30, color: C.text_secondary, fontSize: 13 }}>Aucune vente enregistree.</div>
      ) : (
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1.5px solid '+C.border }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', backgroundColor: C.accent+'18', borderBottom: '2px solid '+C.border }}>
            {['PRODUIT','QTE VENDUE','CA','BENEFICE'].map((col, ci) => (
              <div key={col} style={{ fontSize: 11, fontWeight: 800, color: C.text_secondary, padding: '9px 10px', textAlign: ci === 0 ? 'left' : 'center', borderRight: ci < 3 ? '1px solid '+C.border : 'none' }}>{col}</div>
            ))}
          </div>
          {lignes.map(([nom, t], i) => {
            const cellStyle = (ci) => ({ padding: '10px 10px', borderRight: ci < 3 ? '1px solid '+C.border : 'none', borderTop: '1px solid '+C.border, display: 'flex', alignItems: 'center', justifyContent: ci === 0 ? 'flex-start' : 'center', backgroundColor: i % 2 === 0 ? C.surface : C.accent+'05' });
            return (
              <div key={nom} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
                <div style={cellStyle(0)}><span style={{ fontWeight: 700, fontSize: 13, color: C.text_primary }}>{nom}</span></div>
                <div style={cellStyle(1)}><span style={{ fontSize: 13, fontWeight: 700, color: C.text_primary }}>{t.qte}</span></div>
                <div style={cellStyle(2)}><span style={{ fontSize: 12, color: C.text_secondary }}>{fmtMoney(t.ca)}</span></div>
                <div style={cellStyle(3)}><span style={{ fontSize: 13, fontWeight: 800, color: C.success }}>{fmtMoney(t.benefice)}</span></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const MonStockPage = ({ produits, onClose, onEdit, onDelete, topVendus, alertesStock, search, setSearch }) => {
  const [tab, setTab] = useState('produit');
  const [approvisionnements, setApprovisionnements] = useState([]);
  const [ventes, setVentes] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    Promise.all([getApprovisionnements(), getVentes()]).then(([a, v]) => {
      setApprovisionnements(a);
      setVentes(v);
      setLoadingData(false);
    });
  }, []);

  const tabs = [
    { id: 'produit', label: 'Produit' },
    { id: 'historique', label: 'Historique appro.' },
    { id: 'benefice', label: 'Benefice' },
  ];

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: C.surface, zIndex: 500,
      overflowY: 'auto', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header propre avec bouton retour */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px',
        borderBottom: '1px solid ' + C.border,
        backgroundColor: C.card_bg,
        position: 'sticky', top: 0, zIndex: 10,
        minHeight: 56,
      }}>
        <button
          onClick={onClose}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            backgroundColor: C.accent + '15', border: 'none',
            borderRadius: 10, padding: '8px 14px',
            color: C.accent, fontWeight: 700, fontSize: 14,
            cursor: 'pointer',
          }}
        >
          ← Retour
        </button>
        <span style={{ flex: 1, fontWeight: 700, fontSize: 16, color: C.text_primary }}>Mon Stock</span>
      </div>

      {/* Contenu scrollable */}
      <div style={{ padding: 16, flex: 1, paddingBottom: 80 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: '9px 4px', borderRadius: 9, border: 'none',
              backgroundColor: tab === t.id ? C.accent : C.accent + '12',
              color: tab === t.id ? '#fff' : C.text_secondary,
              fontWeight: 700, fontSize: 11.5, cursor: 'pointer',
            }}>{t.label}</button>
          ))}
        </div>

        {loadingData ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.text_secondary }}>Chargement...</div>
        ) : tab === 'produit' ? (
          <OngletProduit produits={produits} topVendus={topVendus} alertesStock={alertesStock} search={search} setSearch={setSearch} onEdit={onEdit} onDelete={onDelete} />
        ) : tab === 'historique' ? (
          <OngletHistorique approvisionnements={approvisionnements} />
        ) : (
          <OngletBenefice produits={produits} ventes={ventes} />
        )}
      </div>
    </div>
  );
};

export const ProduitsPage = ({ onHideHeader }) => {
  const [produits, setProduits] = useState([]);
  const [tendances, setTendances] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProduit, setEditProduit] = useState(null);
  const [showApprov, setShowApprov] = useState(false);
  const [showMonStock, setShowMonStock] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [data, tend] = await Promise.all([getProduits(), getTendances(30)]);
    setProduits(data);
    setTendances(tend);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    onHideHeader?.(showMonStock);
  }, [showMonStock, onHideHeader]);

  const del = (p) => {
    if (!window.confirm('Supprimer '+p.nom+' ?')) return;
    deleteProduit(p._id).then(load);
  };

  const filtered = produits.filter(p => p.nom.toLowerCase().includes(search.toLowerCase()));
  const topVendus = Object.entries(tendances).sort((a,b) => b[1]-a[1]).slice(0,3).map(e => e[0]);
  const alertesStock = produits.filter(p => p.stock != null && p.stock <= (p.seuil_alerte ?? 5));

  return (
    <div style={{ padding: '14px', paddingBottom: 80, width: '100%', boxSizing: 'border-box' }}>
      {!showMonStock && (<>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button onClick={() => { setEditProduit(null); setShowForm(true); }} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', backgroundColor: C.accent, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Nouveau</button>
        <button onClick={() => setShowApprov(true)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1.5px solid '+C.accent, backgroundColor: C.surface, color: C.accent, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>📦 Approv.</button>
        <button onClick={() => setShowMonStock(true)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1.5px solid '+C.border, backgroundColor: C.accent+'15', color: C.text_primary, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Mon Stock</button>
      </div>
      <SearchBar value={search} onChange={setSearch} placeholder="Rechercher un produit..." />

      {alertesStock.length > 0 && (
        <div style={{ backgroundColor: C.danger+'15', borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: C.danger, marginBottom: 4 }}>Stock bas ({alertesStock.length})</div>
          {alertesStock.map(p => (
            <div key={p._id} style={{ fontSize: 12, color: C.text_secondary }}>{p.nom} — {p.stock} restant(s)</div>
          ))}
        </div>
      )}

      <SectionTitle title={filtered.length+' produit(s)'} />

      {loading
        ? <div style={{ textAlign: 'center', padding: 40, color: C.text_secondary }}>Chargement...</div>
        : filtered.length === 0
          ? <div style={{ textAlign:'center', padding:40 }}>
              <div style={{ fontSize:40, marginBottom:10 }}>📦</div>
              <div style={{ fontSize:14, color:C.text_secondary, marginBottom:16 }}>Aucun produit dans votre catalogue.</div>
              <button onClick={() => { setEditProduit(null); setShowForm(true); }} style={{ backgroundColor:C.accent, color:'#fff', border:'none', borderRadius:12, padding:'12px 24px', fontWeight:700, fontSize:14, cursor:'pointer' }}>+ Ajouter un produit</button>
            </div>
          : (
            <div style={{ borderRadius: 12, overflow: 'hidden', border: '1.5px solid '+C.border }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', backgroundColor: C.accent+'18', borderBottom: '2px solid '+C.border }}>
                {['PRODUIT','ACHAT','VENTE','STOCK','MARGE','TENDANCE'].map((col, ci) => (
                  <div key={col} style={{ fontSize: 11, fontWeight: 800, color: C.text_secondary, padding: '9px 10px', textAlign: ci === 0 ? 'left' : 'center', borderRight: ci < 5 ? '1px solid '+C.border : 'none' }}>{col}</div>
                ))}
              </div>
              {filtered.map((p, i) => {
                const marge = (p.prix_vente||0) - (p.prix_achat||0);
                const pct = p.prix_vente ? Math.round(marge / p.prix_vente * 100) : 0;
                const stockBas = p.stock != null && p.stock <= (p.seuil_alerte ?? 5);
                const tendance = topVendus.includes(p.nom);
                const cellStyle = (ci) => ({ padding: '10px 10px', borderRight: ci < 5 ? '1px solid '+C.border : 'none', borderTop: '1px solid '+C.border, display: 'flex', alignItems: 'center', justifyContent: ci === 0 ? 'flex-start' : 'center', backgroundColor: i % 2 === 0 ? C.surface : C.accent+'05' });
                return (
                  <div key={p._id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr' }}>
                    <div style={cellStyle(0)}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: C.text_primary }}>{p.nom}</div>
                      {stockBas && <span style={{ marginLeft: 6, fontSize: 9, backgroundColor: C.danger+'20', color: C.danger, borderRadius: 5, padding: '1px 5px', fontWeight: 700 }}>bas</span>}
                    </div>
                    <div style={cellStyle(1)}><span style={{ fontSize: 12, color: C.text_secondary }}>{fmtMoney(p.prix_achat)}</span></div>
                    <div style={cellStyle(2)}><span style={{ fontSize: 12, fontWeight: 600, color: C.text_primary }}>{fmtMoney(p.prix_vente)}</span></div>
                    <div style={cellStyle(3)}><span style={{ fontSize: 13, fontWeight: 700, color: stockBas ? C.danger : C.text_primary }}>{p.stock != null ? p.stock : '—'}</span></div>
                    <div style={cellStyle(4)}><span style={{ fontSize: 13, fontWeight: 800, color: C.success }}>{pct}%</span></div>
                    <div style={cellStyle(5)}>{tendance ? <span style={{ fontSize: 10, backgroundColor: C.accent+'20', color: C.accent, borderRadius: 5, padding: '2px 7px', fontWeight: 700 }}>🔥 Tendance</span> : <span style={{ fontSize: 11, color: C.border }}>—</span>}</div>
                  </div>
                );
              })}
            </div>
          )
      }

      </>)}

      {showForm && (
        <ProduitForm
          produit={editProduit}
          onClose={() => { setShowForm(false); setEditProduit(null); }}
          onSaved={() => { setShowForm(false); setEditProduit(null); load(); }}
        />
      )}

      {showApprov && (
        <ApprovForm
          produits={produits}
          onClose={() => setShowApprov(false)}
          onSaved={() => { setShowApprov(false); load(); }}
        />
      )}

      {showMonStock && (
        <MonStockPage
          produits={produits}
          topVendus={topVendus}
          alertesStock={alertesStock}
          search={search}
          setSearch={setSearch}
          onClose={() => setShowMonStock(false)}
          onEdit={(p) => { setShowMonStock(false); setEditProduit(p); setShowForm(true); }}
          onDelete={(p) => { del(p); }}
        />
      )}
    </div>
  );
};
