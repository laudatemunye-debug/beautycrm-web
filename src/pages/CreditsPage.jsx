import { useState, useEffect, useCallback } from 'react';
import { C } from '../theme';
import { getCredits, getClients, saveCredit, deleteCredit, ajouterVersement, getProduits, adjustStock, today, nowISO, saveVente, getSetting, setSetting } from '../db/index';
import { SearchBar, SectionTitle, FieldInput, PickerSelect, Modal, FormFooter, fmtMoney, fmtDate } from '../components/UI';
import { useDevise } from '../hooks/useDevise';
import jsPDF from 'jspdf';

// ─── Formulaire nouveau credit (multi-produits) ───────────────────────────────
const CreditForm = ({ onClose, onSaved }) => {
  const [clients, setClients] = useState([]);
  const [produits, setProduits] = useState([]);
  const [clientNom, setClientNom] = useState('');
  const [panier, setPanier] = useState([]);
  const [itemForm, setItemForm] = useState({ produit: '', prix_achat: '', prix_vente: '', quantite: '1' });
  const [avance, setAvance] = useState('0');
  const [dateEcheance, setDateEcheance] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [factureData, setFactureData] = useState(null);
  const [factureEntete, setFactureEntete] = useState({});
  const [showApercu, setShowApercu] = useState(false);

  useEffect(() => { getClients().then(setClients); getProduits().then(setProduits); }, []);

  const onProduitChange = (nom) => {
    const p = produits.find(x => x.nom === nom);
    setItemForm(f => ({ ...f, produit: nom, prix_achat: p?.prix_achat ? String(p.prix_achat) : f.prix_achat, prix_vente: p?.prix_vente ? String(p.prix_vente) : f.prix_vente }));
  };

  const ajouterAuPanier = () => {
    if (!itemForm.produit) { setError('Choisissez un produit.'); return; }
    const pv = parseFloat(itemForm.prix_vente);
    if (!pv || pv <= 0) { setError('Prix de vente invalide.'); return; }
    const qte = parseInt(itemForm.quantite) || 1;
    const produitSel = produits.find(p => p.nom === itemForm.produit);
    const dejaDansPanier = panier.find(it => it.produit === itemForm.produit);
    const qteDejaAjoutee = dejaDansPanier ? dejaDansPanier.quantite : 0;
    if (produitSel && produitSel.stock != null && (qte + qteDejaAjoutee) > produitSel.stock) {
      setError('Stock insuffisant. Disponible : ' + (produitSel.stock - qteDejaAjoutee) + '.');
      return;
    }
    setError('');
    setPanier(p => {
      const existe = p.find(it => it.produit === itemForm.produit);
      if (existe) {
        return p.map(it => it.produit === itemForm.produit
          ? { ...it, quantite: it.quantite + qte, prix_vente: pv, prix_achat: parseFloat(itemForm.prix_achat) || it.prix_achat }
          : it);
      }
      return [...p, { _key: Date.now() + Math.random(), produit: itemForm.produit, prix_achat: parseFloat(itemForm.prix_achat) || 0, prix_vente: pv, quantite: qte }];
    });
    setItemForm({ produit: '', prix_achat: '', prix_vente: '', quantite: '1' });
  };

  const retirerDuPanier = (key) => setPanier(p => p.filter(it => it._key !== key));

  const modifierItemPanier = (key, champ, valeur) => {
    setPanier(p => p.map(it => {
      if (it._key !== key) return it;
      if (champ === 'quantite') return { ...it, quantite: Math.max(1, parseInt(valeur) || 1) };
      if (champ === 'prix_vente') return { ...it, prix_vente: parseFloat(valeur) || 0 };
      return it;
    }));
  };

  const totalPanier = panier.reduce((s, it) => s + it.prix_vente * it.quantite, 0);
  const avanceNum = parseFloat(avance) || 0;
  const montant_restant = Math.max(0, totalPanier - avanceNum);

  const buildEntete = async () => {
    const nom = await getSetting('facture_entreprise_nom') || await getSetting('entreprise') || 'BeautyCRM';
    const adresse = [await getSetting('ville')||'', await getSetting('pays')||''].filter(Boolean).join(', ');
    const telephone = await getSetting('facture_entreprise_telephone') || await getSetting('telephone') || '';
    const email = await getSetting('facture_entreprise_email') || await getSetting('email') || '';
    const username = await getSetting('username') || '';
    const logo = await getSetting('facture_entreprise_logo') || '';
    return { nom, adresse, telephone, email, username, logo, genereeLe: new Date().toLocaleString('fr-FR') };
  };

  const save = async () => {
    setError('');
    const clientFound = clients.find(c => c.nom === clientNom);
    if (!clientFound) { setError('Choisissez un client.'); return; }
    if (panier.length === 0) { setError('Ajoutez au moins un produit.'); return; }
    if (avanceNum > totalPanier) { setError('Avance superieure au total.'); return; }
    setLoading(true);
    try {
      const ent = await buildEntete();
      if (avanceNum === totalPanier) {
        // Paiement complet → ventes normales
        const annee = new Date().getFullYear();
        const cle = 'facture_compteur_'+annee;
        const actuel = parseInt(await getSetting(cle)) || 0;
        await setSetting(cle, String(actuel + 1));
        const numero = 'FAC-'+annee+'-'+String(actuel+1).padStart(4,'0');
        for (const item of panier) {
          await saveVente({ client_id: clientFound._id, produit: item.produit, quantite: item.quantite, prix_achat: item.prix_achat, prix_vente: item.prix_vente, date_vente: today(), methode_paiement: 'Cash', notes, statut_paiement: 'paye' });
          const ps = produits.find(p => p.nom === item.produit);
          if (ps && ps.stock != null) await adjustStock(item.produit, -item.quantite);
        }
        setFactureEntete(ent);
        setFactureData({ clientNom: clientFound.nom, items: panier, montant_total: totalPanier, avance: totalPanier, montant_restant: 0, date: today(), date_echeance: null, numero, estCredit: false });
      } else {
        // Credit
        const versements = avanceNum > 0 ? [{ date: nowISO(), montant: avanceNum }] : [];
        const lignesCredit = panier.map(it => ({ produit: it.produit, quantite: it.quantite, prix_achat: it.prix_achat, prix_vente: it.prix_vente }));
        // On cree un credit par produit (compatible avec la structure existante)
        for (const item of panier) {
          const itemTotal = item.prix_vente * item.quantite;
          const itemAvance = panier.length === 1 ? avanceNum : 0;
          const itemRestant = Math.max(0, itemTotal - itemAvance);
          const itemVers = itemAvance > 0 && panier.length === 1 ? [{ date: nowISO(), montant: itemAvance }] : [];
          await saveCredit({ client_id: clientFound._id, produit: item.produit, quantite: item.quantite, prix_achat: item.prix_achat, prix_vente: item.prix_vente, montant_total: itemTotal, avance: itemAvance, montant_restant: itemRestant, versements: itemVers, statut: itemAvance >= itemTotal ? 'paye' : itemAvance > 0 ? 'partiel' : 'non_paye', date_vente: today(), date_echeance: dateEcheance||null, notes });
          const ps = produits.find(p => p.nom === item.produit);
          if (ps && ps.stock != null) await adjustStock(item.produit, -item.quantite);
        }
        setFactureEntete(ent);
        setFactureData({ clientNom: clientFound.nom, items: panier, montant_total: totalPanier, avance: avanceNum, montant_restant, date: today(), date_echeance: dateEcheance||null, estCredit: true });
      }
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const buildPdf = async (fd, ent) => {
    const symbol = window.__DEVISE_SYMBOL__ || '$';
    const nbItems = fd.items.length;
    const hauteur = Math.max(160, 120 + nbItems * 10);
    const doc = new jsPDF({ unit: 'mm', format: [100, hauteur] });
    const left = 8; const right = 92; let y = 12;
    let textLeft = left;
    if (ent.logo) { try { doc.addImage(ent.logo, 'PNG', left, y-6, 14, 14); textLeft = left+17; } catch(_) {} }
    doc.setFontSize(14); doc.setFont(undefined,'bold'); doc.text(ent.nom, textLeft, y);
    doc.setFont(undefined,'normal'); y += 5; doc.setFontSize(7.5);
    if (ent.adresse) { doc.text(ent.adresse, textLeft, y); y += 4; }
    if (ent.telephone) { doc.text(ent.telephone, textLeft, y); y += 4; }
    doc.setFontSize(11); doc.setFont(undefined,'bold');
    doc.text(fd.estCredit ? 'FACTURE CREDIT' : 'FACTURE', right, 12, { align: 'right' });
    doc.setFont(undefined,'normal'); doc.setFontSize(8);
    if (fd.numero) doc.text(fd.numero, right, 17, { align: 'right' });
    doc.text(fd.date, right, fd.numero ? 21 : 17, { align: 'right' });
    y += 4; doc.setDrawColor(200); doc.line(left, y, right, y); y += 6;
    doc.setFontSize(7.5); doc.text('Client', left, y); y += 4;
    doc.setFontSize(10); doc.setFont(undefined,'bold'); doc.text(fd.clientNom, left, y);
    doc.setFont(undefined,'normal'); y += 5; doc.line(left, y, right, y); y += 6;
    doc.setFontSize(7.5);
    doc.text('Produit', left, y); doc.text('Qte', 44, y, {align:'center'}); doc.text('P.Unit', 66, y, {align:'right'}); doc.text('Total', right, y, {align:'right'});
    y += 5;
    for (const item of fd.items) {
      const nomProduit = item.produit.length > 16 ? item.produit.substring(0, 15)+'.' : item.produit;
      doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.text(nomProduit, left, y);
      doc.setFont(undefined,'normal');
      doc.text(String(item.quantite), 44, y, {align:'center'});
      doc.text(String(Math.round(item.prix_vente)), 66, y, {align:'right'});
      doc.setFont(undefined,'bold'); doc.text(String(Math.round(item.prix_vente*item.quantite))+' '+symbol, right, y, {align:'right'});
      doc.setFont(undefined,'normal'); y += 8;
    }
    doc.line(left, y, right, y); y += 6;
    if (fd.estCredit) {
      doc.setFontSize(8); doc.text('Avance recue :', left, y);
      doc.setFont(undefined,'bold'); doc.text(String(Math.round(fd.avance))+' '+symbol, right, y, {align:'right'});
      doc.setFont(undefined,'normal'); y += 6;
      doc.setFontSize(10); doc.setFont(undefined,'bold'); doc.setTextColor(200,0,0);
      doc.text('Reste a payer :', left, y);
      doc.text(String(Math.round(fd.montant_restant))+' '+symbol, right, y, {align:'right'});
      doc.setTextColor(0,0,0); doc.setFont(undefined,'normal');
      if (fd.date_echeance) { y += 6; doc.setFontSize(8); doc.text('Echeance : '+fd.date_echeance, left, y); }
    } else {
      doc.setFontSize(8); doc.text('Paiement : Cash', left, y);
      doc.setFontSize(13); doc.setFont(undefined,'bold');
      doc.text(String(Math.round(fd.montant_total))+' '+symbol, right, y, {align:'right'});
      doc.setFont(undefined,'normal');
    }
    y += 10; doc.setLineDashPattern([1,1],0); doc.line(left, y, right, y); doc.setLineDashPattern([],0); y += 6;
    doc.setFontSize(6.5); doc.text('Emis par '+ent.username+' le '+ent.genereeLe, (left+right)/2, y, {align:'center'}); y += 4;
    doc.text('Designed by IZIsoft', (left+right)/2, y, {align:'center'});
    return doc;
  };

  const downloadPdf = async () => {
    const ent = await buildEntete();
    const doc = await buildPdf(factureData, ent);
    doc.save('credit-'+factureData.clientNom+'-'+factureData.date+'.pdf');
  };

  const envoyerPdf = async () => {
    const ent = await buildEntete();
    const doc = await buildPdf(factureData, ent);
    const blob = doc.output('blob');
    const file = new File([blob], 'credit-'+factureData.clientNom+'.pdf', { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Facture Credit', text: 'Credit pour '+factureData.clientNom }); return; } catch(_) {}
    }
    doc.save('credit-'+factureData.clientNom+'.pdf');
  };

  // ── Ecran facture ──
  if (factureData) {
    return (
      <Modal visible onClose={() => { setFactureData(null); onSaved(); }} title="Facture generee">
        <div style={{ padding: 16 }}>
          <div style={{ backgroundColor: C.success+'15', borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: C.success, marginBottom: 4 }}>{factureData.estCredit ? 'Credit enregistre' : 'Vente enregistree'}</div>
            <div style={{ fontSize: 13, color: C.text_secondary }}>{factureData.clientNom} · {factureData.items.length} produit(s)</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text_primary, marginTop: 6 }}>{fmtMoney(factureData.montant_total)}</div>
          </div>
          <div style={{ border: '1px solid '+C.border, borderRadius: 12, padding: 18, marginBottom: 16, backgroundColor: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                {factureEntete.logo && <img src={factureEntete.logo} alt="logo" style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 6 }} />}
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: C.text_primary }}>{factureEntete.nom}</div>
                  {factureEntete.adresse && <div style={{ fontSize: 11, color: C.text_secondary, marginTop: 2 }}>{factureEntete.adresse}</div>}
                  {factureEntete.telephone && <div style={{ fontSize: 11, color: C.text_secondary }}>Tel : {factureEntete.telephone}</div>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: C.accent }}>{factureData.estCredit ? 'FACTURE CREDIT' : 'FACTURE'}</div>
                {factureData.numero && <div style={{ fontSize: 11, color: C.text_secondary, marginTop: 2 }}>{factureData.numero}</div>}
                <div style={{ fontSize: 11, color: C.text_secondary }}>{fmtDate(factureData.date)}</div>
              </div>
            </div>
            <div style={{ borderTop: '1px solid '+C.border, borderBottom: '1px solid '+C.border, padding: '10px 0', marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: C.text_secondary }}>Client</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.text_primary }}>{factureData.clientNom}</div>
            </div>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', marginBottom: 10 }}>
              <thead>
                <tr style={{ color: C.text_secondary, fontSize: 11 }}>
                  <th style={{ paddingBottom: 6, textAlign: 'left' }}>Produit</th>
                  <th style={{ paddingBottom: 6, textAlign: 'center' }}>Qte</th>
                  <th style={{ paddingBottom: 6, textAlign: 'right' }}>Prix</th>
                  <th style={{ paddingBottom: 6, textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {factureData.items.map((item, i) => (
                  <tr key={i} style={{ borderTop: '1px solid '+C.border }}>
                    <td style={{ padding: '8px 0', fontWeight: 600 }}>{item.produit}</td>
                    <td style={{ padding: '8px 0', textAlign: 'center' }}>{item.quantite}</td>
                    <td style={{ padding: '8px 0', textAlign: 'right' }}>{fmtMoney(item.prix_vente)}</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700 }}>{fmtMoney(item.prix_vente * item.quantite)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ borderTop: '1px solid '+C.border, paddingTop: 10 }}>
              {factureData.estCredit ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: C.text_secondary }}>Avance recue</span>
                    <span style={{ fontWeight: 700, color: C.success }}>{fmtMoney(factureData.avance)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: C.text_secondary }}>Reste a payer</span>
                    <span style={{ fontWeight: 800, color: C.danger }}>{fmtMoney(factureData.montant_restant)}</span>
                  </div>
                  {factureData.date_echeance && <div style={{ fontSize: 11, color: C.text_secondary, marginTop: 6 }}>Echeance : {fmtDate(factureData.date_echeance)}</div>}
                </>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, color: C.text_secondary }}>Paiement : Cash</div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: C.success }}>{fmtMoney(factureData.montant_total)}</div>
                </div>
              )}
            </div>
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px dashed '+C.border, fontSize: 10, color: C.text_secondary, textAlign: 'center' }}>
              Emis par {factureEntete.username} le {factureEntete.genereeLe}<br />Designed by IZIsoft
            </div>
          </div>
        </div>
        <div style={{ padding: 16, borderTop: '1px solid '+C.border, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={downloadPdf} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', backgroundColor: C.accent, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>⬇ Enregistrer</button>
            <button onClick={envoyerPdf} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', backgroundColor: '#25D366', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>📤 Envoyer</button>
          </div>
          <button onClick={async () => {
            const ent = await buildEntete();
            const doc = await buildPdf(factureData, ent);
            const blob = doc.output('blob');
            const url = URL.createObjectURL(blob);
            const win = window.open(url, '_blank');
            if (win) {
              win.onload = () => {
                setTimeout(() => { win.focus(); win.print(); }, 500);
              };
            }
          }} style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', backgroundColor: '#374151', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>🖨️ Imprimer</button>
          <button onClick={() => { setFactureData(null); onSaved(); }} style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: '1.5px solid '+C.border, backgroundColor: 'transparent', color: C.text_secondary, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Quitter sans enregistrer</button>
        </div>
      </Modal>
    );
  }

  // ── Ecran apercu avant enregistrement ──
  if (showApercu) {
    return (
      <Modal visible onClose={() => setShowApercu(false)} title="Apercu du credit">
        <div style={{ overflowY: 'auto', padding: 16 }}>
          <div style={{ backgroundColor: C.danger+'10', borderRadius: 10, padding: 14, marginBottom: 14, border: '1.5px solid '+C.danger+'30' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.text_primary, marginBottom: 4 }}>{clientNom}</div>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <tbody>
                {panier.map((item, i) => (
                  <tr key={i}>
                    <td style={{ padding: '4px 0', color: C.text_primary, fontWeight: 600 }}>{item.produit}</td>
                    <td style={{ textAlign: 'center', color: C.text_secondary }}>x{item.quantite}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: C.text_primary }}>{fmtMoney(item.prix_vente * item.quantite)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ borderTop: '1px solid '+C.danger+'30', marginTop: 8, paddingTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: C.text_secondary }}>Total</span>
                <span style={{ fontWeight: 700 }}>{fmtMoney(totalPanier)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: C.text_secondary }}>Avance</span>
                <span style={{ fontWeight: 700, color: C.success }}>-{fmtMoney(avanceNum)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.danger }}>Reste a payer</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: C.danger }}>{fmtMoney(montant_restant)}</span>
              </div>
            </div>
            {dateEcheance && <div style={{ fontSize: 11, color: C.text_secondary, marginTop: 8 }}>Echeance : {fmtDate(dateEcheance)}</div>}
          </div>
        </div>
        <div style={{ position: 'sticky', bottom: 0, padding: 16, borderTop: '1px solid '+C.border, backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={save} disabled={loading} style={{ width: '100%', padding: '13px 0', borderRadius: 10, border: 'none', backgroundColor: C.danger, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>{loading ? '...' : 'Confirmer le credit'}</button>
          <button onClick={() => setShowApercu(false)} style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: '1.5px solid '+C.border, backgroundColor: 'transparent', color: C.text_secondary, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Modifier</button>
        </div>
      </Modal>
    );
  }

  // ── Formulaire principal ──
  return (
    <Modal visible onClose={onClose} title="💳 Nouveau credit">
      <div style={{ padding: 16 }}>
        {error && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setError('')}>
            <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#fff', borderRadius: 14, padding: 24, maxWidth: 320, width: '90%', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>⛔</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text_primary, marginBottom: 16 }}>{error}</div>
              <button onClick={() => setError('')} style={{ backgroundColor: C.accent, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>OK</button>
            </div>
          </div>
        )}
        <PickerSelect label="Client *" value={clientNom} onChange={setClientNom} options={['', ...clients.map(c => c.nom)]} />
        <div style={{ backgroundColor: C.accent+'08', borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 10 }}>Ajouter un produit</div>
          <PickerSelect label="Produit *" value={itemForm.produit} onChange={onProduitChange} options={['', ...produits.map(p => p.nom)]} />
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><FieldInput label="Prix vente *" value={itemForm.prix_vente} onChange={v => setItemForm(f=>({...f,prix_vente:v}))} type="number" /></div>
            <div style={{ flex: 1 }}><FieldInput label="Quantite" value={itemForm.quantite} onChange={v => setItemForm(f=>({...f,quantite:v}))} type="number" /></div>
          </div>
          <button onClick={ajouterAuPanier} style={{ width: '100%', background: C.accent, color: '#fff', border: 'none', borderRadius: 10, padding: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Ajouter au panier</button>
        </div>
        {panier.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text_secondary, marginBottom: 8 }}>PANIER ({panier.length} produit{panier.length > 1 ? 's' : ''})</div>
            {panier.map(item => (
              <div key={item._key} style={{ backgroundColor: '#fff', border: '1px solid '+C.border, borderRadius: 10, padding: 10, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: C.text_primary }}>{item.produit}</span>
                  <button onClick={() => retirerDuPanier(item._key)} style={{ background: 'transparent', border: 'none', color: C.danger, fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: C.text_secondary, marginBottom: 3 }}>Quantite</div>
                    <input type="number" value={item.quantite} onChange={e => modifierItemPanier(item._key, 'quantite', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#fff', border: '1px solid '+C.border, borderRadius: 8, padding: 8, fontSize: 13 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: C.text_secondary, marginBottom: 3 }}>Prix vente</div>
                    <input type="number" value={item.prix_vente} onChange={e => modifierItemPanier(item._key, 'prix_vente', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#fff', border: '1px solid '+C.border, borderRadius: 8, padding: 8, fontSize: 13 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: C.text_secondary, marginBottom: 3 }}>Total</div>
                    <div style={{ padding: 8, fontSize: 13, fontWeight: 700, color: C.success }}>{fmtMoney(item.prix_vente * item.quantite)}</div>
                  </div>
                </div>
              </div>
            ))}
            <div style={{ backgroundColor: C.danger+'10', borderRadius: 10, padding: 12, border: '1.5px solid '+C.danger+'30' }}>
              <FieldInput label="Avance recue" value={avance} onChange={setAvance} type="number" placeholder="0" />
              <FieldInput label="Date echeance (optionnel)" value={dateEcheance} onChange={setDateEcheance} type="date" />
              <FieldInput label="Notes" value={notes} onChange={setNotes} placeholder="Remarques..." />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: C.text_secondary }}>Total</span>
                <span style={{ fontWeight: 700 }}>{fmtMoney(totalPanier)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: C.text_secondary }}>Avance</span>
                <span style={{ fontWeight: 700, color: C.success }}>-{fmtMoney(avanceNum)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid '+C.danger+'30', paddingTop: 6, marginTop: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.danger }}>Reste a payer</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: C.danger }}>{fmtMoney(montant_restant)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
      <FormFooter onSave={() => { if (!clientNom) { setError('Choisissez un client.'); return; } if (panier.length === 0) { setError('Ajoutez au moins un produit.'); return; } setShowApercu(true); }} onClose={onClose} loading={loading} saveLabel="Apercu & Confirmer" />
    </Modal>
  );
};

// ─── Modal versement ──────────────────────────────────────────────────────────
const VersementForm = ({ credit, clientNom, onClose, onSaved }) => {
  const [montant, setMontant] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setError('');
    const m = parseFloat(montant);
    if (!m || m <= 0) { setError('Montant invalide.'); return; }
    if (m > credit.montant_restant) { setError('Maximum : '+credit.montant_restant); return; }
    setLoading(true);
    try { await ajouterVersement(credit._id, m); onSaved(); }
    catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible onClose={onClose} title="Ajouter un versement">
      <div style={{ padding: 16 }}>
        {error && <div style={{ color: C.danger, backgroundColor: C.danger+'15', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13 }}>{error}</div>}
        <div style={{ backgroundColor: C.accent+'10', borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text_primary, marginBottom: 2 }}>{clientNom}</div>
          <div style={{ fontSize: 12, color: C.text_secondary }}>{credit.produit} x{credit.quantite}</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.danger, marginTop: 6 }}>Reste : {fmtMoney(credit.montant_restant)}</div>
        </div>
        <FieldInput label="Montant verse *" value={montant} onChange={setMontant} type="number" placeholder={'Max : '+credit.montant_restant} />
      </div>
      <FormFooter onSave={save} onClose={onClose} loading={loading} saveLabel="Confirmer le versement" />
    </Modal>
  );
};

// ─── Modal detail credit ──────────────────────────────────────────────────────
const DetailCredit = ({ credit, clientNom, clientTel, onClose, onVerser, onSolde, onWhatsApp, onSupprimer }) => {
  const pct = credit.montant_total > 0 ? Math.round(((credit.montant_total - credit.montant_restant) / credit.montant_total) * 100) : 0;
  const statutConfig = { non_paye: { label: 'Non paye', color: C.danger }, partiel: { label: 'Partiel', color: '#F59E0B' }, paye: { label: 'Paye', color: C.success } };
  const cfg = statutConfig[credit.statut] || statutConfig.non_paye;

  return (
    <Modal visible onClose={onClose} title="Detail du credit">
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: C.text_primary }}>{clientNom}</div>
            <div style={{ fontSize: 13, color: C.text_secondary }}>{credit.produit} x{credit.quantite}</div>
            {credit.date_echeance && <div style={{ fontSize: 11, color: '#F59E0B', marginTop: 2 }}>Echeance : {fmtDate(credit.date_echeance)}</div>}
          </div>
          <span style={{ fontSize: 12, backgroundColor: cfg.color+'20', color: cfg.color, borderRadius: 8, padding: '4px 10px', fontWeight: 700 }}>{cfg.label}</span>
        </div>

        <div style={{ backgroundColor: C.accent+'08', borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: C.text_secondary }}>Total</span>
            <span style={{ fontWeight: 700, color: C.text_primary }}>{fmtMoney(credit.montant_total)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: C.text_secondary }}>Reste a payer</span>
            <span style={{ fontWeight: 800, fontSize: 15, color: credit.statut === 'paye' ? C.success : C.danger }}>{fmtMoney(credit.montant_restant)}</span>
          </div>
          <div style={{ backgroundColor: C.border, borderRadius: 6, height: 8, overflow: 'hidden' }}>
            <div style={{ width: pct+'%', backgroundColor: pct === 100 ? C.success : '#F59E0B', height: '100%', borderRadius: 6 }} />
          </div>
          <div style={{ fontSize: 11, color: C.text_secondary, marginTop: 4, textAlign: 'right' }}>{pct}% regle</div>
        </div>

        {credit.versements && credit.versements.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.text_secondary, marginBottom: 8 }}>HISTORIQUE DES VERSEMENTS</div>
            <div style={{ borderRadius: 10, overflow: 'hidden', border: '1.5px solid '+C.border }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', backgroundColor: C.accent+'18', borderBottom: '1px solid '+C.border }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: C.text_secondary, padding: '8px 10px', borderRight: '1px solid '+C.border }}>DATE</div>
                <div style={{ fontSize: 10, fontWeight: 800, color: C.text_secondary, padding: '8px 10px', textAlign: 'right' }}>MONTANT</div>
              </div>
              {credit.versements.map((v, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: i > 0 ? '1px solid '+C.border : 'none', backgroundColor: i % 2 === 0 ? C.surface : C.accent+'05' }}>
                  <div style={{ fontSize: 12, color: C.text_secondary, padding: '9px 10px', borderRight: '1px solid '+C.border }}>{fmtDate(v.date.split('T')[0])}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.success, padding: '9px 10px', textAlign: 'right' }}>+{fmtMoney(v.montant)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {credit.statut !== 'paye' && (
            <>
              <button onClick={onVerser} style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', backgroundColor: C.success, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Ajouter un versement</button>
              <div style={{ display: 'flex', gap: 8 }}>
                {clientTel && <button onClick={onWhatsApp} style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', backgroundColor: '#25D366', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Rappel WhatsApp</button>}
                <button onClick={onSolde} style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1.5px solid '+C.success, backgroundColor: 'transparent', color: C.success, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Marquer soldé</button>
              </div>
            </>
          )}
          <button onClick={onSupprimer} style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: '1.5px solid '+C.danger, backgroundColor: 'transparent', color: C.danger, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Supprimer cette dette</button>
        </div>
      </div>
    </Modal>
  );
};

