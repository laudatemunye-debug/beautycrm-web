import { useState, useEffect, useCallback } from 'react';
import { C, CANAUX } from '../theme';
import { getVentes, getClients, saveClient, saveVente, getProduits, adjustStock, today, deleteVente, getSetting, setSetting } from '../db/index';
import jsPDF from 'jspdf';
import { Card, SearchBar, SectionTitle, PrimaryBtn, GhostBtn, FieldInput, PickerSelect, Modal, FormFooter, Badge, fmtMoney, fmtDate } from "../components/UI";
import { useDevise } from "../hooks/useDevise";

const VenteRapideForm = ({ onClose, onSaved, venteEdit, onNavigate, modeCredit = false }) => {
  const [clients, setClients] = useState([]);
  const [produits, setProduits] = useState([]);
  const [clientNomSelected, setClientNomSelected] = useState("");
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ nom: '', telephone: '', email: '', canal: '', ville: '', notes: '' });
  const [newClientError, setNewClientError] = useState('');
  const [creatingClient, setCreatingClient] = useState(false);

  const [form, setForm] = useState({ produit: '', prix_achat: '', prix_vente: '', quantite: '1', methode: modeCredit ? 'Credit' : 'Cash', notes: '', date_echeance: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setShowNewClient(false);
    getClients().then(cs => {
      setClients(cs);
      if (venteEdit) {
        const cl = cs.find(c => c._id === venteEdit.client_id);
        if (cl) setClientNomSelected(cl.nom);
      }
    });
    getProduits().then(setProduits);
    if (venteEdit) {
      setForm({
        produit: venteEdit.produit || '',
        prix_achat: String(venteEdit.prix_achat ?? ''),
        prix_vente: String(venteEdit.prix_vente ?? ''),
        quantite: String(venteEdit.quantite ?? '1'),
        methode: venteEdit.methode_paiement || 'Cash',
        notes: venteEdit.notes || '',
      });
    }
  }, []);

  const onProduitChange = (nom) => {
    const p = produits.find(x => x.nom === nom);
    setForm(f => ({
      ...f, produit: nom,
      prix_achat: p?.prix_achat ? String(p.prix_achat) : f.prix_achat,
      prix_vente: p?.prix_vente ? String(p.prix_vente) : f.prix_vente,
    }));
  };

  const onClientChange = (nom) => {
    if (nom === '+ Nouveau client') {
      setShowNewClient(true);
      setNewClientForm({ nom: '', telephone: '', email: '', canal: CANAUX[0], ville: '', notes: '' });
      setNewClientError('');
      return;
    }
    setClientNomSelected(nom);
    setShowNewClient(false);
  };

  const createClientInline = async () => {
    setNewClientError('');
    if (!newClientForm.nom.trim()) { setNewClientError('Le nom est obligatoire.'); return; }
    setCreatingClient(true);
    try {
      const dupNom = clients.find(c => c.nom.toLowerCase() === newClientForm.nom.toLowerCase().trim());
      if (dupNom) { setNewClientError('Un client avec ce nom existe deja.'); setCreatingClient(false); return; }
      await saveClient({ ...newClientForm, nom: newClientForm.nom.trim(), telephone: newClientForm.telephone.trim() });
      const updated = await getClients();
      setClients(updated);
      setClientNomSelected(newClientForm.nom.trim());
      setShowNewClient(false);
    } catch(e) { setNewClientError(e.message); }
    finally { setCreatingClient(false); }
  };

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [factureData, setFactureData] = useState(null);
  const [facturePdfBlob, setFacturePdfBlob] = useState(null);
  const [factureEntete, setFactureEntete] = useState({ nom: '', adresse: '', telephone: '', email: '', username: '', genereeLe: '' });

  const handleDelete = async () => {
    if (!venteEdit) return;
    setLoading(true);
    try {
      await deleteVente(venteEdit._id);
      onSaved();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const getNextNumeroFacture = async () => {
    const annee = new Date().getFullYear();
    const cle = `facture_compteur_${annee}`;
    const actuel = parseInt(await getSetting(cle)) || 0;
    const suivant = actuel + 1;
    await setSetting(cle, String(suivant));
    return `FAC-${annee}-${String(suivant).padStart(4, '0')}`;
  };

  const buildFactureEntete = async () => {
    const nomFact = await getSetting('facture_entreprise_nom');
    const adresseFact = await getSetting('facture_entreprise_adresse');
    const telFact = await getSetting('facture_entreprise_telephone');
    const emailFact = await getSetting('facture_entreprise_email');
    const logoFact = await getSetting('facture_entreprise_logo');
    const username = await getSetting('username') || '';
    const entreprise = await getSetting('entreprise') || '';
    const ville = await getSetting('ville') || '';
    const pays = await getSetting('pays') || '';
    const telephone = await getSetting('telephone') || '';
    const email = await getSetting('email') || '';
    return {
      nom: nomFact || entreprise || 'BeautyCRM',
      adresse: adresseFact || [ville, pays].filter(Boolean).join(', '),
      telephone: telFact || telephone,
      email: emailFact || email,
      logo: logoFact || '',
      username,
      genereeLe: new Date().toLocaleString('fr-FR'),
    };
  };

  const buildFacturePdf = async (data) => {
    const ent = await buildFactureEntete();
    const symbol = window.__DEVISE_SYMBOL__ || 'FC';
    const doc = new jsPDF({ unit: 'mm', format: [100, 148] });
    const left = 8;
    const right = 92;
    let y = 12;

    let textLeft = left;
    if (ent.logo) {
      try { doc.addImage(ent.logo, 'PNG', left, y - 6, 14, 14); textLeft = left + 17; } catch(_) {}
    }
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(ent.nom, textLeft, y);
    doc.setFont(undefined, 'normal');
    y += 5;
    doc.setFontSize(7.5);
    if (ent.adresse) { doc.text(ent.adresse, textLeft, y); y += 4; }
    if (ent.telephone) { doc.text(ent.telephone, textLeft, y); y += 4; }
    if (ent.email) { doc.text(ent.email, textLeft, y); y += 4; }

    y += 3;
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('FACTURE', right, y, { align: 'right' });
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    doc.text(data.numero, right, y + 4, { align: 'right' });
    doc.text(data.date, right, y + 8, { align: 'right' });

    y += 14;
    doc.setDrawColor(200);
    doc.line(left, y, right, y);
    y += 6;

    doc.setFontSize(7.5);
    doc.text('Client', left, y); y += 4;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text(data.clientNom, left, y);
    doc.setFont(undefined, 'normal');
    y += 5;
    if (data.clientTel) { doc.setFontSize(8); doc.text(data.clientTel, left, y); y += 5; }

    y += 2;
    doc.line(left, y, right, y);
    y += 6;

    doc.setFontSize(7.5);
    doc.text('Produit', left, y);
    doc.text('Qte', 52, y, { align: 'center' });
    doc.text('Prix', 70, y, { align: 'right' });
    doc.text('Total', right, y, { align: 'right' });
    y += 5;

    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text(data.produit, left, y);
    doc.setFont(undefined, 'normal');
    doc.text(String(data.quantite), 52, y, { align: 'center' });
    doc.text(`${data.prix_vente.toLocaleString('fr-FR')} ${symbol}`, 70, y, { align: 'right' });
    doc.setFont(undefined, 'bold');
    doc.text(`${data.total.toLocaleString('fr-FR')} ${symbol}`, right, y, { align: 'right' });
    doc.setFont(undefined, 'normal');

    y += 6;
    doc.line(left, y, right, y);
    y += 8;

    doc.setFontSize(8);
    doc.text(`Paiement : ${data.methode}`, left, y);
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text(`${data.total.toLocaleString('fr-FR')} ${symbol}`, right, y, { align: 'right' });
    doc.setFont(undefined, 'normal');

    y += 10;
    doc.setLineDashPattern([1, 1], 0);
    doc.line(left, y, right, y);
    doc.setLineDashPattern([], 0);
    y += 6;
    doc.setFontSize(6.5);
    doc.text(`Emise par ${ent.username} le ${ent.genereeLe}`, (left+right)/2, y, { align: 'center' });
    y += 4;
    doc.text('Designed by IZIsoft', (left+right)/2, y, { align: 'center' });

    return doc;
  };

  const downloadFacture = async () => {
    if (!factureData) return;
    const doc = await buildFacturePdf(factureData);
    doc.save(`${factureData.numero}-${factureData.clientNom}.pdf`);
  };

  const sendFacture = async () => {
    if (!factureData) return;
    const doc = await buildFacturePdf(factureData);
    const blob = doc.output('blob');
    const fileName = `${factureData.numero}-${factureData.clientNom}.pdf`;
    const file = new File([blob], fileName, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Facture', text: `Facture pour ${factureData.clientNom}` });
        return;
      } catch(_) {}
    }
    doc.save(fileName);
  };

  const quitterSansFacture = () => {
    setFactureData(null);
    onSaved();
  };



  const save = async () => {
    setError('');
    const clientFound = clients.find(c => c.nom === clientNomSelected);
    if (!clientFound) { setError("Choisissez un client."); return; }
    const clientId = clientFound._id;
    if (!form.produit.trim()) { setError('Choisissez un produit.'); return; }
    const pv = parseFloat(form.prix_vente);
    if (!pv || pv <= 0) { setError('Prix de vente invalide.'); return; }
    const qteDemandee = parseInt(form.quantite) || 1;
    const produitSel = produits.find(p => p.nom === form.produit);
    const ancienneQteVente = venteEdit ? (venteEdit.quantite || 0) : 0;
    if (produitSel && produitSel.stock != null) {
      const stockDisponiblePourCetteVente = produitSel.stock + ancienneQteVente;
      if (qteDemandee > stockDisponiblePourCetteVente) {
        setError(`Stock insuffisant. Disponible : ${stockDisponiblePourCetteVente}.`);
        return;
      }
    }
    setLoading(true);
    try {
      const qte = parseInt(form.quantite) || 1;
      await saveVente({
        ...(venteEdit ? { _id: venteEdit._id } : {}),
        client_id: clientId,
        produit: form.produit,
        quantite: qte,
        prix_achat: parseFloat(form.prix_achat) || 0,
        prix_vente: pv,
        date_vente: venteEdit ? venteEdit.date_vente : today(),
        methode_paiement: form.methode,
        notes: form.notes,
        statut_paiement: modeCredit ? 'credit' : 'paye',
        date_echeance: modeCredit && form.date_echeance ? form.date_echeance : null,
      });
      if (venteEdit) {
        const ancienneQte = venteEdit.quantite || 0;
        const diff = ancienneQte - qte;
        if (diff !== 0) await adjustStock(form.produit, diff);
      } else {
        await adjustStock(form.produit, -qte);
      }
      const ent = await buildFactureEntete();
      setFactureEntete(ent);
      const numero = await getNextNumeroFacture();
      setFactureData({
        numero,
        clientNom: clientFound.nom,
        clientTel: clientFound.telephone || '',
        produit: form.produit,
        quantite: qte,
        prix_vente: pv,
        total: pv * qte,
        methode: form.methode,
        date: today(),
      });
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  if (factureData) {
    return (
      <Modal visible onClose={quitterSansFacture} title="Facture generee">
        <div style={{ padding: 16 }}>
          <div style={{ backgroundColor: C.success+'15', borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: C.success, marginBottom: 4 }}>Vente enregistree</div>
            <div style={{ fontSize: 13, color: C.text_secondary }}>{factureData.clientNom} - {factureData.produit} x{factureData.quantite}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text_primary, marginTop: 6 }}>{factureData.total.toLocaleString('fr-FR')} {window.__DEVISE_SYMBOL__ || 'FC'}</div>
          </div>
          <div style={{ border: `1px solid ${C.card_border}`, borderRadius: 12, padding: 18, marginBottom: 16, backgroundColor: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                {factureEntete.logo && <img src={factureEntete.logo} alt="logo" style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 6 }} />}
                <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: C.text_primary }}>{factureEntete.nom}</div>
                {factureEntete.adresse && <div style={{ fontSize: 11, color: C.text_secondary, marginTop: 2 }}>{factureEntete.adresse}</div>}
                {factureEntete.telephone && <div style={{ fontSize: 11, color: C.text_secondary }}>Tel : {factureEntete.telephone}</div>}
                {factureEntete.email && <div style={{ fontSize: 11, color: C.text_secondary }}>{factureEntete.email}</div>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: C.accent }}>FACTURE</div>
                <div style={{ fontSize: 11, color: C.text_secondary, marginTop: 2 }}>{factureData.numero}</div>
                <div style={{ fontSize: 11, color: C.text_secondary }}>{fmtDate(factureData.date)}</div>
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${C.card_border}`, borderBottom: `1px solid ${C.card_border}`, padding: '10px 0', marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: C.text_secondary }}>Client</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.text_primary }}>{factureData.clientNom}</div>
              {factureData.clientTel && <div style={{ fontSize: 12, color: C.text_secondary }}>{factureData.clientTel}</div>}
            </div>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', marginBottom: 10 }}>
              <thead>
                <tr style={{ color: C.text_secondary, fontSize: 11, textAlign: 'left' }}>
                  <th style={{ paddingBottom: 6 }}>Produit</th>
                  <th style={{ paddingBottom: 6, textAlign: 'center' }}>Qte</th>
                  <th style={{ paddingBottom: 6, textAlign: 'right' }}>Prix unit.</th>
                  <th style={{ paddingBottom: 6, textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderTop: `1px solid ${C.card_border}` }}>
                  <td style={{ padding: '8px 0', fontWeight: 600, color: C.text_primary }}>{factureData.produit}</td>
                  <td style={{ padding: '8px 0', textAlign: 'center' }}>{factureData.quantite}</td>
                  <td style={{ padding: '8px 0', textAlign: 'right' }}>{fmtMoney(factureData.prix_vente)}</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700 }}>{fmtMoney(factureData.total)}</td>
                </tr>
              </tbody>
            </table>
            <div style={{ borderTop: `1px solid ${C.card_border}`, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: C.text_secondary }}>Paiement : {factureData.methode}</div>
              <div style={{ fontWeight: 800, fontSize: 16, color: C.success }}>{fmtMoney(factureData.total)}</div>
            </div>
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: `1px dashed ${C.card_border}`, fontSize: 10, color: C.text_secondary, textAlign: 'center' }}>
              Emise par {factureEntete.username} le {factureEntete.genereeLe}
              <br />Designed by IZIsoft
            </div>
          </div>
          <div style={{ fontSize: 13, color: C.text_secondary, marginBottom: 14 }}>Que voulez-vous faire de la facture ?</div>
        </div>
        <div style={{ padding: 16, borderTop: `1px solid ${C.card_border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <PrimaryBtn label="Enregistrer la facture (PDF)" onClick={downloadFacture} />
          <PrimaryBtn label="Envoyer la facture" onClick={sendFacture} />
          <GhostBtn label="Quitter sans enregistrer" onClick={quitterSansFacture} />
        </div>
      </Modal>
    );
  }

  return (
    <Modal visible onClose={onClose} title={venteEdit ? "Modifier la vente" : modeCredit ? "💳 Vente à crédit" : "Nouvelle vente"}>
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
        <PickerSelect label="Client *" value={clientNomSelected} onChange={onClientChange} options={["", "+ Nouveau client", ...clients.map(c => c.nom)]} />
        {clientNomSelected && (
          <div style={{ fontSize: 12, color: C.accent, marginBottom: 10, fontWeight: 600 }}>
            {clientNomSelected}
          </div>
        )}
        {showNewClient && (
          <div style={{ backgroundColor: C.accent+'10', borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 8 }}>Nouveau client</div>
            {newClientError && <div style={{ color: C.danger, fontSize: 12, marginBottom: 8 }}>{newClientError}</div>}
            <FieldInput label="Nom *" value={newClientForm.nom} onChange={v => setNewClientForm(f=>({...f,nom:v}))} placeholder="Nom du client" />
            <FieldInput label="Telephone (WhatsApp)" value={newClientForm.telephone} onChange={v => setNewClientForm(f=>({...f,telephone:v}))} type="tel" />
            <FieldInput label="Email" value={newClientForm.email} onChange={v => setNewClientForm(f=>({...f,email:v}))} type="email" />
            <PickerSelect label="Canal d'acquisition" value={newClientForm.canal || CANAUX[0]} onChange={v => setNewClientForm(f=>({...f,canal:v}))} options={CANAUX} />
            <FieldInput label="Ville / Quartier" value={newClientForm.ville} onChange={v => setNewClientForm(f=>({...f,ville:v}))} />
            <FieldInput label="Notes" value={newClientForm.notes} onChange={v => setNewClientForm(f=>({...f,notes:v}))} multiline />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNewClient(false)} style={{ background:'transparent', border:'none', color:C.text_secondary, fontWeight:600, fontSize:13, cursor:'pointer', padding:'8px 12px' }}>Annuler</button>
              <button onClick={createClientInline} disabled={creatingClient} style={{ background:C.accent, color:'#fff', border:'none', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:700, cursor:'pointer' }}>{creatingClient ? '...' : 'Creer'}</button>
            </div>
          </div>
        )}
        <PickerSelect label="Produit *" value={form.produit} onChange={onProduitChange} options={produits.length === 0 ? ["Aucun produit enregistre"] : ['', ...produits.map(p => p.nom)]} />
        {produits.length === 0 && (
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10, marginTop:-8 }}><button onClick={onClose} style={{ background:'#3D5AFE', color:'#fff', border:'none', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:700, cursor:'pointer' }} onClick={() => { onClose(); onNavigate && onNavigate('produits'); }}>+ Ajouter un produit</button></div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><FieldInput label="Prix achat" value={form.prix_achat} onChange={v => setForm(f=>({...f,prix_achat:v}))} type="number" /></div>
          <div style={{ flex: 1 }}><FieldInput label="Prix vente *" value={form.prix_vente} onChange={v => setForm(f=>({...f,prix_vente:v}))} type="number" /></div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><FieldInput label="Quantite" value={form.quantite} onChange={v => setForm(f=>({...f,quantite:v}))} type="number" /></div>
          <div style={{ flex: 1 }}><PickerSelect label="Paiement" value={form.methode} onChange={v => setForm(f=>({...f,methode:v}))} options={['Cash','Mobile Money','Virement','Credit','Autre']} /></div>
        </div>
        {(modeCredit || form.methode === 'Credit') && (
          <div style={{ backgroundColor: C.danger+'10', borderRadius: 10, padding: 12, marginBottom: 14, border: '1.5px solid '+C.danger+'30' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.danger, marginBottom: 8 }}>💳 Vente à crédit</div>
            <FieldInput label="Date d'échéance (optionnel)" value={form.date_echeance} onChange={v => setForm(f=>({...f,date_echeance:v}))} type="date" />
          </div>
        )}
        {form.prix_vente && (
          <div style={{ backgroundColor: C.success+'15', borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.text_secondary }}>Total</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: C.success }}>
              {fmtMoney((parseFloat(form.prix_vente)||0) * (parseInt(form.quantite)||1))}
            </div>
          </div>
        )}
      </div>
      {confirmDelete ? (
        <div style={{ padding: 16, borderTop: '1px solid '+C.card_border }}>
          <div style={{ fontSize: 13, color: C.danger, marginBottom: 10, fontWeight: 600 }}>Supprimer cette vente ?</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid '+C.card_border, background: '#fff', fontWeight: 700, fontSize: 13 }}>Annuler</button>
            <button onClick={handleDelete} disabled={loading} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: C.danger, color: '#fff', fontWeight: 700, fontSize: 13 }}>{loading ? '...' : 'Confirmer'}</button>
          </div>
        </div>
      ) : (
        <>
          <FormFooter onSave={save} onClose={onClose} loading={loading} saveColor={C.success} saveLabel="Enregistrer" />
          {venteEdit && (
            <div style={{ padding: '0 16px 16px' }}>
              <button onClick={() => setConfirmDelete(true)} style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid '+C.danger, background: 'transparent', color: C.danger, fontWeight: 700, fontSize: 13 }}>Supprimer cette vente</button>
            </div>
          )}
        </>
      )}
    </Modal>
  );
};

