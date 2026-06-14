import { useState, useEffect } from 'react';
import { C, CANAL_COLORS } from '../theme';
import { getClients, getVentes, today } from '../db/index';
import { Card, SectionTitle, Badge, fmtMoney } from '../components/UI';
import { useDevise } from '../hooks/useDevise';

const MiniBarChart = ({ data, maxVal }) => {
  if (!data || data.length === 0) return null;
  const max = maxVal || 1;
  const H = 80;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', height: H + 20, padding: '0 4px' }}>
      {data.map((item, i) => {
        const caH = Math.max(4, Math.round((item.ca / max) * H));
        const margeH = item.marge > 0 ? Math.max(2, Math.round((item.marge / max) * H)) : 0;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 1px' }}>
            <div style={{ width: '100%', height: H, display: 'flex', alignItems: 'flex-end', position: 'relative' }}>
              <div style={{ width: '100%', height: caH, backgroundColor: C.accent, borderRadius: 3 }} />
              {margeH > 0 && (
                <div style={{
                  position: 'absolute', bottom: 0, left: 0,
                  width: '50%', height: margeH,
                  backgroundColor: C.success, borderRadius: 2,
                }} />
              )}
            </div>
            <div style={{ fontSize: 7, color: C.text_light, marginTop: 2 }}>{item.label}</div>
          </div>
        );
      })}
    </div>
  );
};

