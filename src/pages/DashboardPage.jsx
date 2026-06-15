import { useState, useEffect } from 'react';
import { C } from '../theme';
import { getClients, getVentes, getProspects, getRdvs, getSeminaires, today } from '../db/index';
import { KpiCard, Card, SectionTitle, fmtMoney, fmtDate, Badge, getDeviseSymbol } from "../components/UI";

export const DashboardPage = ({ onNavigate }) => {
  const [kpis, setKpis] = useState({});
  const [dernieresVentes, setDernieresVentes] = useState([]);
  const [rdvs, setRdvs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [clients, ventes, prospects, rdvsAll, seminaires] = await Promise.all([
        getClients(), getVentes(), getProspects(), getRdvs(), getSeminaires(),
      ]);
      const t = today();
      const mois = t.slice(0, 7);
      const ventesMois = ventes.filter(v => v.date_vente && v.date_vente.startsWith(mois));
      const ca = ventesMois.reduce((s, v) => s + (v.prix_vente * v.quantite), 0);
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
      setDernieresVentes(ventes.slice(0, 5));
      setLoading(false);
    };
    load();
  }, []);

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
          Bonjour 👋
        </div>
      </div>

      <div style={{
        backgroundColor: C.accent,
        borderRadius: 16,
        padding: 18,
        marginBottom: 16,
        color: '#fff',
      }}>
        <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ fontSize:11, opacity:0.8 }}>CA du mois</span><span style={{ fontSize:11, opacity:0.8 }}>Marge</span></div>
        <div style={{ fontWeight: 800, fontSize: 22 }}>{fmtMoney(kpis.ca, getDeviseSymbol())} · {fmtMoney(kpis.marge, getDeviseSymbol())}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <KpiCard title="Clients" value={kpis.clients} color={C.accent} icon="👤" />
        <KpiCard title="Contacts" value={kpis.prospects} color={C.tag_prospect} icon="🤝" />
        <KpiCard title="RDV aujourd'hui" value={kpis.rdvsToday} color={C.warning} icon="📅" />
        <KpiCard title="Evenements a venir" value={kpis.seminaires} color={C.tag_event} icon="🎓" />
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
    </div>
  );
};
