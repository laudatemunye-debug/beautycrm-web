import { useState, useEffect, useCallback } from 'react';
import { C } from '../theme';
import { getCredits, getClients, saveCredit, deleteCredit, ajouterVersement, getProduits, adjustStock, today, nowISO, saveVente, getSetting, setSetting } from '../db/index';
import { SearchBar, SectionTitle, FieldInput, PickerSelect, Modal, FormFooter, fmtMoney, fmtDate } from '../components/UI';
import { useDevise } from '../hooks/useDevise';
import jsPDF from 'jspdf';

// ─── Formulaire nouveau credit ────────────────────────────────────────────────
const CreditForm = ({ onClose, onSaved }) => {
  const [clients, setClients] = useState([]);
  const [produits, setProduits] = useState([]);
  const [clientNom, setClientNom] = useState('');
  const [form, setForm] = useState({ produit: '', prix_achat: '', prix_vente: '', quantite: '1', avance: '0', date_echeance: '', notes: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [factureData, setFactureData] = useState(null);
  const [factureEntete, setFactureEntete] = useState({});
  const devise = useDevise();

  useEffect(() => { getClients().then(setClients); getProduits().then(setProduits); }, []);

  const onProduitChange = (nom) => {
    const p = produits.find(x => x.nom === nom);
    setForm(f => ({ ...f, produit: nom, prix_achat: p?.prix_achat ? String(p.prix_achat) : f.prix_achat, prix_vente: p?.prix_vente ? String(p.prix_vente) : f.prix_vente }));
  };

  const montant_total = (parseFloat(form.prix_vente) || 0) * (parseInt(form.quantite) || 1);
  const avance = parseFloat(form.avance) || 0;
  const montant_restant = Math.max(0, montant_total - avance);

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
    if (!form.produit) { setError('Choisissez un produit.'); return; }
    const pv = parseFloat(form.prix_vente);
    if (!pv || pv <= 0) { setError('Prix de vente invalide.'); return; }
    const qte = parseInt(form.quantite) || 1;
    const produitSel = produits.find(p => p.nom === form.produit);
    if (produitSel && produitSel.stock != null && qte > produitSel.stock) { setError('Stock insuffisant. Disponible : '+produitSel.stock+'.'); return; }
    if (avance > montant_total) { setError('Avance superieure au total.'); return; }
    setLoading(true);
    try {
      const ent = await buildEntete();
      if (avance === montant_total) {
        const annee = new Date().getFullYear();
        const cle = 'facture_compteur_'+annee;
        const actuel = parseInt(await getSetting(cle)) || 0;
        await setSetting(cle, String(actuel + 1));
        const numero = 'FAC-'+annee+'-'+String(actuel+1).padStart(4,'0');
        await saveVente({ client_id: clientFound._id, produit: form.produit, quantite: qte, prix_achat: parseFloat(form.prix_achat)||0, prix_vente: pv, date_vente: today(), methode_paiement: 'Cash', notes: form.notes, statut_paiement: 'paye' });
        if (produitSel && produitSel.stock != null) await adjustStock(form.produit, -qte);
        setFactureEntete(ent);
        setFactureData({ clientNom: clientFound.nom, produit: form.produit, quantite: qte, prix_vente: pv, montant_total, avance: montant_total, montant_restant: 0, date: today(), date_echeance: null, numero });
      } else {
        const versements = avance > 0 ? [{ date: nowISO(), montant: avance }] : [];
        await saveCredit({ client_id: clientFound._id, produit: form.produit, quantite: qte, prix_achat: parseFloat(form.prix_achat)||0, prix_vente: pv, montant_total, avance, montant_restant, versements, statut: avance > 0 ? 'partiel' : 'non_paye', date_vente: today(), date_echeance: form.date_echeance||null, notes: form.notes });
        if (produitSel && produitSel.stock != null) await adjustStock(form.produit, -qte);
        setFactureEntete(ent);
        setFactureData({ clientNom: clientFound.nom, produit: form.produit, quantite: qte, prix_vente: pv, montant_total, avance, montant_restant, date: today(), date_echeance: form.date_echeance||null });
      }
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const buildPdf = async (fd, ent) => {
    const symbol = window.__DEVISE_SYMBOL__ || '$';
    const doc = new jsPDF({ unit: 'mm', format: [100, 160] });
    const left = 8; const right = 92; let y = 12;
    let textLeft = left;
    if (ent.logo) { try { doc.addImage(ent.logo, 'PNG', left, y-6, 14, 14); textLeft = left+17; } catch(_) {} }
    doc.setFontSize(14); doc.setFont(undefined,'bold'); doc.text(ent.nom, textLeft, y);
    doc.setFont(undefined,'normal'); y += 5; doc.setFontSize(7.5);
    if (ent.adresse) { doc.text(ent.adresse, textLeft, y); y += 4; }
    if (ent.telephone) { doc.text(ent.telephone, textLeft, y); y += 4; }
    doc.setFontSize(11); doc.setFont(undefined,'bold');
    doc.text('FACTURE CREDIT', right, 12, { align: 'right' });
    doc.setFont(undefined,'normal'); doc.setFontSize(8);
    doc.text(fd.date, right, 17, { align: 'right' });
    y += 4; doc.setDrawColor(200); doc.line(left, y, right, y); y += 6;
    doc.setFontSize(7.5); doc.text('Client', left, y); y += 4;
    doc.setFontSize(10); doc.setFont(undefined,'bold'); doc.text(fd.clientNom, left, y);
    doc.setFont(undefined,'normal'); y += 5; doc.line(left, y, right, y); y += 6;
    doc.setFontSize(7.5);
    doc.text('Produit', left, y); doc.text('Qte', 52, y, {align:'center'}); doc.text('Prix', 70, y, {align:'right'}); doc.text('Total', right, y, {align:'right'});
    y += 5; doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.text(fd.produit, left, y);
    doc.setFont(undefined,'normal');
    doc.text(String(fd.quantite), 52, y, {align:'center'});
    doc.text(fd.prix_vente.toLocaleString('fr-FR')+' '+symbol, 70, y, {align:'right'});
    doc.setFont(undefined,'bold'); doc.text(fd.montant_total.toLocaleString('fr-FR')+' '+symbol, right, y, {align:'right'});
    doc.setFont(undefined,'normal'); y += 6; doc.line(left, y, right, y); y += 6;
    doc.setFontSize(8); doc.text('Avance recue :', left, y);
    doc.setFont(undefined,'bold'); doc.text(fd.avance.toLocaleString('fr-FR')+' '+symbol, right, y, {align:'right'});
    doc.setFont(undefined,'normal'); y += 6;
    doc.setFontSize(10); doc.setFont(undefined,'bold'); doc.setTextColor(200,0,0);
    doc.text('Reste a payer :', left, y);
    doc.text(fd.montant_restant.toLocaleString('fr-FR')+' '+symbol, right, y, {align:'right'});
    doc.setTextColor(0,0,0); doc.setFont(undefined,'normal');
    if (fd.date_echeance) { y += 6; doc.setFontSize(8); doc.text('Echeance : '+fd.date_echeance, left, y); }
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

  const envoyerWhatsApp = async () => {
    const ent = await buildEntete();
    const doc = await buildPdf(factureData, ent);
    const blob = doc.output('blob');
    const file = new File([blob], 'credit-'+factureData.clientNom+'.pdf', { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Facture Credit', text: 'Credit pour '+factureData.clientNom }); return; } catch(_) {}
    }
    doc.save('credit-'+factureData.clientNom+'.pdf');
  };

  if (factureData) {
    const estCredit = factureData.montant_restant > 0;
    return (
      <Modal visible onClose={() => { setFactureData(null); onSaved(); }} title="Facture generee">
        <div style={{ padding: 16 }}>
          <div style={{ backgroundColor: C.success+'15', borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: C.success, marginBottom: 4 }}>{estCredit ? 'Credit enregistre' : 'Vente enregistree'}</div>
            <div style={{ fontSize: 13, color: C.text_secondary }}>{factureData.clientNom} - {factureData.produit} x{factureData.quantite}</div>
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
                <div style={{ fontWeight: 800, fontSize: 14, color: C.accent }}>{estCredit ? 'FACTURE CREDIT' : 'FACTURE'}</div>
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
                  <th style={{ paddingBottom: 6, textAlign: 'right' }}>Prix unit.</th>
                  <th style={{ paddingBottom: 6, textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderTop: '1px solid '+C.border }}>
                  <td style={{ padding: '8px 0', fontWeight: 600 }}>{factureData.produit}</td>
                  <td style={{ padding: '8px 0', textAlign: 'center' }}>{factureData.quantite}</td>
                  <td style={{ padding: '8px 0', textAlign: 'right' }}>{fmtMoney(factureData.prix_vente)}</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700 }}>{fmtMoney(factureData.montant_total)}</td>
                </tr>
              </tbody>
            </table>
            <div style={{ borderTop: '1px solid '+C.border, paddingTop: 10 }}>
              {estCredit && (
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
              )}
              {!estCredit && (
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
          <button onClick={downloadPdf} style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', backgroundColor: C.accent, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Enregistrer (PDF)</button>
          <button onClick={envoyerWhatsApp} style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', backgroundColor: '#25D366', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Envoyer la facture</button>
          <button onClick={() => { setFactureData(null); onSaved(); }} style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: '1.5px solid '+C.border, backgroundColor: 'transparent', color: C.text_secondary, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Quitter sans enregistrer</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal visible onClose={onClose} title="Nouveau credit">
      <div style={{ padding: 16 }}>
        {error && <div style={{ color: C.danger, backgroundColor: C.danger+'15', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13 }}>{error}</div>}
        <PickerSelect label="Client *" value={clientNom} onChange={setClientNom} options={['', ...clients.map(c => c.nom)]} />
        <PickerSelect label="Produit *" value={form.produit} onChange={onProduitChange} options={['', ...produits.map(p => p.nom)]} />
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><FieldInput label="Prix vente *" value={form.prix_vente} onChange={v => setForm(f=>({...f,prix_vente:v}))} type="number" /></div>
          <div style={{ flex: 1 }}><FieldInput label="Quantite" value={form.quantite} onChange={v => setForm(f=>({...f,quantite:v}))} type="number" /></div>
        </div>
        <FieldInput label="Avance recue" value={form.avance} onChange={v => setForm(f=>({...f,avance:v}))} type="number" placeholder="0" />
        <FieldInput label="Date echeance (optionnel)" value={form.date_echeance} onChange={v => setForm(f=>({...f,date_echeance:v}))} type="date" />
        <FieldInput label="Notes" value={form.notes} onChange={v => setForm(f=>({...f,notes:v}))} placeholder="Remarques..." />
        {form.prix_vente && (
          <div style={{ backgroundColor: C.danger+'10', borderRadius: 10, padding: 12, marginBottom: 14, border: '1.5px solid '+C.danger+'30' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: C.text_secondary }}>Total</span>
              <span style={{ fontWeight: 700, color: C.text_primary }}>{fmtMoney(montant_total)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: C.text_secondary }}>Avance</span>
              <span style={{ fontWeight: 700, color: C.success }}>-{fmtMoney(avance)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid '+C.danger+'30', paddingTop: 6, marginTop: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: C.danger }}>Reste a payer</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: C.danger }}>{fmtMoney(montant_restant)}</span>
            </div>
          </div>
        )}
      </div>
      <FormFooter onSave={save} onClose={onClose} loading={loading} saveLabel="Enregistrer le credit" />
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
const DetailCredit = ({ credit, clientNom, clientTel, onClose, onVerser, onSolde, onWhatsApp }) => {
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

        {credit.statut !== 'paye' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={onVerser} style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', backgroundColor: C.success, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Ajouter un versement</button>
            {clientTel && <button onClick={onWhatsApp} style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', backgroundColor: '#25D366', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Envoyer rappel WhatsApp</button>}
            <button onClick={onSolde} style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: '1.5px solid '+C.success, backgroundColor: 'transparent', color: C.success, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Marquer comme solde</button>
          </div>
        )}
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
    const msg = encodeURIComponent('Bonjour '+nom+', vous avez un credit de '+fmtMoney(credit.montant_restant)+' en cours pour '+credit.produit+'. Merci de regulariser votre situation.');
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
        />
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