// ─── Page principale ──────────────────────────────────────────────────────────
export const CreditsPage = () => {
  const [credits, setCredits] = useState([]);
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [filtre, setFiltre] = useState('tous');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [versementCredit, setVersementCredit] = useState(null);
  const [detailCredit, setDetailCredit] = useState(null);
  const [confirmSupprimer, setConfirmSupprimer] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, cl] = await Promise.all([getCredits(), getClients()]);
    setCredits(c); setClients(cl); setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const getClientNom = (id) => clients.find(c => c._id === id)?.nom || 'Inconnu';
  const getClientTel = (id) => clients.find(c => c._id === id)?.telephone || '';

  const filtered = credits.filter(cr => {
    const nom = getClientNom(cr.client_id).toLowerCase();
    const matchSearch = nom.includes(search.toLowerCase()) || (cr.produit||'').toLowerCase().includes(search.toLowerCase());
    const matchFiltre = filtre === 'tous' || cr.statut === filtre;
    return matchSearch && matchFiltre;
  });

  const totalDette = credits.filter(c => c.statut !== 'paye').reduce((s, c) => s + (c.montant_restant || 0), 0);
  const totalEncaisse = credits.reduce((s, c) => s + (c.versements||[]).reduce((sv, v) => sv + v.montant, 0), 0);

  const envoyerWhatsApp = (credit) => {
    const tel = getClientTel(credit.client_id).replace(/\s/g, '');
    if (!tel) { alert('Pas de numero WhatsApp pour ce client.'); return; }
    const nom = getClientNom(credit.client_id);
    const today2 = new Date(); today2.setHours(0,0,0,0);
    let msgTexte = 'Bonjour '+nom+', vous avez un credit de '+fmtMoney(credit.montant_restant)+' en cours pour '+credit.produit+'.';
    if (credit.date_echeance) {
      const ech = new Date(credit.date_echeance); ech.setHours(0,0,0,0);
      if (ech < today2) {
        const diffMs = today2 - ech;
        const diffJ = Math.floor(diffMs / (1000*60*60*24));
        msgTexte += ' ⚠️ Votre echeance du '+fmtDate(credit.date_echeance)+' est depassee depuis '+diffJ+' jour(s). Votre credit est en retard.';
      } else {
        msgTexte += ' Date d\'echeance : '+fmtDate(credit.date_echeance)+'.';
      }
    }
    msgTexte += ' Merci de regulariser votre situation.';
    const msg = encodeURIComponent(msgTexte);
    window.open('https://wa.me/'+tel+'?text='+msg, '_blank');
  };

  const statutConfig = {
    non_paye: { label: 'Non paye', color: C.danger },
    partiel:  { label: 'Partiel',  color: '#F59E0B' },
    paye:     { label: 'Paye',     color: C.success },
  };

  const cols = ['CLIENT','PRODUIT','TOTAL','RESTE','STATUT','ECH.'];
  const colW = '1.4fr 1.2fr 1fr 1fr 0.8fr 0.8fr';

  return (
    <div style={{ padding: '14px', paddingBottom: 80, width: '100%', boxSizing: 'border-box' }}>

      {/* Resume */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div style={{ backgroundColor: C.danger+'15', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, color: C.danger, fontWeight: 700, marginBottom: 4 }}>TOTAL DETTES</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.danger }}>{fmtMoney(totalDette)}</div>
        </div>
        <div style={{ backgroundColor: C.success+'15', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, color: C.success, fontWeight: 700, marginBottom: 4 }}>ENCAISSE</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.success }}>{fmtMoney(totalEncaisse)}</div>
        </div>
      </div>

      {/* Bouton nouveau */}
      <button onClick={() => setShowForm(true)} style={{ width: '100%', padding: '13px 0', borderRadius: 12, border: 'none', backgroundColor: C.danger, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', marginBottom: 14 }}>
        + Nouveau credit
      </button>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto' }}>
        {[['tous','Tous'],['non_paye','Non payes'],['partiel','Partiels'],['paye','Payes']].map(([val, lab]) => (
          <button key={val} onClick={() => setFiltre(val)} style={{ padding: '6px 14px', borderRadius: 20, border: '1.5px solid '+(filtre===val ? C.accent : C.border), backgroundColor: filtre===val ? C.accent : C.surface, color: filtre===val ? '#fff' : C.text_secondary, fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>{lab}</button>
        ))}
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Chercher client ou produit..." />
      <SectionTitle title={filtered.length+' credit(s)'} />

      {loading
        ? <div style={{ textAlign: 'center', padding: 40, color: C.text_secondary }}>Chargement...</div>
        : filtered.length === 0
          ? <div style={{ textAlign: 'center', padding: 40, color: C.text_secondary, fontSize: 13 }}>Aucun credit trouve.</div>
          : (
            <div style={{ borderRadius: 12, overflow: 'hidden', border: '1.5px solid '+C.border }}>
              {/* En-tete tableau */}
              <div style={{ display: 'grid', gridTemplateColumns: colW, backgroundColor: C.accent+'18', borderBottom: '2px solid '+C.border }}>
                {cols.map((col, ci) => (
                  <div key={col} style={{ fontSize: 10, fontWeight: 800, color: C.text_secondary, padding: '9px 8px', textAlign: ci <= 1 ? 'left' : 'center', borderRight: ci < cols.length-1 ? '1px solid '+C.border : 'none' }}>{col}</div>
                ))}
              </div>
              {/* Lignes */}
              {filtered.map((cr, i) => {
                const nom = getClientNom(cr.client_id);
                const cfg = statutConfig[cr.statut] || statutConfig.non_paye;
                const cell = (ci, extra={}) => ({ padding: '10px 8px', borderRight: ci < cols.length-1 ? '1px solid '+C.border : 'none', borderTop: '1px solid '+C.border, display: 'flex', alignItems: 'center', justifyContent: ci <= 1 ? 'flex-start' : 'center', backgroundColor: i % 2 === 0 ? C.surface : C.accent+'05', ...extra });
                return (
                  <div key={cr._id} style={{ display: 'grid', gridTemplateColumns: colW, cursor: 'pointer' }} onClick={() => setDetailCredit(cr)}>
                    <div style={cell(0)}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: C.text_primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nom}</div>
                    </div>
                    <div style={cell(1)}>
                      <div style={{ fontSize: 11, color: C.text_secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cr.produit} x{cr.quantite}</div>
                    </div>
                    <div style={cell(2)}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.text_primary }}>{fmtMoney(cr.montant_total)}</span>
                    </div>
                    <div style={cell(3)}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: cr.statut === 'paye' ? C.success : C.danger }}>{fmtMoney(cr.montant_restant)}</span>
                    </div>
                    <div style={cell(4)}>
                      <span style={{ fontSize: 10, backgroundColor: cfg.color+'20', color: cfg.color, borderRadius: 6, padding: '2px 6px', fontWeight: 700 }}>{cfg.label}</span>
                    </div>
                    <div style={cell(5)}>
                      <span style={{ fontSize: 10, color: cr.date_echeance ? '#F59E0B' : C.border }}>{cr.date_echeance ? fmtDate(cr.date_echeance).slice(0,5) : '—'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
      }

      {showForm && (
        <CreditForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
      )}

      {detailCredit && (
        <DetailCredit
          credit={detailCredit}
          clientNom={getClientNom(detailCredit.client_id)}
          clientTel={getClientTel(detailCredit.client_id)}
          onClose={() => setDetailCredit(null)}
          onVerser={() => { setVersementCredit(detailCredit); setDetailCredit(null); }}
          onSolde={async () => { if (window.confirm('Marquer comme entierement paye ?')) { await ajouterVersement(detailCredit._id, detailCredit.montant_restant); setDetailCredit(null); load(); } }}
          onWhatsApp={() => envoyerWhatsApp(detailCredit)}
          onSupprimer={() => { setConfirmSupprimer(detailCredit); setDetailCredit(null); }}
        />
      )}

      {confirmSupprimer && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(26,31,54,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, maxWidth: 340, width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: C.text_primary, marginBottom: 10 }}>Supprimer cette dette</div>
            <div style={{ fontSize: 13, color: C.text_secondary, marginBottom: 20 }}>Cette action est irreversible. La dette de {getClientNom(confirmSupprimer.client_id)} pour {confirmSupprimer.produit} sera definitivement supprimee.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmSupprimer(null)} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: '1.5px solid '+C.border, backgroundColor: 'transparent', color: C.text_secondary, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Annuler</button>
              <button onClick={async () => { await deleteCredit(confirmSupprimer._id); setConfirmSupprimer(null); load(); }} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', backgroundColor: C.danger, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {versementCredit && (
        <VersementForm
          credit={versementCredit}
          clientNom={getClientNom(versementCredit.client_id)}
          onClose={() => setVersementCredit(null)}
          onSaved={() => { setVersementCredit(null); load(); }}
        />
      )}
    </div>
  );
};
