import { useState, useEffect } from 'react';
import { C } from '../theme';
import { getClients, getVentes, getProspects, getRdvs, getSeminaires, getCredits, today } from '../db/index';
import { KpiCard, Card, SectionTitle, fmtMoney, fmtDate, Badge, getDeviseSymbol } from "../components/UI";
import { useDevise } from "../hooks/useDevise";
import { useEntreprise } from "../hooks/useEntreprise";

export const DashboardPage = ({ onNavigate }) => {
  const [kpis, setKpis] = useState({});
  const [periode, setPeriode] = useState('mois');
  const [periodeLabel, setPeriodeLabel] = useState('Ce mois');
  const [showPicker, setShowPicker] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [ventesAll, setVentesAll] = useState([]);
  const [dernieresVentes, setDernieresVentes] = useState([]);
  const [rdvs, setRdvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const devise = useDevise();
  const bizMode = useEntreprise();
  const [syncingHome, setSyncingHome] = useState(false);
  const [syncMsgHome, setSyncMsgHome] = useState('');
  const [pendingSync, setPendingSync] = useState(false);

  useEffect(() => {
    if (bizMode.mode === 'admin' || bizMode.mode === 'employe') {
      bizMode.checkPendingSync().then(setPendingSync);
    }
  }, [bizMode.mode]);

  const handleSyncHome = async () => {
    if (syncingHome) return;
    setSyncingHome(true);
    setSyncMsgHome('');
    try {
      await bizMode.syncEntreprise();
      setSyncMsgHome('Sync reussie');
      setPendingSync(false);
    } catch(e) {
      setSyncMsgHome('Erreur sync');
    } finally {
      setSyncingHome(false);
      setTimeout(() => setSyncMsgHome(''), 3000);
    }
  };

  useEffect(() => {
    const load = async () => {
      const [clients, ventes, prospects, rdvsAll, seminaires, credits] = await Promise.all([
        getClients(), getVentes(), getProspects(), getRdvs(), getSeminaires(), getCredits(),
      ]);
      const t = today();
      const mois = t.slice(0, 7);
      const ventesMois = ventes.filter(v => v.date_vente && v.date_vente.startsWith(mois));
      const ca_ventes = ventesMois.reduce((s, v) => s + (v.prix_vente * v.quantite), 0);
      // Note : l'encaisse des credits (avance initiale + versements) est deja
      // repliquee automatiquement comme vente (methode_paiement: 'Credit') dans
      // ajouterVersement() et CreditForm.save(). Ne pas re-additionner ici,
      // sinon chaque versement est compte deux fois.
      const ca = ca_ventes;
      const marge = ventesMois.reduce((s, v) => s + ((v.prix_vente - v.prix_achat) * v.quantite), 0);
      const rdvsAujourdhui = rdvsAll.filter(r => r.date_rdv === t && r.statut !== 'annule');
      const rdvsUpcoming = rdvsAll
        .filter(r => r.date_rdv >= t && r.statut !== 'annule')
        .slice(0, 5);
      setKpis({
        clients: clients.length,
        prospects: prospects.length,
        ca, marge,
        rdvsToday: rdvsAujourdhui.length,
        seminaires: seminaires.filter(s => s.date_event >= t).length,
      });
      setRdvs(rdvsUpcoming);
      setVentesAll(ventes);
      setDernieresVentes(ventes.slice(0, 5));
      setLoading(false);
    };
    load();
  }, []);

  const applyPeriode = (p, from, to) => {
    const t = today();
    let filtered;
    if (p === 'mois') {
      const mois = t.slice(0, 7);
      filtered = ventesAll.filter(v => v.date_vente && v.date_vente.startsWith(mois));
      setPeriodeLabel('Ce mois');
    } else if (p === 'mois_dernier') {
      const d = new Date(); d.setMonth(d.getMonth() - 1);
      const mois = d.toISOString().slice(0, 7);
      filtered = ventesAll.filter(v => v.date_vente && v.date_vente.startsWith(mois));
      setPeriodeLabel('Mois dernier');
    } else if (p === 'annee') {
      const annee = t.slice(0, 4);
      filtered = ventesAll.filter(v => v.date_vente && v.date_vente.startsWith(annee));
      setPeriodeLabel('Cette année');
    } else if (p === 'custom' && from && to) {
      filtered = ventesAll.filter(v => v.date_vente && v.date_vente >= from && v.date_vente <= to);
      setPeriodeLabel(from + ' → ' + to);
    } else return;
    const ca = filtered.reduce((s, v) => s + (v.prix_vente * v.quantite), 0);
    const marge = filtered.reduce((s, v) => s + ((v.prix_vente - v.prix_achat) * v.quantite), 0);
    setKpis(k => ({ ...k, ca, marge }));
    setPeriode(p);
    setShowPicker(false);
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
      <span style={{ color: C.text_secondary }}>Chargement...</span>
    </div>
  );

  const shortcuts = [
    { label: '+ Client',    color: C.accent,   page: 'clients',    icon: '👤' },
    { label: '+ Vente',     color: C.success,  page: 'ventes',     icon: '🛍' },
    { label: '+ Contact',   color: C.tag_prospect, page: 'contacts', icon: '🤝' },
    { label: '+ RDV',       color: C.warning,  page: 'rdvs',       icon: '📅' },
  ];

  return (
    <div style={{ padding: '14px', paddingBottom: 80, width: '100%', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: C.text_secondary, marginBottom: 4 }}>
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
        <div style={{ fontWeight: 800, fontSize: 20, color: C.text_primary }}>
          {(() => { const h = new Date().getHours(); if (h < 12) return "Bonjour 👋"; if (h < 18) return "Bon après-midi 👋"; return "Bonne soirée 🌙"; })()}
        </div>
      </div>

      <div style={{
        backgroundColor: C.accent,
        borderRadius: 16,
        padding: 18,
        marginBottom: 16,
        color: '#fff',
      }}>
        <div onClick={() => setShowPicker(!showPicker)} style={{ cursor: 'pointer' }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:'center' }}>
            <span style={{ fontSize:11, opacity:0.8 }}>CA · {periodeLabel}</span>
            <span style={{ fontSize:11, opacity:0.8 }}>Marge ▾</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <span style={{ fontWeight:800, fontSize:22 }}>{fmtMoney(kpis.ca, devise)}</span>
            <span style={{ fontWeight:800, fontSize:22 }}>{fmtMoney(kpis.marge, devise)}</span>
          </div>
        </div>
        {showPicker && (
          <div style={{ marginTop: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 10 }}>
            <div style={{ display:'flex', gap: 6, flexWrap:'wrap', marginBottom: 8 }}>
              {[['mois','Ce mois'],['mois_dernier','Mois dernier'],['annee','Cette année']].map(([p,l]) => (
                <span key={p} onClick={() => applyPeriode(p)} style={{
                  backgroundColor: periode === p ? '#fff' : 'rgba(255,255,255,0.2)',
                  color: periode === p ? C.accent : '#fff',
                  borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600,
                }}>{l}</span>
              ))}
            </div>
            <div style={{ display:'flex', gap: 6, alignItems:'center' }}>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                style={{ flex:1, borderRadius:6, border:'none', padding:'4px 6px', fontSize:12 }} />
              <span style={{ color:'#fff' }}>→</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                style={{ flex:1, borderRadius:6, border:'none', padding:'4px 6px', fontSize:12 }} />
              <span onClick={() => applyPeriode('custom', customFrom, customTo)}
                style={{ backgroundColor:'#fff', color:C.accent, borderRadius:6, padding:'4px 8px', fontSize:12, cursor:'pointer', fontWeight:700 }}>OK</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <KpiCard title="Clients" value={kpis.clients} color={C.accent} icon="👤" onClick={() => onNavigate('clients')} />
        <KpiCard title="Contacts" value={kpis.prospects} color={C.tag_prospect} icon="🤝" onClick={() => onNavigate('contacts')} />
        <KpiCard title="RDV aujourd'hui" value={kpis.rdvsToday} color={C.warning} icon="📅" onClick={() => onNavigate('rdvs')} />
        <KpiCard title="Evenements a venir" value={kpis.seminaires} color={C.tag_event} icon="🎓" onClick={() => onNavigate('seminaires')} />
      </div>

      <SectionTitle title="Acces rapide" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {shortcuts.map(s => (
          <div
            key={s.page}
            onClick={() => onNavigate(s.page)}
            style={{
              backgroundColor: s.color + '15',
              border: `1px solid ${s.color}30`,
              borderRadius: 12,
              padding: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 22 }}>{s.icon}</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: s.color }}>{s.label}</span>
          </div>
        ))}
      </div>


      <SectionTitle title="Dernieres ventes" action="Tout voir" onAction={() => onNavigate('ventes')} />
      <Card style={{ marginBottom: 16 }}>
        {dernieresVentes.length === 0
          ? <div style={{ textAlign: 'center', padding: 30, color: C.text_secondary, fontSize: 13 }}>Aucune vente enregistree.</div>
          : dernieresVentes.map((v, i) => (
            <div key={v._id}>
              <div style={{ display: 'flex', alignItems: 'center', padding: 12, gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: C.success+'20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🛍</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: C.text_primary }}>{v.produit} ×{v.quantite}</div>
                  <div style={{ fontSize: 11, color: C.text_secondary, marginTop: 2 }}>{fmtDate(v.date_vente)}</div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.success }}>{fmtMoney(v.prix_vente * v.quantite, getDeviseSymbol())}</div>
              </div>
              {i < dernieresVentes.length - 1 && <div style={{ height: 1, backgroundColor: C.card_border }} />}
            </div>
          ))
        }
      </Card>

      <SectionTitle title="Rendez-vous a venir" action="Tout voir" onAction={() => onNavigate('rdvs')} />
      <Card style={{ marginBottom: 16 }}>
        {rdvs.length === 0
          ? <div style={{ textAlign: 'center', padding: 30, color: C.text_secondary, fontSize: 13 }}>Aucun rendez-vous planifie.</div>
          : rdvs.map((r, i) => (
            <div key={r._id}>
              <div style={{ display: 'flex', alignItems: 'center', padding: 12, gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: C.warning+'20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📅</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: C.text_primary }}>{r.objet || 'RDV'}</div>
                  <div style={{ fontSize: 11, color: C.text_secondary, marginTop: 2 }}>{fmtDate(r.date_rdv)} · {r.heure_rdv}</div>
                </div>
                <Badge label={r.statut} color={C.warning} />
              </div>
              {i < rdvs.length - 1 && <div style={{ height: 1, backgroundColor: C.card_border }} />}
            </div>
          ))
        }
      </Card>

      {(bizMode.mode === 'admin' || bizMode.mode === 'employe') && (
        <>
          <style>{`@keyframes dashSync-spin { to { transform: rotate(360deg); } }`}</style>
          <div
            onClick={handleSyncHome}
            style={{
              position: 'fixed',
              bottom: 76, left: 16,
              width: 52, height: 52,
              borderRadius: '50%',
              backgroundColor: pendingSync ? C.accent : C.text_light,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              cursor: syncingHome ? 'not-allowed' : 'pointer',
              zIndex: 90,
            }}
          >
            <span style={{
              fontSize: 22,
              display: 'inline-block',
              animation: syncingHome ? 'dashSync-spin 0.9s linear infinite' : 'none',
            }}>🔄</span>
          </div>
          {syncMsgHome && (
            <div style={{
              position: 'fixed', bottom: 132, left: 16,
              backgroundColor: syncMsgHome.startsWith('Erreur') ? C.danger : C.success,
              color: '#fff', fontSize: 11, fontWeight: 700,
              padding: '6px 10px', borderRadius: 8, zIndex: 90,
            }}>
              {syncMsgHome}
            </div>
          )}
        </>
      )}
    </div>
  );
};
