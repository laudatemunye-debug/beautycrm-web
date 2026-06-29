import { useState, useEffect } from 'react';
import { C, CANAL_COLORS } from '../theme';
import { getClients, getVentes, getApprovisionnements, getCredits, getSetting, today } from '../db/index';
import { Card, SectionTitle, Badge, fmtMoney, Modal } from '../components/UI';
import { useDevise } from '../hooks/useDevise';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const buildPDFDoc = (title, columns, rows, totalGeneral, devise) => {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(title, 14, 16);
  doc.setFontSize(10);
  doc.text('Genere le ' + new Date().toLocaleDateString('fr-FR'), 14, 22);
  autoTable(doc, {
    startY: 28,
    head: [columns],
    body: rows,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [61, 90, 254] },
  });
  if (totalGeneral !== undefined) {
    const y = doc.lastAutoTable.finalY + 6;
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Total general :', 120, y);
    doc.text(String(totalGeneral) + ' ' + (devise || '$'), 170, y, { align: 'right' });
  }
  return doc;
};

const exportPDF = (title, columns, rows) => {
  const doc = buildPDFDoc(title, columns, rows);
  doc.save(title.toLowerCase().replace(/ /g, '_') + '.pdf');
};

const RapportBtn = ({ label, icon, onClick }) => (
  <button onClick={onClick} style={{
    flex: 1, padding: '10px 8px', borderRadius: 10, border: '1.5px solid ' + C.accent,
    backgroundColor: C.surface, color: C.accent, fontWeight: 700, fontSize: 12, cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
  }}>
    <span style={{ fontSize: 18 }}>{icon}</span>
    {label}
  </button>
);

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
  const [clientsAll, setClientsAll] = useState([]);
  const [apercu, setApercu] = useState(null);
  const [filterPeriod, setFilterPeriod] = useState('mois');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const devise = useDevise();

  const nomClient = (id) => clientsAll.find(c => c._id === id)?.nom || 'Client inconnu';

  const buildEntete = async () => {
    const nom = await getSetting('facture_entreprise_nom') || await getSetting('entreprise') || 'BeautyCRM';
    const adresse = [await getSetting('ville')||'', await getSetting('pays')||''].filter(Boolean).join(', ');
    const telephone = await getSetting('facture_entreprise_telephone') || await getSetting('telephone') || '';
    const logo = await getSetting('facture_entreprise_logo') || '';
    const username = await getSetting('username') || '';
    return { nom, adresse, telephone, logo, username, genereeLe: new Date().toLocaleString('fr-FR') };
  };

  const rapportVentes = async () => {
    const ventes = await getVentes();
    const ent = await buildEntete();
    const now = new Date();
    const filterFn = (dateStr) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (dateFrom && dateTo) {
        return d >= new Date(dateFrom) && d <= new Date(dateTo);
      }
      switch(filterPeriod) {
        case 'semaine': { const s=new Date(now); s.setDate(s.getDate()-7); return d>=s&&d<=now; }
        case 'mois':      return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
        case 'trimestre': return Math.floor(d.getMonth()/3)===Math.floor(now.getMonth()/3)&&d.getFullYear()===now.getFullYear();
        case 'semestre':  return Math.floor(d.getMonth()/6)===Math.floor(now.getMonth()/6)&&d.getFullYear()===now.getFullYear();
        case 'annuel':    return d.getFullYear()===now.getFullYear();
        default: return true;
      }
    };
    const ventesFiltrees = ventes.filter(v => filterFn(v.date_vente));
    const lignes = ventesFiltrees.map(v => ({
      date: v.date_vente || '',
      client: nomClient(v.client_id),
      produit: v.produit || '',
      quantite: v.quantite || 0,
      prix_vente: v.prix_vente || 0,
      total: (v.prix_vente||0) * (v.quantite||0),
      paiement: v.methode_paiement || '',
    }));
    const totalGeneral = lignes.reduce((s, l) => s + l.total, 0);
    setApercu({ type: 'ventes', titre: 'Rapport de ventes', entete: ent, lignes, totalGeneral });
  };

  const exportApercuVentes = () => {
    const rows = apercu.lignes.map(l => [l.date, l.client, l.produit, l.quantite, fmtMoney(l.prix_vente), fmtMoney(l.total), l.paiement]);
    exportPDF('Rapport de ventes', ['Date', 'Client', 'Produit', 'Qte', 'Prix vente', 'Total', 'Paiement'], rows);
  };

  const rapportApprovisionnements = async () => {
    const approv = await getApprovisionnements();
    const ent = await buildEntete();
    const now2 = new Date();
    const filterFnA = (dateStr) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (dateFrom && dateTo) return d >= new Date(dateFrom) && d <= new Date(dateTo);
      switch(filterPeriod) {
        case 'semaine': { const s=new Date(now2); s.setDate(s.getDate()-7); return d>=s&&d<=now2; }
        case 'mois':      return d.getMonth()===now2.getMonth()&&d.getFullYear()===now2.getFullYear();
        case 'trimestre': return Math.floor(d.getMonth()/3)===Math.floor(now2.getMonth()/3)&&d.getFullYear()===now2.getFullYear();
        case 'semestre':  return Math.floor(d.getMonth()/6)===Math.floor(now2.getMonth()/6)&&d.getFullYear()===now2.getFullYear();
        case 'annuel':    return d.getFullYear()===now2.getFullYear();
        default: return true;
      }
    };
    const approvFiltres = approv.filter(a => filterFnA(a.date));
    const lignes = approvFiltres.map(a => ({
      date: a.date || '',
      produit: a.produit || '',
      quantite: a.quantite || 0,
      prix_achat: a.prix_achat || 0,
      total: (a.prix_achat||0) * (a.quantite||0),
    }));
    const totalGeneral = lignes.reduce((s,l) => s + l.total, 0);
    setApercu({ type: 'approv', titre: 'Rapport approvisionnement', entete: ent, lignes, totalGeneral });
  };

  const rapportCredits = async () => {
    const credits = await getCredits();
    const ent = await buildEntete();
    const now3 = new Date();
    const filterFnC = (dateStr) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (dateFrom && dateTo) return d >= new Date(dateFrom) && d <= new Date(dateTo);
      switch(filterPeriod) {
        case 'semaine': { const s=new Date(now3); s.setDate(s.getDate()-7); return d>=s&&d<=now3; }
        case 'mois':      return d.getMonth()===now3.getMonth()&&d.getFullYear()===now3.getFullYear();
        case 'trimestre': return Math.floor(d.getMonth()/3)===Math.floor(now3.getMonth()/3)&&d.getFullYear()===now3.getFullYear();
        case 'semestre':  return Math.floor(d.getMonth()/6)===Math.floor(now3.getMonth()/6)&&d.getFullYear()===now3.getFullYear();
        case 'annuel':    return d.getFullYear()===now3.getFullYear();
        default: return true;
      }
    };
    const creditsFiltres = credits.filter(c => filterFnC(c.date_vente));
    const lignes = [];
    creditsFiltres.forEach(c => {
      lignes.push({
        date: c.date_vente || '',
        client: nomClient(c.client_id),
        produit: c.produit || '',
        montant_total: fmtMoney(c.montant_total),
        montant_restant: fmtMoney(c.montant_restant),
        statut: c.statut || '',
        historique: '',
        isVersement: false,
      });
      (c.versements || []).forEach(v => {
        lignes.push({
          date: (v.date||'').slice(0,10),
          client: '',
          produit: '',
          montant_total: '',
          montant_restant: '',
          statut: 'Versement',
          historique: fmtMoney(v.montant),
          isVersement: true,
        });
      });
    });
    setApercu({ type: 'credits', titre: 'Rapport credits', entete: ent, lignes });
  };

  useEffect(() => {
    const load = async () => {
      const mois = today().slice(0, 7);
      const [allClients, allVentes] = await Promise.all([getClients(), getVentes()]);
      setClientsAll(allClients);

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

  if (apercu) {
    const cols = apercu.type === 'ventes'
      ? ['Date','Client','Produit','Qte','Prix','Total','Paiement']
      : apercu.type === 'approv'
      ? ['Date','Produit','Qte',"Prix d'achat",'Total']
      : ['Date','Client','Produit','Total','Restant','Statut','Historique'];

    const renderRow = (l, i) => {
      if (apercu.type === 'ventes') {
        const lignes = apercu.lignes;
        const key = l.date + '|' + l.client;
        const prevKey = i > 0 ? lignes[i-1].date + '|' + lignes[i-1].client : null;
        const isSameGroup = key === prevKey;
        const rowSpan = !isSameGroup ? lignes.filter(x => x.date + '|' + x.client === key).length : 0;
        return (
          <tr key={i} style={{ backgroundColor: i%2===0 ? '#fff' : '#fafafa' }}>
            {!isSameGroup && <td style={{...tdS, verticalAlign:'middle'}} rowSpan={rowSpan}>{l.date}</td>}
            {!isSameGroup && <td style={{...tdS, fontWeight:600, verticalAlign:'middle'}} rowSpan={rowSpan}>{l.client}</td>}
            <td style={tdS}>{l.produit}</td>
            <td style={{...tdS, textAlign:'center'}}>{l.quantite}</td>
            <td style={{...tdS, textAlign:'right', fontFamily:'monospace'}}>{fmtMoney(l.prix_vente)}</td>
            <td style={{...tdS, textAlign:'right', fontFamily:'monospace', fontWeight:700}}>{fmtMoney(l.total)}</td>
            <td style={tdS}>{l.paiement}</td>
          </tr>
        );
      }
      if (apercu.type === 'approv') return (
        <tr key={i} style={{ backgroundColor: i%2===0 ? '#fff' : '#fafafa' }}>
          <td style={tdS}>{l.date}</td>
          <td style={{...tdS, fontWeight:600}}>{l.produit}</td>
          <td style={{...tdS, textAlign:'center'}}>{l.quantite}</td>
          <td style={{...tdS, textAlign:'right', fontFamily:'monospace'}}>{fmtMoney(l.prix_achat)}</td>
          <td style={{...tdS, textAlign:'right', fontFamily:'monospace', fontWeight:700}}>{fmtMoney(l.total)}</td>
        </tr>
      );
      return (
        <tr key={i} style={{ backgroundColor: l.isVersement ? '#fafafa' : i%2===0 ? '#fff' : '#f5f5f5' }}>
          <td style={tdS}>{l.date}</td>
          <td style={{...tdS, fontWeight:600}}>{l.client}</td>
          <td style={tdS}>{l.produit}</td>
          <td style={{...tdS, textAlign:'right', fontFamily:'monospace'}}>{l.montant_total}</td>
          <td style={{...tdS, textAlign:'right', fontFamily:'monospace', color:'#c00'}}>{l.montant_restant}</td>
          <td style={tdS}>{l.statut}</td>
          <td style={{...tdS, fontSize:10, color:'#888'}}>{l.historique}</td>
        </tr>
      );
    };

    const thS = { padding:'8px 10px', textAlign:'left', backgroundColor:'#f0f0f0', color:'#333', fontWeight:700, fontSize:11, borderRight:'1px solid #ddd', whiteSpace:'nowrap' };
    const tdS = { padding:'6px 10px', fontSize:12, borderRight:'1px solid #ddd', borderBottom:'1px solid #ddd' };

    const getApercuRows = () => {
      if (apercu.type === 'ventes') {
        return apercu.lignes.map(l => [l.date, l.client, l.produit, l.quantite, fmtMoney(l.prix_vente), fmtMoney(l.total), l.paiement]);
      } else if (apercu.type === 'approv') {
        return apercu.lignes.map(l => [l.date, l.produit, l.quantite, fmtMoney(l.prix_achat), fmtMoney(l.total)]);
      }
      return apercu.lignes.map(l => [l.date, l.client, l.produit, l.montant_total, l.montant_restant, l.statut, l.historique||'']);
    };

    const buildApercuDoc = () => buildPDFDoc(apercu.titre, cols, getApercuRows(), apercu.totalGeneral, devise);
    const apercuFilename = () => apercu.titre.toLowerCase().replace(/ /g, '_') + '.pdf';

    const handleSavePdf = () => {
      const doc = buildApercuDoc();
      doc.save(apercuFilename());
    };

    const handleEnvoyerPdf = async () => {
      const doc = buildApercuDoc();
      const blob = doc.output('blob');
      const file = new File([blob], apercuFilename(), { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: apercu.titre }); return; } catch(_) {}
      }
      doc.save(apercuFilename());
    };

    const handleImprimer = () => {
      const doc = buildApercuDoc();
      doc.autoPrint();
      doc.output('dataurlnewwindow');
    };

    return (
      <div style={{ position:'fixed', inset:0, zIndex:1000, backgroundColor:'#f5f5f5', display:'flex', flexDirection:'column' }}>
        {/* Header */}
        <div style={{ backgroundColor:'#404040', padding:'12px 16px', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          <button onClick={() => setApercu(null)} style={{ background:'none', border:'none', color:'#fff', fontSize:22, cursor:'pointer', lineHeight:1 }}>←</button>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:16, color:'#fff' }}>{apercu.titre}</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.75)' }}>{apercu.entete.genereeLe}</div>
          </div>
          {apercu.entete.logo && <img src={apercu.entete.logo} alt="logo" style={{ width:36, height:36, objectFit:'contain', borderRadius:4 }} />}
        </div>

        {/* Entete entreprise */}
        <div style={{ backgroundColor:'#fff', padding:'10px 16px', borderBottom:'2px solid #ddd', flexShrink:0 }}>
          <div style={{ fontWeight:800, fontSize:14, color:'#222' }}>{apercu.entete.nom}</div>
          {apercu.entete.adresse && <div style={{ fontSize:11, color:'#555' }}>{apercu.entete.adresse}</div>}
          {apercu.entete.telephone && <div style={{ fontSize:11, color:'#555' }}>Tel : {apercu.entete.telephone}</div>}
        </div>

        {/* Filter bar */}
        <div style={{ backgroundColor:'#fff', borderBottom:'1px solid #ddd', padding:'10px 16px', display:'flex', gap:8, flexWrap:'wrap', flexShrink:0 }}>
          {[
            {key:'semaine', label:'Semaine'},
            {key:'mois',    label:'Mois'},
            {key:'trimestre', label:'Trimestre'},
            {key:'semestre',  label:'Semestre'},
            {key:'annuel',    label:'Annuel'},
          ].map(f => (
            <button key={f.key} onClick={() => {
                setFilterPeriod(f.key); setDateFrom(''); setDateTo('');
                setTimeout(() => apercu.type==='ventes' ? rapportVentes() : apercu.type==='approv' ? rapportApprovisionnements() : rapportCredits(), 0);
              }}
              style={{ padding:'6px 14px', borderRadius:20, border:'1.5px solid '+(filterPeriod===f.key&&!dateFrom?'#404040':'#ccc'),
                backgroundColor: filterPeriod===f.key&&!dateFrom ? '#404040' : '#fff',
                color: filterPeriod===f.key&&!dateFrom ? '#fff' : '#555',
                fontWeight: filterPeriod===f.key&&!dateFrom ? 700 : 400,
                fontSize:12, cursor:'pointer' }}>
              {f.label}
            </button>
          ))}
        </div>
        {/* Période personnalisée */}
        <div style={{ backgroundColor:'#fafafa', borderBottom:'1px solid #ddd', padding:'8px 16px', display:'flex', alignItems:'center', gap:8, flexShrink:0, flexWrap:'wrap' }}>
          <span style={{ fontSize:12, color:'#666', fontWeight:600 }}>Du</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ padding:'5px 8px', borderRadius:8, border:'1px solid #ccc', fontSize:12 }} />
          <span style={{ fontSize:12, color:'#666', fontWeight:600 }}>au</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ padding:'5px 8px', borderRadius:8, border:'1px solid #ccc', fontSize:12 }} />
          <button onClick={() => apercu.type==='ventes' ? rapportVentes() : apercu.type==='approv' ? rapportApprovisionnements() : rapportCredits()}
            style={{ padding:'5px 14px', borderRadius:8, border:'none', backgroundColor:'#404040', color:'#fff', fontSize:12, cursor:'pointer', fontWeight:700 }}>
            OK
          </button>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo('');
                setTimeout(() => apercu.type==='ventes' ? rapportVentes() : apercu.type==='approv' ? rapportApprovisionnements() : rapportCredits(), 0); }}
              style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #ccc', backgroundColor:'#fff', color:'#666', fontSize:12, cursor:'pointer' }}>
              ✕ Réinitialiser
            </button>
          )}
        </div>
        {/* Tableau */}
        <div style={{ flex:1, overflowY:'auto', overflowX:'auto', padding:12 }}>
          {apercu.lignes.length === 0 ? (
            <div style={{ padding:40, textAlign:'center', color:'#888', fontSize:13 }}>Aucune donnee.</div>
          ) : (
            <table style={{ borderCollapse:'collapse', minWidth:'100%', border:'1px solid #ddd', backgroundColor:'#fff' }}>
              <thead>
                <tr>
                  {cols.map((c,i) => <th key={i} style={thS}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {apercu.lignes.map((l, i) => renderRow(l, i))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer total + bouton */}
        {apercu.lignes.length > 0 && (
          <div style={{ backgroundColor:'#fff', borderTop:'2px solid #ddd', padding:'10px 16px', flexShrink:0 }}>
            {apercu.totalGeneral !== undefined && (
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                <span style={{ fontWeight:700, fontSize:13, color:'#333' }}>Total general</span>
                <span style={{ fontWeight:800, fontSize:16, color:'#222', fontFamily:'monospace' }}>{fmtMoney(apercu.totalGeneral)}</span>
              </div>
            )}
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={handleSavePdf} style={{ flex:1, padding:'13px 0', borderRadius:10, border:'none', backgroundColor:'#404040', color:'#fff', fontWeight:800, fontSize:13, cursor:'pointer' }}>
                📄 Enregistrer
              </button>
              <button onClick={handleEnvoyerPdf} style={{ flex:1, padding:'13px 0', borderRadius:10, border:'none', backgroundColor:'#404040', color:'#fff', fontWeight:800, fontSize:13, cursor:'pointer' }}>
                📤 Envoyer
              </button>
              <button onClick={handleImprimer} style={{ flex:1, padding:'13px 0', borderRadius:10, border:'none', backgroundColor:'#404040', color:'#fff', fontWeight:800, fontSize:13, cursor:'pointer' }}>
                🖨 Imprimer
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

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
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <RapportBtn label="Rapport de ventes" icon="🛍" onClick={rapportVentes} />
        <RapportBtn label="Rapport approv." icon="📦" onClick={rapportApprovisionnements} />
        <RapportBtn label="Rapport credits" icon="💳" onClick={rapportCredits} />
      </div>

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