export const RapportsPage = () => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const mois = today().slice(0, 7);
      const [allClients, allVentes] = await Promise.all([getClients(), getVentes()]);

      const ventesMois = allVentes.filter(v => v.date_vente && v.date_vente.startsWith(mois));
      const ca = ventesMois.reduce((s, v) => s + v.prix_vente * v.quantite, 0);
      const marge = ventesMois.reduce((s, v) => s + (v.prix_vente - v.prix_achat) * v.quantite, 0);
      const nbVentes = ventesMois.length;

      // Top clients
      const clientMap = {};
      allVentes.forEach(v => {
        if (!clientMap[v.client_id]) clientMap[v.client_id] = { ca: 0, nb: 0 };
        clientMap[v.client_id].ca += v.prix_vente * v.quantite;
        clientMap[v.client_id].nb += 1;
      });
      const tops = allClients
        .map(c => ({ ...c, ca: clientMap[c._id]?.ca || 0, nb: clientMap[c._id]?.nb || 0 }))
        .filter(c => c.ca > 0)
        .sort((a, b) => b.ca - a.ca)
        .slice(0, 5);

      // Canaux
      const canalMap = {};
      allClients.forEach(c => {
        const canal = c.canal || 'Autre';
        if (!canalMap[canal]) canalMap[canal] = { nb_clients: 0, nb_achats: 0, ca: 0, marge: 0 };
        canalMap[canal].nb_clients += 1;
      });
      allVentes.forEach(v => {
        const client = allClients.find(c => c._id === v.client_id);
        const canal = client?.canal || 'Autre';
        if (!canalMap[canal]) canalMap[canal] = { nb_clients: 0, nb_achats: 0, ca: 0, marge: 0 };
        canalMap[canal].nb_achats += 1;
        canalMap[canal].ca += v.prix_vente * v.quantite;
        canalMap[canal].marge += (v.prix_vente - v.prix_achat) * v.quantite;
      });
      const canaux = Object.entries(canalMap)
        .map(([canal, val]) => ({ canal, ...val }))
        .sort((a, b) => b.ca - a.ca);

      // Mensuel 12 derniers mois
      const mensuelMap = {};
      allVentes.forEach(v => {
        const m = v.date_vente?.slice(0, 7);
        if (!m) return;
        if (!mensuelMap[m]) mensuelMap[m] = { ca: 0, marge: 0 };
        mensuelMap[m].ca += v.prix_vente * v.quantite;
        mensuelMap[m].marge += (v.prix_vente - v.prix_achat) * v.quantite;
      });
      const mensuel = Object.entries(mensuelMap)
        .map(([mois, val]) => ({ mois, ...val }))
        .sort((a, b) => a.mois.localeCompare(b.mois))
        .slice(-12);

      setData({ ca, marge, nbVentes, tops, canaux, mensuel });
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
      <span style={{ color: C.text_secondary }}>Chargement...</span>
    </div>
  );

  const tauxMarge = data.ca ? Math.round(data.marge / data.ca * 100) : 0;
  const chartData = (data.mensuel || []).map(m => ({
    label: m.mois?.slice(5) || '',
    ca: m.ca || 0,
    marge: m.marge || 0,
  }));
  const maxCA = chartData.length ? Math.max(...chartData.map(d => d.ca), 1) : 1;

  return (
    <div style={{ padding: '14px', paddingBottom: 80, width: '100%', boxSizing: 'border-box' }}>
      <SectionTitle title="Resume mensuel" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
        {[
          { label: 'CA mensuel',    value: fmtMoney(data.ca),    color: C.accent },
          { label: 'Marge brute',   value: fmtMoney(data.marge), color: C.success },
          { label: 'Taux de marge', value: `${tauxMarge}%`,      color: C.warning },
          { label: 'Ventes',        value: data.nbVentes,         color: C.pink },
        ].map(k => (
          <Card key={k.label} style={{ padding: 14 }}>
            <div style={{ fontSize: 11, color: C.text_secondary }}>{k.label}</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: k.color, marginTop: 4 }}>{k.value}</div>
          </Card>
        ))}
      </div>

      {chartData.length > 0 && (
        <Card style={{ marginBottom: 18, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.text_primary, marginBottom: 12 }}>
            Evolution mensuelle du CA
          </div>
          <MiniBarChart data={chartData} maxVal={maxCA} />
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 12, height: 12, backgroundColor: C.accent, borderRadius: 2 }} />
              <span style={{ fontSize: 10, color: C.text_secondary }}>CA</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 12, height: 12, backgroundColor: C.success, borderRadius: 2 }} />
              <span style={{ fontSize: 10, color: C.text_secondary }}>Marge</span>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', backgroundColor: C.table_header, borderRadius: 6, padding: 8, marginBottom: 4 }}>
              <span style={{ flex: 2, fontSize: 10, fontWeight: 700, color: C.text_secondary }}>Mois</span>
              <span style={{ flex: 2, fontSize: 10, fontWeight: 700, color: C.text_secondary, textAlign: 'right' }}>CA</span>
              <span style={{ flex: 2, fontSize: 10, fontWeight: 700, color: C.text_secondary, textAlign: 'right' }}>Marge</span>
            </div>
            {[...(data.mensuel || [])].reverse().slice(0, 6).map((m, i) => (
              <div key={i} style={{ display: 'flex', padding: '6px 0', borderBottom: `1px solid ${C.card_border}` }}>
                <span style={{ flex: 2, fontSize: 11, color: C.text_secondary }}>{m.mois}</span>
                <span style={{ flex: 2, fontSize: 11, fontWeight: 700, color: C.accent, textAlign: 'right' }}>{fmtMoney(m.ca)}</span>
                <span style={{ flex: 2, fontSize: 11, fontWeight: 600, color: C.success, textAlign: 'right' }}>{fmtMoney(m.marge)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <SectionTitle title="Top clients (CA)" />
      <Card style={{ marginBottom: 18 }}>
        {!data.tops?.length
          ? <div style={{ textAlign: 'center', padding: 30, color: C.text_secondary, fontSize: 13 }}>Aucune vente.</div>
          : data.tops.map((t, i) => (
            <div key={t._id}>
              <div style={{ display: 'flex', alignItems: 'center', padding: 12, gap: 12 }}>
                <span style={{ fontWeight: 800, fontSize: 16, color: i === 0 ? C.warning : C.text_secondary, width: 28 }}>#{i+1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: C.text_primary }}>{t.nom}</div>
                  <div style={{ fontSize: 11, color: C.text_secondary }}>{t.nb} achat(s)</div>
                </div>
                <span style={{ fontWeight: 700, fontSize: 14, color: C.success }}>{fmtMoney(t.ca)}</span>
              </div>
              {i < data.tops.length - 1 && <div style={{ height: 1, backgroundColor: C.card_border }} />}
            </div>
          ))
        }
      </Card>

      <SectionTitle title="Performance par canal" />
      <Card>
        {!data.canaux?.length
          ? <div style={{ textAlign: 'center', padding: 30, color: C.text_secondary, fontSize: 13 }}>Aucun client.</div>
          : data.canaux.map((cs, i) => {
            const totalClients = data.canaux.reduce((s, c) => s + c.nb_clients, 0);
            const pct = totalClients ? Math.round(cs.nb_clients / totalClients * 100) : 0;
            const color = CANAL_COLORS[cs.canal] || C.text_secondary;
            return (
              <div key={cs.canal} style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Badge label={cs.canal?.split('/')[0].trim()} color={color} />
                  <span style={{ fontSize: 11, color: C.text_secondary }}>{cs.nb_clients} clients · {cs.nb_achats} achats</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.accent }}>{fmtMoney(cs.ca)}</span>
                  <span style={{ fontSize: 11, color: C.success }}>Marge : {fmtMoney(cs.marge)}</span>
                </div>
                <div style={{ height: 6, backgroundColor: C.page_bg, borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: 3 }} />
                </div>
                <div style={{ fontSize: 9, color: C.text_light, marginTop: 2 }}>{pct}% des clients</div>
                {i < data.canaux.length - 1 && <div style={{ height: 1, backgroundColor: C.card_border, marginTop: 8 }} />}
              </div>
            );
          })
        }
      </Card>
    </div>
  );
};
