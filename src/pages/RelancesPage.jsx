import { useState, useEffect, useCallback } from 'react';
import { C } from '../theme';
import { getClients, getVentes, today } from '../db/index';
import { Card, SectionTitle, Avatar, fmtMoney, fmtDate } from '../components/UI';

export const RelancesPage = () => {
  const [clients, setClients] = useState([]);
  const [seuil, setSeuil] = useState('30');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const days = parseInt(seuil) || 30;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    const [allClients, allVentes] = await Promise.all([getClients(), getVentes()]);

    const result = allClients.map(c => {
      const ventes = allVentes.filter(v => v.client_id === c._id);
      const dernierAchat = ventes.length
        ? ventes.reduce((max, v) => v.date_vente > max ? v.date_vente : max, '')
        : null;
      const ca = ventes.reduce((s, v) => s + v.prix_vente * v.quantite, 0);
      return { ...c, dernier: dernierAchat, nb: ventes.length, ca };
    }).filter(c => !c.dernier || c.dernier < cutoff)
      .sort((a, b) => (a.dernier || '') < (b.dernier || '') ? -1 : 1);

    setClients(result);
    setLoading(false);
  }, [seuil]);

  useEffect(() => { load(); }, [load]);

  const sendWhatsApp = (c) => {
    if (!c.telephone) { alert('Aucun numero WhatsApp.'); return; }
    const tel = c.telephone.replace(/[\s+\-]/g, '');
    const msg = encodeURIComponent(`Bonjour ${c.nom},\n\nCela fait un moment qu'on ne s'est pas vus ! Je voulais prendre de vos nouvelles et vous informer de nos dernieres offres.\n\nN'hesitez pas a me contacter !\n\nA bientot !`);
    window.open(`https://wa.me/${tel}?text=${msg}`, '_blank');
  };

  return (
    <div style={{ padding: '14px', paddingBottom: 80, width: '100%', boxSizing: 'border-box' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        backgroundColor: '#fff', borderRadius: 12, padding: 12,
        marginBottom: 14, border: `1px solid ${C.card_border}`,
      }}>
        <span style={{ fontSize: 13, color: C.text_secondary }}>Inactifs depuis</span>
        <input
          value={seuil}
          onChange={e => setSeuil(e.target.value)}
          type="number"
          style={{
            width: 50, textAlign: 'center', fontWeight: 700,
            color: C.text_primary, fontSize: 15,
            border: `1px solid ${C.input_border}`, borderRadius: 8, padding: '4px 0',
          }}
        />
        <span style={{ fontSize: 13, color: C.text_secondary }}>jours</span>
        <button onClick={load} style={{
          marginLeft: 'auto', backgroundColor: C.accent,
          color: '#fff', border: 'none', borderRadius: 8,
          padding: '6px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer',
        }}>OK</button>
      </div>

      <SectionTitle title={`${clients.length} client(s) a relancer`} />

      {loading
        ? <div style={{ textAlign: 'center', padding: 40, color: C.text_secondary }}>Chargement...</div>
        : clients.length === 0
          ? <div style={{ textAlign: 'center', padding: 40, color: C.success, fontSize: 13, fontWeight: 700 }}>
              Aucun client inactif !
            </div>
          : clients.map(c => (
            <div key={c._id} style={{ marginBottom: 10 }}>
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 4 }}>
                  <Avatar nom={c.nom} size={40} color={C.warning} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.text_primary }}>{c.nom}</div>
                    <div style={{ fontSize: 11, color: C.text_secondary, marginTop: 2 }}>
                      {c.nb} achat(s) · Dernier : {c.dernier ? fmtDate(c.dernier) : 'jamais'}
                    </div>
                    <div style={{ fontSize: 11, color: C.success, marginTop: 2 }}>{fmtMoney(c.ca)}</div>
                  </div>
                  {c.telephone && (
                    <button onClick={() => sendWhatsApp(c)} style={{
                      backgroundColor: C.tag_whatsapp, border: 'none',
                      borderRadius: 8, width: 36, height: 36,
                      cursor: 'pointer', color: '#fff', fontSize: 16,
                    }}>📱</button>
                  )}
                </div>
              </Card>
            </div>
          ))
      }
    </div>
  );
};
