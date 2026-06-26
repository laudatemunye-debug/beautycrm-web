import { useState, useEffect, useCallback } from 'react';
import { C } from '../theme';
import { getProduits, saveProduit, deleteProduit, getTendances, getVentes } from '../db/index';
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
          <div style={{ flex: 1 }}><FieldInput label="Seuil d'alerte" value={form.seuil_alerte} onChange={v => setForm(f=>({...f,seuil_alerte:v}))} type="number" placeholder="Ex: 5" /></div>
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

const OngletProduits = ({ produits, tendances, search, setSearch, onEdit, onDel, onNew }) => {
  const filtered = produits.filter(p => p.nom.toLowerCase().includes(search.toLowerCase()));
  const topVendus = Object.entries(tendances).sort((a,b) => b[1]-a[1]).slice(0,3).map(e => e[0]);
  const alertesStock = produits.filter(p => p.stock != null && p.stock <= (p.seuil_alerte ?? 5));

  return (
    <div>
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
      {filtered.length === 0
        ? <div style={{ textAlign:'center', padding:40 }}>
            <div style={{ fontSize:40, marginBottom:10 }}>📦</div>
            <div style={{ fontSize:14, color:C.text_secondary, marginBottom:16 }}>Aucun produit.</div>
            <button onClick={onNew} style={{ backgroundColor:C.accent, color:'#fff', border:'none', borderRadius:12, padding:'12px 24px', fontWeight:700, fontSize:14, cursor:'pointer' }}>+ Ajouter</button>
          </div>
        : (
          <div style={{ borderRadius: 12, overflow: 'hidden', border: '1.5px solid '+C.border }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px', backgroundColor: C.accent+'18', borderBottom: '2px solid '+C.border }}>
              {['PRODUIT','ACHAT','VENTE','STOCK','MARGE','ACTION'].map((col, ci) => (
                <div key={col} style={{ fontSize: 11, fontWeight: 800, color: C.text_secondary, padding: '9px 10px', textAlign: ci === 0 ? 'left' : 'center', borderRight: ci < 5 ? '1px solid '+C.border : 'none' }}>{col}</div>
              ))}
            </div>
            {filtered.map((p, i) => {
              const marge = (p.prix_vente||0) - (p.prix_achat||0);
              const pct = p.prix_vente ? Math.round(marge / p.prix_vente * 100) : 0;
              const stockBas = p.stock != null && p.stock <= (p.seuil_alerte ?? 5);
              const tendance = topVendus.includes(p.nom);
              const cellStyle = (ci) => ({ padding: '10px 8px', borderRight: ci < 5 ? '1px solid '+C.border : 'none', borderTop: '1px solid '+C.border, display: 'flex', alignItems: 'center', justifyContent: ci === 0 ? 'flex-start' : 'center', backgroundColor: i % 2 === 0 ? C.surface : C.accent+'05' });
              return (
                <div key={p._id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px' }}>
                  <div style={cellStyle(0)}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.text_primary }}>{p.nom}</div>
                    {stockBas && <span style={{ marginLeft: 5, fontSize: 9, backgroundColor: C.danger+'20', color: C.danger, borderRadius: 5, padding: '1px 5px', fontWeight: 700 }}>bas</span>}
                    {tendance && <span style={{ marginLeft: 4, fontSize: 9 }}>🔥</span>}
                  </div>
                  <div style={cellStyle(1)}><span style={{ fontSize: 12, color: C.text_secondary }}>{fmtMoney(p.prix_achat)}</span></div>
                  <div style={cellStyle(2)}><span style={{ fontSize: 12, fontWeight: 600 }}>{fmtMoney(p.prix_vente)}</span></div>
                  <div style={cellStyle(3)}><span style={{ fontSize: 13, fontWeight: 700, color: stockBas ? C.danger : C.text_primary }}>{p.stock ?? '—'}</span></div>
                  <div style={cellStyle(4)}><span style={{ fontSize: 13, fontWeight: 800, color: C.success }}>{pct}%</span></div>
                  <div style={cellStyle(5)}>
                    <button onClick={() => onEdit(p)} style={{ fontSize: 13, padding: '3px 7px', borderRadius: 6, border: '1px solid '+C.accent, backgroundColor: 'transparent', color: C.accent, cursor: 'pointer', marginRight: 3 }}>✏️</button>
                    <button onClick={() => onDel(p)} style={{ fontSize: 13, padding: '3px 7px', borderRadius: 6, border: '1px solid '+C.danger, backgroundColor: 'transparent', color: C.danger, cursor: 'pointer' }}>🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      }
    </div>
  );
};

const OngletHistorique = ({ produits }) => {
  const [ventes, setVentes] = useState([]);
  const [jours, setJours] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getVentes().then(all => {
      const debut = Date.now() - jours * 86400000;
      setVentes((all || []).filter(v => new Date(v.date).getTime() >= debut));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [jours]);

  const debut = Date.now() - jours * 86400000;
  const reappros = produits.flatMap(p =>
    (p.historique_stock || [])
      .filter(h => new Date(h.date).getTime() >= debut)
      .map(h => ({ ...h, produit: p.nom, type: 'reappro' }))
  );
  const ventesItems = ventes.flatMap(v =>
    (v.lignes || v.items || []).map(l => ({
      date: v.date, produit: l.nom || l.produit, qte: l.qte || l.quantite || 1, type: 'vente',
    }))
  );
  const tous = [...reappros, ...ventesItems].sort((a,b) => new Date(b.date) - new Date(a.date));

  const BtnJours = ({ j }) => (
    <button onClick={() => setJours(j)} style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: '1.5px solid '+(jours===j ? C.accent : C.border), backgroundColor: jours===j ? C.accent+'15' : C.surface, color: jours===j ? C.accent : C.text_secondary, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{j} jours</button>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <BtnJours j={7} /><BtnJours j={30} /><BtnJours j={90} />
      </div>
      {loading
        ? <div style={{ textAlign:'center', padding:40, color:C.text_secondary }}>Chargement...</div>
        : tous.length === 0
          ? <div style={{ textAlign:'center', padding:40, color:C.text_secondary }}>Aucun mouvement sur cette periode.</div>
          : (
            <div style={{ borderRadius: 12, overflow: 'hidden', border: '1.5px solid '+C.border }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', backgroundColor: C.accent+'18', borderBottom: '2px solid '+C.border }}>
                {['DATE','PRODUIT','QTE','TYPE'].map((col, ci) => (
                  <div key={col} style={{ fontSize: 11, fontWeight: 800, color: C.text_secondary, padding: '9px 10px', textAlign: ci===0?'left':'center', borderRight: ci<3?'1px solid '+C.border:'none' }}>{col}</div>
                ))}
              </div>
              {tous.slice(0,50).map((item, i) => {
                const isVente = item.type === 'vente';
                const cell = (ci) => ({ padding: '9px 10px', borderRight: ci<3?'1px solid '+C.border:'none', borderTop: '1px solid '+C.border, display:'flex', alignItems:'center', justifyContent: ci===0?'flex-start':'center', backgroundColor: i%2===0?C.surface:C.accent+'05' });
                return (
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 2fr 1fr 1fr' }}>
                    <div style={cell(0)}><span style={{ fontSize:11, color:C.text_secondary }}>{new Date(item.date).toLocaleDateString('fr')}</span></div>
                    <div style={cell(1)}><span style={{ fontSize:12, fontWeight:600 }}>{item.produit || '—'}</span></div>
                    <div style={cell(2)}><span style={{ fontSize:12, fontWeight:700, color: isVente?C.danger:C.success }}>{isVente?'-':'+'}{item.qte}</span></div>
                    <div style={cell(3)}><span style={{ fontSize:10, padding:'2px 8px', borderRadius:6, fontWeight:700, backgroundColor: isVente?C.danger+'20':C.success+'20', color: isVente?C.danger:C.success }}>{isVente?'🛒 Vente':'📦 Reappro'}</span></div>
                  </div>
                );
              })}
            </div>
          )
      }
    </div>
  );
};

const OngletBenefices = ({ produits }) => {
  const [ventes, setVentes] = useState([]);
  const [jours, setJours] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getVentes().then(all => {
      const debut = Date.now() - jours * 86400000;
      setVentes((all || []).filter(v => new Date(v.date).getTime() >= debut));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [jours]);

  const stats = produits.map(p => {
    const lignes = ventes.flatMap(v => (v.lignes || v.items || []).filter(l => (l.nom || l.produit) === p.nom));
    const qteVendue = lignes.reduce((s,l) => s + (l.qte || l.quantite || 1), 0);
    const caTotal = lignes.reduce((s,l) => s + ((l.prix_vente || l.prix || p.prix_vente || 0) * (l.qte || l.quantite || 1)), 0);
    const benefice = caTotal - (p.prix_achat || 0) * qteVendue;
    const marge = caTotal > 0 ? Math.round(benefice / caTotal * 100) : 0;
    return { ...p, qteVendue, caTotal, benefice, marge };
  }).filter(p => p.qteVendue > 0).sort((a,b) => b.benefice - a.benefice);

  const totalBenefice = stats.reduce((s,p) => s + p.benefice, 0);

  const BtnJours = ({ j }) => (
    <button onClick={() => setJours(j)} style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: '1.5px solid '+(jours===j ? C.accent : C.border), backgroundColor: jours===j ? C.accent+'15' : C.surface, color: jours===j ? C.accent : C.text_secondary, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{j} jours</button>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <BtnJours j={7} /><BtnJours j={30} /><BtnJours j={90} />
      </div>
      {stats.length > 0 && (
        <div style={{ backgroundColor: C.success+'15', borderRadius: 10, padding: 14, marginBottom: 14, textAlign:'center' }}>
          <div style={{ fontSize:11, color:C.text_secondary, marginBottom:4 }}>Benefice total sur {jours} jours</div>
          <div style={{ fontSize:22, fontWeight:900, color:C.success }}>{fmtMoney(totalBenefice)}</div>
        </div>
      )}
      {loading
        ? <div style={{ textAlign:'center', padding:40, color:C.text_secondary }}>Chargement...</div>
        : stats.length === 0
          ? <div style={{ textAlign:'center', padding:40, color:C.text_secondary }}>Aucune vente sur cette periode.</div>
          : (
            <div style={{ borderRadius:12, overflow:'hidden', border:'1.5px solid '+C.border }}>
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr', backgroundColor:C.accent+'18', borderBottom:'2px solid '+C.border }}>
                {['PRODUIT','VENDUS','CA','BENEFICE','MARGE'].map((col,ci) => (
                  <div key={col} style={{ fontSize:11, fontWeight:800, color:C.text_secondary, padding:'9px 10px', textAlign:ci===0?'left':'center', borderRight:ci<4?'1px solid '+C.border:'none' }}>{col}</div>
                ))}
              </div>
              {stats.map((p,i) => {
                const cell = (ci) => ({ padding:'10px 10px', borderRight:ci<4?'1px solid '+C.border:'none', borderTop:'1px solid '+C.border, display:'flex', alignItems:'center', justifyContent:ci===0?'flex-start':'center', backgroundColor:i%2===0?C.surface:C.accent+'05' });
                return (
                  <div key={p._id} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr' }}>
                    <div style={cell(0)}><span style={{ fontWeight:700, fontSize:13 }}>{p.nom}</span></div>
                    <div style={cell(1)}><span style={{ fontSize:13, color:C.text_secondary }}>{p.qteVendue}</span></div>
                    <div style={cell(2)}><span style={{ fontSize:12 }}>{fmtMoney(p.caTotal)}</span></div>
                    <div style={cell(3)}><span style={{ fontSize:13, fontWeight:800, color:p.benefice>=0?C.success:C.danger }}>{fmtMoney(p.benefice)}</span></div>
                    <div style={cell(4)}><span style={{ fontSize:13, fontWeight:700, color:p.marge>=0?C.success:C.danger }}>{p.marge}%</span></div>
                  </div>
                );
              })}
            </div>
          )
      }
    </div>
  );
};

export const StockPage = () => {
  const [produits, setProduits] = useState([]);
  const [tendances, setTendances] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [onglet, setOnglet] = useState('produits');
  const [showForm, setShowForm] = useState(false);
  const [editProduit, setEditProduit] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [data, tend] = await Promise.all([getProduits(), getTendances(30)]);
    setProduits(data);
    setTendances(tend);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const del = (p) => {
    if (!window.confirm('Supprimer '+p.nom+' ?')) return;
    deleteProduit(p._id).then(load);
  };

  const tabs = [
    { key: 'produits',   label: '🗂 Produits' },
    { key: 'historique', label: '📅 Historique' },
    { key: 'benefices',  label: '💰 Benefices' },
  ];

  return (
    <div style={{ padding: '14px', paddingBottom: 80, width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setOnglet(tab.key)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1.5px solid '+(onglet===tab.key ? C.accent : C.border), backgroundColor: onglet===tab.key ? C.accent+'15' : C.surface, color: onglet===tab.key ? C.accent : C.text_secondary, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {loading
        ? <div style={{ textAlign:'center', padding:40, color:C.text_secondary }}>Chargement...</div>
        : onglet === 'produits'
          ? <OngletProduits
              produits={produits} tendances={tendances} search={search} setSearch={setSearch}
              onEdit={p => { setEditProduit(p); setShowForm(true); }}
              onDel={del}
              onNew={() => { setEditProduit(null); setShowForm(true); }}
            />
          : onglet === 'historique'
            ? <OngletHistorique produits={produits} />
            : <OngletBenefices produits={produits} />
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