export const VentesPage = ({ onNavigate }) => {
  const [ventes, setVentes] = useState([]);
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showCredit, setShowCredit] = useState(false);
  const [editingVente, setEditingVente] = useState(null);
  const devise = useDevise();

  const load = useCallback(async () => {
    setLoading(true);
    const [v, c] = await Promise.all([getVentes(), getClients()]);
    setVentes(v);
    setClients(c);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const getClientNom = (id) => clients.find(c => c._id === id)?.nom || 'Inconnu';

  const filtered = ventes.filter(v =>
    getClientNom(v.client_id).toLowerCase().includes(search.toLowerCase()) ||
    (v.produit || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalCA = filtered.reduce((s,v) => s + v.prix_vente * v.quantite, 0);
  const totalMarge = filtered.reduce((s,v) => s + (v.prix_vente - v.prix_achat) * v.quantite, 0);

  const exportCSV = () => {
    const header = 'Date,Client,Produit,Quantite,Prix achat,Prix vente,Marge,Paiement\n';
    const rows = filtered.map(v => [
      v.date_vente,
      getClientNom(v.client_id),
      v.produit,
      v.quantite,
      v.prix_achat,
      v.prix_vente,
      (v.prix_vente - v.prix_achat) * v.quantite,
      v.methode_paiement,
    ].map(x => `"${String(x??'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ventes_${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: '14px', paddingBottom: 80, width: '100%', boxSizing: 'border-box' }}>
      <div style={{ backgroundColor: C.accent, borderRadius: 14, padding: 16, marginBottom: 14, color: '#fff' }}>
        <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>CA total · Marge</div>
        <div style={{ fontWeight: 800, fontSize: 20 }}>{fmtMoney(totalCA)} · {fmtMoney(totalMarge)}</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <PrimaryBtn label="Nouvelle vente" onClick={() => { setEditingVente(null); setShowForm(true); }} style={{ flex: 1 }} />
        <button onClick={() => { setEditingVente(null); setShowCredit(true); }} style={{
          backgroundColor: C.danger+'15', border: `1.5px solid ${C.danger}60`,
          borderRadius: 12, padding: '13px 14px', color: C.danger,
          fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
        }}>💳 Crédit</button>
        <button onClick={exportCSV} style={{
          backgroundColor: C.success+'20', border: `1px solid ${C.success}40`,
          borderRadius: 12, padding: '13px 16px', color: C.success,
          fontWeight: 700, fontSize: 12, cursor: 'pointer',
        }}>⬇ CSV</button>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Chercher client ou produit..." />
      <SectionTitle title={`${filtered.length} vente(s)`} />

      {loading
        ? <div style={{ textAlign: 'center', padding: 40, color: C.text_secondary }}>Chargement...</div>
        : filtered.length === 0
          ? <div style={{ textAlign: 'center', padding: 40, color: C.text_secondary, fontSize: 13 }}>Aucune vente enregistree.</div>
          : filtered.map(v => (
            <div key={v._id} style={{ marginBottom: 10 }} onClick={() => setEditingVente(v)}>
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 4, cursor: 'pointer' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.text_primary }}>{getClientNom(v.client_id)}</div>
                    <div style={{ fontSize: 11, color: C.text_secondary, marginTop: 2 }}>{v.produit} ×{v.quantite}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                      <Badge label={v.methode_paiement} color={C.accent} />
                      <span style={{ fontSize: 11, color: C.text_secondary }}>{fmtDate(v.date_vente)}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.success }}>{fmtMoney(v.prix_vente * v.quantite)}</div>
                    <div style={{ fontSize: 11, color: C.success }}>+{fmtMoney((v.prix_vente - v.prix_achat) * v.quantite)}</div>
                  </div>
                </div>
              </Card>
            </div>
          ))
      }

      {showForm && (
        <VenteRapideForm key={String(showForm) + String(editingVente?._id)} onClose={() => { setShowForm(false); setEditingVente(null); }} onSaved={() => { setShowForm(false); setEditingVente(null); load(); }} venteEdit={editingVente} onNavigate={onNavigate} />
      )}

      {showCredit && (
        <VenteRapideForm
          key="credit"
          onClose={() => setShowCredit(false)}
          onSaved={() => { setShowCredit(false); load(); }}
          venteEdit={null}
          onNavigate={onNavigate}
          modeCredit={true}
        />
      )}
      {editingVente && !showForm && (
        <VenteRapideForm
          key={editingVente._id}
          venteEdit={editingVente}
          onClose={() => setEditingVente(null)}
          onSaved={() => { setEditingVente(null); load(); }}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
};
