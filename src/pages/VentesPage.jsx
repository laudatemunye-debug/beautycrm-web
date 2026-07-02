import { useState, useEffect, useCallback } from 'react';
import { C, CANAUX } from '../theme';
import { getVentes, getClients, saveClient, saveVente, getProduits, adjustStock, today, deleteVente, getSetting, setSetting, saveFacture, getFactures, deleteFacture } from '../db/index';
import jsPDF from 'jspdf';
import { Card, SearchBar, SectionTitle, PrimaryBtn, GhostBtn, FieldInput, PickerSelect, Modal, FormFooter, Badge, fmtMoney, fmtDate } from "../components/UI";
import { useDevise } from "../hooks/useDevise";

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
  const hauteur = Math.max(148, 95 + data.items.length * 7);
  const doc = new jsPDF({ unit: 'mm', format: [100, hauteur] });
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
  for (const item of data.items) {
    doc.setFont(undefined, 'bold');
    doc.text(item.produit, left, y);
    doc.setFont(undefined, 'normal');
    doc.text(String(item.quantite), 52, y, { align: 'center' });
    doc.text(`${String(Math.round(item.prix_vente))} ${symbol}`, 70, y, { align: 'right' });
    doc.text(`${String(Math.round(item.prix_vente*item.quantite))} ${symbol}`, right, y, { align: 'right' });
    y += 6;
  }

  doc.line(left, y, right, y);
  y += 8;

  doc.setFontSize(8);
  doc.text(`Paiement : ${data.methode}`, left, y);
  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text(`${String(Math.round(data.total))} ${symbol}`, right, y, { align: 'right' });
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

const FactureScreen = ({ factureData, factureEntete, onClose }) => {
  const downloadFacture = async () => {
    const doc = await buildFacturePdf(factureData);
    doc.save(`${factureData.numero}-${factureData.clientNom}.pdf`);
  };

  const sendFacture = async () => {
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

  return (
    <Modal visible onClose={onClose} title="Facture generee">
      <div style={{ padding: 16 }}>
        <div style={{ backgroundColor: C.success+'15', borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: C.success, marginBottom: 4 }}>Vente enregistree</div>
          <div style={{ fontSize: 13, color: C.text_secondary }}>{factureData.clientNom} - {factureData.items.length} produit(s)</div>
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
              {factureData.items.map((item, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${C.card_border}` }}>
                  <td style={{ padding: '8px 0', fontWeight: 600, color: C.text_primary }}>{item.produit}</td>
                  <td style={{ padding: '8px 0', textAlign: 'center' }}>{item.quantite}</td>
                  <td style={{ padding: '8px 0', textAlign: 'right' }}>{fmtMoney(item.prix_vente)}</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700 }}>{fmtMoney(item.prix_vente*item.quantite)}</td>
                </tr>
              ))}
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={downloadFacture} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', backgroundColor: C.accent, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Enregistrer (PDF)</button>
          <button onClick={sendFacture} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', backgroundColor: '#25D366', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Envoyer</button>
        </div>
        <button onClick={async () => {
          const doc = await buildFacturePdf(factureData);
          const blob = doc.output('blob');
          const url = URL.createObjectURL(blob);
          const win = window.open(url, '_blank');
          if (win) { win.onload = () => { setTimeout(() => { win.focus(); win.print(); }, 500); }; }
        }} style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', backgroundColor: '#374151', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Imprimer</button>
        <GhostBtn label="Quitter sans enregistrer" onClick={onClose} />
      </div>
    </Modal>
  );
};

const ClientPicker = ({ clients, clientNomSelected, onClientChange, showNewClient, newClientForm, setNewClientForm, newClientError, creatingClient, createClientInline, setShowNewClient }) => (
  <>
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
  </>
);

// ----- MODE EDITION (une seule vente existante, comportement inchange) -----
const VenteEditForm = ({ venteEdit, onClose, onSaved, onNavigate }) => {
  const [clients, setClients] = useState([]);
  const [produits, setProduits] = useState([]);
  const [clientNomSelected, setClientNomSelected] = useState("");
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ nom: '', telephone: '', email: '', canal: '', ville: '', notes: '' });
  const [newClientError, setNewClientError] = useState('');
  const [creatingClient, setCreatingClient] = useState(false);
  const [form, setForm] = useState({
    produit: venteEdit.produit || '',
    prix_achat: String(venteEdit.prix_achat ?? ''),
    prix_vente: String(venteEdit.prix_vente ?? ''),
    quantite: String(venteEdit.quantite ?? '1'),
    methode: venteEdit.methode_paiement || 'Cash',
    notes: venteEdit.notes || '',
    date_echeance: venteEdit.date_echeance || '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    getClients().then(cs => {
      setClients(cs);
      const cl = cs.find(c => c._id === venteEdit.client_id);
      if (cl) setClientNomSelected(cl.nom);
    });
    getProduits().then(setProduits);
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

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteVente(venteEdit._id);
      onSaved();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const save = async () => {
    setError('');
    const clientFound = clients.find(c => c.nom === clientNomSelected);
    if (!clientFound) { setError("Choisissez un client."); return; }
    if (!form.produit.trim()) { setError('Choisissez un produit.'); return; }
    const pv = parseFloat(form.prix_vente);
    if (!pv || pv <= 0) { setError('Prix de vente invalide.'); return; }
    const qte = parseInt(form.quantite) || 1;
    const produitSel = produits.find(p => p.nom === form.produit);
    const ancienneQteVente = venteEdit.quantite || 0;
    if (produitSel && produitSel.stock != null) {
      const stockDisponiblePourCetteVente = produitSel.stock + ancienneQteVente;
      if (qte > stockDisponiblePourCetteVente) {
        setError(`Stock insuffisant. Disponible : ${stockDisponiblePourCetteVente}.`);
        return;
      }
    }
    setLoading(true);
    try {
      await saveVente({
        _id: venteEdit._id,
        client_id: clientFound._id,
        produit: form.produit,
        quantite: qte,
        prix_achat: parseFloat(form.prix_achat) || 0,
        prix_vente: pv,
        date_vente: venteEdit.date_vente,
        methode_paiement: form.methode,
        notes: form.notes,
        statut_paiement: venteEdit.statut_paiement,
        date_echeance: form.date_echeance || null,
      });
      const diff = ancienneQteVente - qte;
      if (diff !== 0) await adjustStock(form.produit, diff);
      onSaved();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible onClose={onClose} title="Modifier la vente">
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
        <ClientPicker
          clients={clients} clientNomSelected={clientNomSelected} onClientChange={onClientChange}
          showNewClient={showNewClient} newClientForm={newClientForm} setNewClientForm={setNewClientForm}
          newClientError={newClientError} creatingClient={creatingClient} createClientInline={createClientInline}
          setShowNewClient={setShowNewClient}
        />
        <PickerSelect label="Produit *" value={form.produit} onChange={onProduitChange} options={produits.length === 0 ? ["Aucun produit enregistre"] : ['', ...produits.map(p => p.nom)]} />
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><FieldInput label="Prix achat" value={form.prix_achat} onChange={v => setForm(f=>({...f,prix_achat:v}))} type="number" /></div>
          <div style={{ flex: 1 }}><FieldInput label="Prix vente *" value={form.prix_vente} onChange={v => setForm(f=>({...f,prix_vente:v}))} type="number" /></div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><FieldInput label="Quantite" value={form.quantite} onChange={v => setForm(f=>({...f,quantite:v}))} type="number" /></div>
          <div style={{ flex: 1 }}><PickerSelect label="Paiement" value={form.methode} onChange={v => setForm(f=>({...f,methode:v}))} options={['Cash','Mobile Money','Virement','Credit','Autre']} /></div>
        </div>
        {form.methode === 'Credit' && (
          <FieldInput label="Date d'echeance (optionnel)" value={form.date_echeance} onChange={v => setForm(f=>({...f,date_echeance:v}))} type="date" />
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
          <div style={{ padding: '0 16px 16px' }}>
            <button onClick={() => setConfirmDelete(true)} style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid '+C.danger, background: 'transparent', color: C.danger, fontWeight: 700, fontSize: 13 }}>Supprimer cette vente</button>
          </div>
        </>
      )}
    </Modal>
  );
};

const VentureFactureEditForm = ({ ventesGroupe, onClose, onSaved, onNavigate }) => {
  const [clients, setClients] = useState([]);
  const [produits, setProduits] = useState([]);
  const [clientNomSelected, setClientNomSelected] = useState("");
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ nom: '', telephone: '', email: '', canal: '', ville: '', notes: '' });
  const [newClientError, setNewClientError] = useState('');
  const [creatingClient, setCreatingClient] = useState(false);

  const [items, setItems] = useState(() => ventesGroupe.map(v => ({
    _key: v._id,
    _id: v._id,
    produit: v.produit,
    prix_achat: v.prix_achat,
    prix_vente: v.prix_vente,
    quantite: v.quantite,
  })));
  const [itemForm, setItemForm] = useState({ produit: '', prix_achat: '', prix_vente: '', quantite: '1' });
  const [methode, setMethode] = useState(ventesGroupe[0].methode_paiement || 'Cash');
  const [dateEcheance, setDateEcheance] = useState(ventesGroupe[0].date_echeance || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    getClients().then(cs => {
      setClients(cs);
      const cl = cs.find(c => c._id === ventesGroupe[0].client_id);
      if (cl) setClientNomSelected(cl.nom);
    });
    getProduits().then(setProduits);
  }, []);

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

  const onItemProduitChange = (nom) => {
    const p = produits.find(x => x.nom === nom);
    setItemForm(f => ({
      ...f, produit: nom,
      prix_achat: p?.prix_achat ? String(p.prix_achat) : f.prix_achat,
      prix_vente: p?.prix_vente ? String(p.prix_vente) : f.prix_vente,
    }));
  };

  const stockDispoPourProduit = (nom) => {
    const p = produits.find(x => x.nom === nom);
    if (!p || p.stock == null) return Infinity;
    const originalQte = ventesGroupe.filter(v => v.produit === nom).reduce((s,v)=>s+v.quantite,0);
    const allocQte = items.filter(it => it.produit === nom).reduce((s,it)=>s+it.quantite,0);
    return p.stock + originalQte - allocQte;
  };

  const ajouterItem = () => {
    setError('');
    if (!itemForm.produit.trim()) { setError('Choisissez un produit.'); return; }
    const pv = parseFloat(itemForm.prix_vente);
    if (!pv || pv <= 0) { setError('Prix de vente invalide.'); return; }
    const qte = parseInt(itemForm.quantite) || 1;
    const dispo = stockDispoPourProduit(itemForm.produit);
    if (qte > dispo) { setError(`Stock insuffisant pour ${itemForm.produit}. Disponible : ${dispo}.`); return; }
    setItems(list => {
      const existant = list.find(it => it.produit === itemForm.produit);
      if (existant) {
        return list.map(it => it.produit === itemForm.produit
          ? { ...it, quantite: it.quantite + qte, prix_vente: pv, prix_achat: parseFloat(itemForm.prix_achat) || it.prix_achat }
          : it);
      }
      return [...list, {
        _key: 'new_' + Date.now() + Math.random(),
        _id: null,
        produit: itemForm.produit,
        prix_achat: parseFloat(itemForm.prix_achat) || 0,
        prix_vente: pv,
        quantite: qte,
      }];
    });
    setItemForm({ produit: '', prix_achat: '', prix_vente: '', quantite: '1' });
  };

  const retirerItem = (key) => setItems(list => list.filter(it => it._key !== key));

  const modifierItem = (key, champ, valeur) => {
    setItems(list => list.map(it => {
      if (it._key !== key) return it;
      if (champ === 'quantite') return { ...it, quantite: Math.max(1, parseInt(valeur) || 1) };
      if (champ === 'prix_vente') return { ...it, prix_vente: parseFloat(valeur) || 0 };
      if (champ === 'prix_achat') return { ...it, prix_achat: parseFloat(valeur) || 0 };
      return it;
    }));
  };

  const totalFacture = items.reduce((s, it) => s + it.prix_vente * it.quantite, 0);

  const validerStock = () => {
    const produitsAffectes = new Set([...ventesGroupe.map(v=>v.produit), ...items.map(it=>it.produit)]);
    for (const nom of produitsAffectes) {
      const p = produits.find(x => x.nom === nom);
      if (!p || p.stock == null) continue;
      const originalQte = ventesGroupe.filter(v => v.produit === nom).reduce((s,v)=>s+v.quantite,0);
      const nouvelleQte = items.filter(it => it.produit === nom).reduce((s,it)=>s+it.quantite,0);
      if (p.stock + originalQte - nouvelleQte < 0) {
        return `Stock insuffisant pour ${nom}. Disponible : ${p.stock + originalQte}.`;
      }
    }
    return null;
  };

  const handleDeleteFacture = async () => {
    setLoading(true);
    try {
      for (const v of ventesGroupe) {
        await deleteVente(v._id);
        await adjustStock(v.produit, v.quantite);
      }
      onSaved();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const save = async () => {
    setError('');
    const clientFound = clients.find(c => c.nom === clientNomSelected);
    if (!clientFound) { setError("Choisissez un client."); return; }
    if (items.length === 0) { setError('Ajoutez au moins un produit.'); return; }
    const stockErr = validerStock();
    if (stockErr) { setError(stockErr); return; }
    setLoading(true);
    try {
      const estCredit = methode === 'Credit';
      let numero = ventesGroupe[0].facture_numero;
      if (!numero && items.length > 1) {
        numero = await getNextNumeroFacture();
      }
      const dateV = ventesGroupe[0].date_vente;

      for (const it of items) {
        const original = it._id ? ventesGroupe.find(v => v._id === it._id) : null;
        const ancienneQte = original ? original.quantite : 0;
        const payload = {
          client_id: clientFound._id,
          produit: it.produit,
          quantite: it.quantite,
          prix_achat: it.prix_achat,
          prix_vente: it.prix_vente,
          date_vente: dateV,
          methode_paiement: methode,
          notes: '',
          statut_paiement: estCredit ? 'credit' : 'paye',
          date_echeance: estCredit && dateEcheance ? dateEcheance : null,
          facture_numero: numero || null,
        };
        if (it._id) payload._id = it._id;
        await saveVente(payload);
        const diff = ancienneQte - it.quantite;
        if (diff !== 0) await adjustStock(it.produit, diff);
      }

      const idsConserves = new Set(items.filter(it => it._id).map(it => it._id));
      for (const v of ventesGroupe) {
        if (!idsConserves.has(v._id)) {
          await deleteVente(v._id);
          await adjustStock(v.produit, v.quantite);
        }
      }

      if (numero) {
        const facturesExistantes = await getFactures();
        const factureExistante = facturesExistantes.find(f => f.numero === numero);
        const ent = await buildFactureEntete();
        const fd = {
          _id: factureExistante?._id,
          numero,
          clientNom: clientFound.nom,
          clientTel: clientFound.telephone || '',
          items: items.map(it => ({ produit: it.produit, prix_achat: it.prix_achat, prix_vente: it.prix_vente, quantite: it.quantite })),
          total: totalFacture,
          methode,
          date: dateV,
          entete: ent,
        };
        await saveFacture(fd);
      }

      onSaved();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible onClose={onClose} title="Modifier la facture">
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
        <ClientPicker
          clients={clients} clientNomSelected={clientNomSelected} onClientChange={onClientChange}
          showNewClient={showNewClient} newClientForm={newClientForm} setNewClientForm={setNewClientForm}
          newClientError={newClientError} creatingClient={creatingClient} createClientInline={createClientInline}
          setShowNewClient={setShowNewClient}
        />

        <div style={{ fontSize: 12, fontWeight: 700, color: C.text_secondary, marginBottom: 8, marginTop: 6 }}>Produits de la facture</div>
        {items.map(it => (
          <div key={it._key} style={{ border: '1px solid '+C.card_border, borderRadius: 10, padding: 10, marginBottom: 8 }}>
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.text_primary }}>{it.produit}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ width: 'calc(50% - 45px)' }}><FieldInput label="Prix vente" value={String(it.prix_vente)} onChange={v => modifierItem(it._key, 'prix_vente', v)} type="number" /></div>
              <div style={{ width: 'calc(50% - 45px)' }}><FieldInput label="Qte" value={String(it.quantite)} onChange={v => modifierItem(it._key, 'quantite', v)} type="number" /></div>
              <button onClick={() => retirerItem(it._key)} style={{ width: 74, height: 44, marginTop: 21, padding: 0, borderRadius: 8, border: '1px solid '+C.danger, background: 'transparent', color: C.danger, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Retirer</button>
            </div>
          </div>
        ))}

        <div style={{ backgroundColor: C.accent+'0d', border: `1px dashed ${C.accent}60`, borderRadius: 10, padding: 10, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 8 }}>Ajouter un produit</div>
          <PickerSelect label="Produit" value={itemForm.produit} onChange={onItemProduitChange} options={produits.length === 0 ? ["Aucun produit enregistre"] : ['', ...produits.map(p => p.nom)]} />
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><FieldInput label="Prix achat" value={itemForm.prix_achat} onChange={v => setItemForm(f=>({...f,prix_achat:v}))} type="number" /></div>
            <div style={{ flex: 1 }}><FieldInput label="Prix vente" value={itemForm.prix_vente} onChange={v => setItemForm(f=>({...f,prix_vente:v}))} type="number" /></div>
            <div style={{ width: 70 }}><FieldInput label="Qte" value={itemForm.quantite} onChange={v => setItemForm(f=>({...f,quantite:v}))} type="number" /></div>
          </div>
          <button onClick={ajouterItem} style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', background: C.accent, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Ajouter a la facture</button>
        </div>

        <PickerSelect label="Paiement" value={methode} onChange={setMethode} options={['Cash','Mobile Money','Virement','Credit','Autre']} />
        {methode === 'Credit' && (
          <FieldInput label="Date d'echeance (optionnel)" value={dateEcheance} onChange={setDateEcheance} type="date" />
        )}

        <div style={{ backgroundColor: C.success+'15', borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: C.text_secondary }}>Total facture</div>
          <div style={{ fontWeight: 800, fontSize: 18, color: C.success }}>{fmtMoney(totalFacture)}</div>
        </div>
      </div>
      {confirmDelete ? (
        <div style={{ padding: 16, borderTop: '1px solid '+C.card_border }}>
          <div style={{ fontSize: 13, color: C.danger, marginBottom: 10, fontWeight: 600 }}>Supprimer toute la facture ?</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid '+C.card_border, background: '#fff', fontWeight: 700, fontSize: 13 }}>Annuler</button>
            <button onClick={handleDeleteFacture} disabled={loading} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: C.danger, color: '#fff', fontWeight: 700, fontSize: 13 }}>{loading ? '...' : 'Confirmer'}</button>
          </div>
        </div>
      ) : (
        <>
          <FormFooter onSave={save} onClose={onClose} loading={loading} saveColor={C.success} saveLabel="Enregistrer" />
          <div style={{ padding: '0 16px 16px' }}>
            <button onClick={() => setConfirmDelete(true)} style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid '+C.danger, background: 'transparent', color: C.danger, fontWeight: 700, fontSize: 13 }}>Supprimer toute la facture</button>
          </div>
        </>
      )}
    </Modal>
  );
};

// ----- MODE NOUVELLE VENTE (panier multi-produits) -----
const VentePanierForm = ({ onClose, onSaved, onNavigate, modeCredit = false }) => {
  const [clients, setClients] = useState([]);
  const [produits, setProduits] = useState([]);
  const [clientNomSelected, setClientNomSelected] = useState("");
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ nom: '', telephone: '', email: '', canal: '', ville: '', notes: '' });
  const [newClientError, setNewClientError] = useState('');
  const [creatingClient, setCreatingClient] = useState(false);

  const [panier, setPanier] = useState([]);
  const [itemForm, setItemForm] = useState({ produit: '', prix_achat: '', prix_vente: '', quantite: '1' });
  const [methode, setMethode] = useState(modeCredit ? 'Credit' : 'Cash');
  const [dateEcheance, setDateEcheance] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [factureData, setFactureData] = useState(null);
  const [factureEntete, setFactureEntete] = useState({});
  const [showApercu, setShowApercu] = useState(false);

  useEffect(() => {
    getClients().then(setClients);
    getProduits().then(setProduits);
  }, []);

  const onItemProduitChange = (nom) => {
    const p = produits.find(x => x.nom === nom);
    setItemForm(f => ({
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

  const ajouterAuPanier = () => {
    setError('');
    if (!itemForm.produit.trim()) { setError('Choisissez un produit.'); return; }
    const pv = parseFloat(itemForm.prix_vente);
    if (!pv || pv <= 0) { setError('Prix de vente invalide.'); return; }
    const qte = parseInt(itemForm.quantite) || 1;
    const produitSel = produits.find(p => p.nom === itemForm.produit);
    const dejaDansPanier = panier.filter(it => it.produit === itemForm.produit).reduce((s,it) => s + it.quantite, 0);
    if (produitSel && produitSel.stock != null) {
      const dispo = produitSel.stock - dejaDansPanier;
      if (qte > dispo) { setError(`Stock insuffisant pour ${itemForm.produit}. Disponible : ${dispo}.`); return; }
    }
    setPanier(p => {
      const existant = p.find(it => it.produit === itemForm.produit);
      if (existant) {
        return p.map(it => it.produit === itemForm.produit
          ? { ...it, quantite: it.quantite + qte, prix_vente: pv, prix_achat: parseFloat(itemForm.prix_achat) || it.prix_achat }
          : it);
      }
      return [...p, {
        _key: Date.now() + Math.random(),
        produit: itemForm.produit,
        prix_achat: parseFloat(itemForm.prix_achat) || 0,
        prix_vente: pv,
        quantite: qte,
      }];
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

  const save = async () => {
    setError('');
    const clientFound = clients.find(c => c.nom === clientNomSelected);
    if (!clientFound) { setError("Choisissez un client."); return; }
    if (panier.length === 0) { setError('Ajoutez au moins un produit au panier.'); return; }
    setLoading(true);
    try {
      const dateV = today();
      const estCredit = modeCredit || methode === 'Credit';
      const numero = await getNextNumeroFacture();
      for (const item of panier) {
        await saveVente({
          client_id: clientFound._id,
          produit: item.produit,
          quantite: item.quantite,
          prix_achat: item.prix_achat,
          prix_vente: item.prix_vente,
          date_vente: dateV,
          methode_paiement: methode,
          notes: '',
          statut_paiement: estCredit ? 'credit' : 'paye',
          date_echeance: estCredit && dateEcheance ? dateEcheance : null,
          facture_numero: numero,
        });
        await adjustStock(item.produit, -item.quantite);
      }
      const ent = await buildFactureEntete();
      setFactureEntete(ent);
      const fd = {
        numero,
        clientNom: clientFound.nom,
        clientTel: clientFound.telephone || '',
        items: panier,
        total: totalPanier,
        methode,
        date: dateV,
        entete: ent,
      };
      await saveFacture(fd);
      setFactureData(fd);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  if (factureData) {
    return <FactureScreen factureData={factureData} factureEntete={factureEntete} onClose={onSaved} />;
  }

  if (showApercu) {
    return (
      <Modal visible onClose={() => setShowApercu(false)} title="Apercu de la vente">
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
          <div style={{ backgroundColor: C.accent+'10', borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.text_secondary }}>Client</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.text_primary }}>{clientNomSelected}</div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: C.text_secondary, marginBottom: 8 }}>Produits ({panier.length})</div>
          {panier.map(item => (
            <div key={item._key} style={{ backgroundColor: C.accent+'08', borderRadius: 10, padding: '10px 10px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ flex: 1, fontWeight: 700, fontSize: 13, color: C.text_primary }}>{item.produit}</div>
                <button onClick={() => retirerDuPanier(item._key)} style={{ background:'transparent', border:'none', color:C.danger, fontSize:18, cursor:'pointer', padding:'0 4px' }}>×</button>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: C.text_secondary, marginBottom: 4 }}>Quantite</div>
                  <input type="number" value={item.quantite} onChange={e => modifierItemPanier(item._key, 'quantite', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#fff', border: `1px solid ${C.input_border}`, borderRadius: 8, padding: 8, fontSize: 13 }} />
                </div>
                <div style={{ flex: 1.3 }}>
                  <div style={{ fontSize: 10, color: C.text_secondary, marginBottom: 4 }}>Prix vente</div>
                  <input type="number" value={item.prix_vente} onChange={e => modifierItemPanier(item._key, 'prix_vente', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#fff', border: `1px solid ${C.input_border}`, borderRadius: 8, padding: 8, fontSize: 13 }} />
                </div>
                <div style={{ flex: 1.3, textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: C.text_secondary, marginBottom: 4 }}>Total</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: C.success, padding: '8px 0' }}>{fmtMoney(item.prix_vente*item.quantite)}</div>
                </div>
              </div>
            </div>
          ))}

          <PickerSelect label="Paiement" value={methode} onChange={setMethode} options={['Cash','Mobile Money','Virement','Credit','Autre']} />
          {(modeCredit || methode === 'Credit') && (
            <FieldInput label="Date d'echeance (optionnel)" value={dateEcheance} onChange={setDateEcheance} type="date" />
          )}

          <div style={{ backgroundColor: C.success+'15', borderRadius: 10, padding: 12, marginTop: 4 }}>
            <div style={{ fontSize: 11, color: C.text_secondary }}>Total a payer</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: C.success }}>{fmtMoney(totalPanier)}</div>
          </div>
        </div>
        <div style={{ position: 'sticky', bottom: 0, padding: 16, borderTop: `1px solid ${C.card_border}`, backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <PrimaryBtn label={loading ? '...' : 'Terminer'} onClick={save} loading={loading} saveColor={C.success} />
          <GhostBtn label="Modifier" onClick={() => setShowApercu(false)} />
        </div>
      </Modal>
    );
  }

  return (
    <Modal visible onClose={onClose} title={modeCredit ? "Vente a credit" : "Nouvelle vente"}>
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

        <ClientPicker
          clients={clients} clientNomSelected={clientNomSelected} onClientChange={onClientChange}
          showNewClient={showNewClient} newClientForm={newClientForm} setNewClientForm={setNewClientForm}
          newClientError={newClientError} creatingClient={creatingClient} createClientInline={createClientInline}
          setShowNewClient={setShowNewClient}
        />

        {panier.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text_secondary, marginBottom: 8 }}>Panier ({panier.length})</div>
            {panier.map(item => (
              <div key={item._key} style={{ backgroundColor: C.accent+'08', borderRadius: 10, padding: '10px 10px', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ flex: 1, fontWeight: 700, fontSize: 13, color: C.text_primary }}>{item.produit}</div>
                  <button onClick={() => retirerDuPanier(item._key)} style={{ background:'transparent', border:'none', color:C.danger, fontSize:18, cursor:'pointer', padding:'0 4px' }}>×</button>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: C.text_secondary, marginBottom: 4 }}>Quantite</div>
                    <input type="number" value={item.quantite} onChange={e => modifierItemPanier(item._key, 'quantite', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#fff', border: `1px solid ${C.input_border}`, borderRadius: 8, padding: 8, fontSize: 13 }} />
                  </div>
                  <div style={{ flex: 1.3 }}>
                    <div style={{ fontSize: 10, color: C.text_secondary, marginBottom: 4 }}>Prix vente</div>
                    <input type="number" value={item.prix_vente} onChange={e => modifierItemPanier(item._key, 'prix_vente', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#fff', border: `1px solid ${C.input_border}`, borderRadius: 8, padding: 8, fontSize: 13 }} />
                  </div>
                  <div style={{ flex: 1.3, textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: C.text_secondary, marginBottom: 4 }}>Total</div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.success, padding: '8px 0' }}>{fmtMoney(item.prix_vente*item.quantite)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ border: `1px dashed ${C.card_border}`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 8 }}>Ajouter un produit</div>
          <PickerSelect label="Produit" value={itemForm.produit} onChange={onItemProduitChange} options={produits.length === 0 ? ["Aucun produit enregistre"] : ['', ...produits.map(p => p.nom)]} />
          {produits.length === 0 && (
            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10, marginTop:-8 }}><button onClick={onClose} style={{ background:'#3D5AFE', color:'#fff', border:'none', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:700, cursor:'pointer' }} onClick={() => { onClose(); onNavigate && onNavigate('produits'); }}>+ Ajouter un produit</button></div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><FieldInput label="Prix achat" value={itemForm.prix_achat} onChange={v => setItemForm(f=>({...f,prix_achat:v}))} type="number" /></div>
            <div style={{ flex: 1 }}><FieldInput label="Prix vente *" value={itemForm.prix_vente} onChange={v => setItemForm(f=>({...f,prix_vente:v}))} type="number" /></div>
          </div>
          <FieldInput label="Quantite" value={itemForm.quantite} onChange={v => setItemForm(f=>({...f,quantite:v}))} type="number" />
          <button onClick={ajouterAuPanier} style={{ width: '100%', background: C.accent, color: '#fff', border: 'none', borderRadius: 10, padding: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Ajouter au panier</button>
        </div>

        <PickerSelect label="Paiement" value={methode} onChange={setMethode} options={['Cash','Mobile Money','Virement','Credit','Autre']} />
        {(modeCredit || methode === 'Credit') && (
          <div style={{ backgroundColor: C.danger+'10', borderRadius: 10, padding: 12, marginBottom: 14, border: '1.5px solid '+C.danger+'30' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.danger, marginBottom: 8 }}>Vente a credit</div>
            <FieldInput label="Date d'echeance (optionnel)" value={dateEcheance} onChange={setDateEcheance} type="date" />
          </div>
        )}

        {panier.length > 0 && (
          <div style={{ backgroundColor: C.success+'15', borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.text_secondary }}>Total panier</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: C.success }}>{fmtMoney(totalPanier)}</div>
          </div>
        )}
      </div>
      <FormFooter onSave={() => { setError(''); if (!clientNomSelected) { setError('Choisissez un client.'); return; } if (panier.length === 0) { setError('Ajoutez au moins un produit au panier.'); return; } setShowApercu(true); }} onClose={onClose} loading={loading} saveColor={C.success} saveLabel="Enregistrer la vente" />
    </Modal>
  );
};

const FacturesModal = ({ onClose }) => {
  const [factures, setFactures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [factureVue, setFactureVue] = useState(null);
  const [search, setSearch] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  useEffect(() => {
    getFactures().then(f => { setFactures(f); setLoading(false); });
  }, []);

  const supprimer = async (id) => {
    if (!window.confirm('Supprimer cette facture ?')) return;
    await deleteFacture(id);
    setFactures(f => f.filter(x => x._id !== id));
  };

  const reimprimer = async (f) => {
    const doc = await buildFacturePdf({ ...f, entete: f.entete });
    doc.save(`${f.numero}-${f.clientNom}.pdf`);
  };

  if (factureVue) {
    return (
      <FactureScreen
        factureData={factureVue}
        factureEntete={factureVue.entete || {}}
        onClose={() => setFactureVue(null)}
      />
    );
  }

  return (
    <Modal visible onClose={onClose} title="Historique factures">
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f5f6fa', borderRadius: 10, padding: '8px 12px', border: `1px solid ${C.card_border}`, marginBottom: 10 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Chercher client ou numero..." style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, width: '100%' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: C.text_secondary, marginBottom: 4 }}>Du</div>
            <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.card_border}`, borderRadius: 8, padding: '7px 10px', fontSize: 13 }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: C.text_secondary, marginBottom: 4 }}>Au</div>
            <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.card_border}`, borderRadius: 8, padding: '7px 10px', fontSize: 13 }} />
          </div>
          {(dateDebut || dateFin) && (
            <button onClick={() => { setDateDebut(''); setDateFin(''); }} style={{ background: 'transparent', border: 'none', color: C.danger, fontWeight: 700, fontSize: 12, cursor: 'pointer', marginTop: 14 }}>Effacer</button>
          )}
        </div>
        {loading
          ? <div style={{ textAlign: 'center', padding: 40, color: C.text_secondary }}>Chargement...</div>
          : factures.length === 0
            ? <div style={{ textAlign: 'center', padding: 40, color: C.text_secondary }}>Aucune facture.</div>
            : [...factures]
              .filter(f => {
                const matchSearch = f.clientNom?.toLowerCase().includes(search.toLowerCase()) || f.numero?.toLowerCase().includes(search.toLowerCase());
                const matchDebut = !dateDebut || (f.date||'') >= dateDebut;
                const matchFin = !dateFin || (f.date||'') <= dateFin;
                return matchSearch && matchDebut && matchFin;
              })
              .sort((a,b) => (b.date||'').localeCompare(a.date||''))
              .map(f => (
              <div key={f._id} style={{ marginBottom: 10 }}>
                <Card>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 4 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: C.text_primary }}>{f.numero}</div>
                      <div style={{ fontSize: 11, color: C.text_secondary, marginTop: 2 }}>{f.clientNom} · {fmtDate(f.date)}</div>
                      <div style={{ fontSize: 11, color: C.text_secondary }}>{f.items?.length || 1} produit(s)</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: C.success }}>{fmtMoney(f.total)}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <button onClick={() => setFactureVue(f)} style={{ backgroundColor: C.accent, border: 'none', borderRadius: 7, padding: '4px 8px', cursor: 'pointer', color: '#fff', fontSize: 11, fontWeight: 700 }}>Voir</button>
                        <button onClick={() => reimprimer(f)} style={{ backgroundColor: C.success, border: 'none', borderRadius: 7, padding: '4px 8px', cursor: 'pointer', color: '#fff', fontSize: 11, fontWeight: 700 }}>PDF</button>
                        <button onClick={() => supprimer(f._id)} style={{ backgroundColor: C.danger, border: 'none', borderRadius: 7, padding: '4px 8px', cursor: 'pointer', color: '#fff', fontSize: 11, fontWeight: 700 }}>X</button>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            ))
        }
      </div>
    </Modal>
  );
};

export const VentesPage = ({ onNavigate }) => {
  const [ventes, setVentes] = useState([]);
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [showCredit, setShowCredit] = useState(false);
  const [showFactures, setShowFactures] = useState(false);
  const [editingGroupe, setEditingGroupe] = useState(null);
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

  // Grouper les ventes par facture_numero
  const groupes = [];
  const dejaTrait = new Set();
  for (const v of filtered) {
    if (v.facture_numero && !dejaTrait.has(v.facture_numero)) {
      const groupe = filtered.filter(x => x.facture_numero === v.facture_numero);
      groupes.push({ key: v.facture_numero, ventes: groupe, type: 'groupe' });
      groupe.forEach(x => dejaTrait.add(x.facture_numero));
    } else if (!v.facture_numero) {
      groupes.push({ key: v._id, ventes: [v], type: 'simple' });
    }
  }

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
        <PrimaryBtn label="Nouvelle vente" onClick={() => { setEditingGroupe(null); setFormKey(k=>k+1); setShowForm(true); }} style={{ flex: 1 }} />
        <button onClick={() => setShowFactures(true)} style={{
          backgroundColor: C.accent+'15', border: `1.5px solid ${C.accent}60`,
          borderRadius: 12, padding: '13px 14px', color: C.accent,
          fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
        }}>Factures</button>
        <button onClick={() => { setEditingGroupe(null); setShowCredit(true); }} style={{
          backgroundColor: C.danger+'15', border: `1.5px solid ${C.danger}60`,
          borderRadius: 12, padding: '13px 14px', color: C.danger,
          fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
        }}>Credit</button>
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
          : groupes.map(g => {
              const v0 = g.ventes[0];
              const totalG = g.ventes.reduce((s,v) => s + v.prix_vente * v.quantite, 0);
              const margeG = g.ventes.reduce((s,v) => s + (v.prix_vente - v.prix_achat) * v.quantite, 0);
              return (
                <div key={g.key} style={{ marginBottom: 10 }} onClick={() => setEditingGroupe(g.ventes)}>
                  <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 4, cursor: 'pointer' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: C.text_primary }}>{getClientNom(v0.client_id)}</div>
                        {g.type === 'groupe'
                          ? g.ventes.map((v,i) => <div key={i} style={{ fontSize: 11, color: C.text_secondary, marginTop: i===0?2:1 }}>{v.produit} ×{v.quantite}</div>)
                          : <div style={{ fontSize: 11, color: C.text_secondary, marginTop: 2 }}>{v0.produit} ×{v0.quantite}</div>
                        }
                        <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                          <Badge label={v0.methode_paiement} color={C.accent} />
                          <span style={{ fontSize: 11, color: C.text_secondary }}>{fmtDate(v0.date_vente)}</span>
                          {g.type === 'groupe' && <span style={{ fontSize: 10, color: C.accent, fontWeight: 600 }}>{g.key}</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: C.success }}>{fmtMoney(totalG)}</div>
                        <div style={{ fontSize: 11, color: C.success }}>+{fmtMoney(margeG)}</div>
                      </div>
                    </div>
                  </Card>
                </div>
              );
            })
      }

      {showForm && (
        <VentePanierForm key={formKey} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} onNavigate={onNavigate} />
      )}

      {showCredit && (
        <VentePanierForm
          key="credit"
          onClose={() => setShowCredit(false)}
          onSaved={() => { setShowCredit(false); load(); }}
          onNavigate={onNavigate}
          modeCredit={true}
        />
      )}

      {editingGroupe && (
        <VentureFactureEditForm
          key={editingGroupe.map(v=>v._id).join('-')}
          ventesGroupe={editingGroupe}
          onClose={() => setEditingGroupe(null)}
          onSaved={() => { setEditingGroupe(null); load(); }}
          onNavigate={onNavigate}
        />
      )}
      {showFactures && <FacturesModal onClose={() => setShowFactures(false)} />}
    </div>
  );
};
