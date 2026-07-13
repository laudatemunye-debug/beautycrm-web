import { useState, useEffect } from 'react';
import { C } from '../theme';
import jsPDF from 'jspdf';
import { Card, SectionTitle, PrimaryBtn, GhostBtn, FieldInput, PickerSelect, Modal, fmtMoney } from '../components/UI';
import { EmployesModal } from '../components/EmployesModal';
import { useDevise } from '../hooks/useDevise';
import { useEntreprise } from '../hooks/useEntreprise';
import {
  getPlanComptable, initPlanComptableDefaut, migrerVentesVersEcritures, getAuditLog,
  getEcritures, saveEcriture, annulerEcriture,
  getCharges, saveCharge,
  getEmployes, saveEmploye, deleteEmploye,
  getBulletins, saveBulletin,
  getPeriodes, savePeriode, cloturerPeriode,
  getBalance, getCompteResultat, getMasseSalariale,
  today, getSetting
} from '../db/index.js';

const TABS = ['Écritures','Charges','Paie','Balance','Résultat','Périodes','Audit'];

const sharePdf = async (doc, fileName, titre) => {
  const blob = doc.output('blob');
  const file = new File([blob], fileName, { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: titre, text: titre }); return; } catch(_) {}
  }
  doc.save(fileName);
};

const printPdf = (doc) => {
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const w = window.open(url);
  if (w) w.onload = () => { w.print(); };
};

const buildEnteteCompta = async () => {
  const nom = await getSetting('facture_entreprise_nom') || await getSetting('entreprise') || 'BeautyCRM';
  const adresse = await getSetting('facture_entreprise_adresse') || '';
  const telephone = await getSetting('facture_entreprise_telephone') || await getSetting('telephone') || '';
  const logo = await getSetting('facture_entreprise_logo') || '';
  return { nom, adresse, telephone, logo };
};

const addEntete = (doc, ent, titre, numero, left, right) => {
  let y = 10;
  let textLeft = left;
  if (ent.logo) {
    try { doc.addImage(ent.logo, 'PNG', left, y - 4, 12, 12); textLeft = left + 15; } catch(_) {}
  }
  doc.setFontSize(11); doc.setFont(undefined, 'bold');
  doc.text(ent.nom, textLeft, y); y += 5;
  doc.setFont(undefined, 'normal'); doc.setFontSize(7);
  if (ent.adresse) { doc.text(ent.adresse, textLeft, y); y += 3.5; }
  if (ent.telephone) { doc.text(ent.telephone, textLeft, y); y += 3.5; }
  y += 3;
  doc.setFontSize(12); doc.setFont(undefined, 'bold');
  doc.text(titre, right, 12, { align: 'right' });
  doc.setFontSize(8); doc.setFont(undefined, 'normal');
  doc.text(`N° ${numero}`, right, 18, { align: 'right' });
  doc.text(new Date().toLocaleDateString('fr-FR'), right, 23, { align: 'right' });
  doc.setDrawColor(200);
  doc.line(left, y, right, y); y += 6;
  return y;
};

const buildBulletinPdf = async (bulletin, employe, devise) => {
  const symbol = devise || 'FC';
  const ent = await buildEnteteCompta();
  const numero = `BP-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
  const doc = new jsPDF({ unit: 'mm', format: [100, 170] });
  const left = 8, right = 92;
  let y = addEntete(doc, ent, 'BULLETIN DE PAIE', numero, left, right);

  doc.setFontSize(9); doc.setFont(undefined, 'bold');
  doc.text('EMPLOYÉ', left, y); y += 5;
  doc.setFont(undefined, 'normal');
  doc.setFontSize(10);
  doc.text(employe?.nom || '-', left, y); y += 5;
  doc.setFontSize(8);
  doc.text(`Poste : ${employe?.poste || '-'}`, left, y); y += 4;
  doc.text(`Période : ${bulletin.periode_debut} → ${bulletin.periode_fin}`, left, y); y += 6;

  doc.line(left, y, right, y); y += 6;

  const ligne = (label, montant, bold = false) => {
    doc.setFontSize(9);
    if (bold) doc.setFont(undefined, 'bold'); else doc.setFont(undefined, 'normal');
    doc.text(label, left, y);
    doc.text(`${Math.round(montant)} ${symbol}`, right, y, { align: 'right' });
    y += 6;
  };

  ligne('Salaire de base', (bulletin.salaire_brut || 0) - (bulletin.primes || 0));
  if (bulletin.primes > 0) ligne('Primes', bulletin.primes);
  ligne('Salaire brut', bulletin.salaire_brut || 0);

  y += 2; doc.line(left, y, right, y); y += 6;

  if (bulletin.retenues > 0) ligne('Retenues', bulletin.retenues);

  y += 2; doc.line(left, y, right, y); y += 6;
  ligne('SALAIRE NET', bulletin.salaire_net || 0, true);

  y += 6; doc.setLineDashPattern([1,1], 0);
  doc.line(left, y, right, y); doc.setLineDashPattern([], 0);
  y += 6;
  doc.setFontSize(6.5);
  doc.text(`Emis le ${new Date().toLocaleString('fr-FR')}`, (left+right)/2, y, { align: 'center' });
  y += 4;
  doc.text('Designed by IZIsoft', (left+right)/2, y, { align: 'center' });

  return doc;
};

const buildBalancePdf = async (balance, devise) => {
  const symbol = devise || 'FC';
  const hauteur = Math.max(120, 60 + balance.length * 8);
  const doc = new jsPDF({ unit: 'mm', format: [120, hauteur] });
  const left = 8, right = 112;
  const ent = await buildEnteteCompta();
  const numero = `BAL-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}`;
  let y = addEntete(doc, ent, 'BALANCE DES COMPTES', numero, left, right);
  doc.setFontSize(7.5); doc.setFont(undefined, 'bold');
  doc.text('Code', left, y);
  doc.text('Libellé', left+14, y);
  doc.text('Débit', right-38, y, { align: 'right' });
  doc.text('Crédit', right-18, y, { align: 'right' });
  doc.text('Solde', right, y, { align: 'right' });
  doc.setFont(undefined, 'normal'); y += 5; doc.line(left, y, right, y); y += 4;
  for (const c of balance) {
    doc.setFontSize(7.5);
    doc.text(c.code, left, y);
    doc.text((c.libelle||'').substring(0,22), left+14, y);
    doc.text(`${Math.round(c.total_debit)} ${symbol}`, right-38, y, { align: 'right' });
    doc.text(`${Math.round(c.total_credit)} ${symbol}`, right-18, y, { align: 'right' });
    doc.setFont(undefined, 'bold');
    doc.text(`${Math.round(c.solde)} ${symbol}`, right, y, { align: 'right' });
    doc.setFont(undefined, 'normal'); y += 7;
  }
  y += 2; doc.setLineDashPattern([1,1], 0); doc.line(left, y, right, y); doc.setLineDashPattern([], 0); y += 5;
  doc.setFontSize(6);
  doc.text(`Emis le ${new Date().toLocaleString('fr-FR')}`, (left+right)/2, y, { align: 'center' }); y += 3.5;
  doc.text('Designed by IZIsoft', (left+right)/2, y, { align: 'center' });
  return doc;
};

const buildResultatPdf = async (resultat, devise) => {
  const symbol = devise || 'FC';
  const hauteur = Math.max(120, 80 + ((resultat?.charges?.length||0) + (resultat?.produits?.length||0)) * 8);
  const doc = new jsPDF({ unit: 'mm', format: [120, hauteur] });
  const left = 8, right = 112;
  const ent = await buildEnteteCompta();
  const numero = `CR-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}`;
  let y = addEntete(doc, ent, 'COMPTE DE RÉSULTAT', numero, left, right);
  doc.setFontSize(9); doc.setFont(undefined, 'bold');
  doc.text('CHARGES', left, y); y += 5; doc.setFont(undefined, 'normal');
  for (const c of (resultat?.charges||[])) {
    doc.setFontSize(8);
    doc.text(`${c.code} ${c.libelle}`, left+4, y);
    doc.text(`${Math.round(c.total_debit)} ${symbol}`, right, y, { align: 'right' }); y += 6;
  }
  doc.setFont(undefined, 'bold');
  doc.text('Total charges', left+4, y);
  doc.text(`${Math.round(resultat?.total_charges||0)} ${symbol}`, right, y, { align: 'right' });
  doc.setFont(undefined, 'normal'); y += 8;
  doc.line(left, y, right, y); y += 5;
  doc.setFontSize(9); doc.setFont(undefined, 'bold');
  doc.text('PRODUITS', left, y); y += 5; doc.setFont(undefined, 'normal');
  for (const c of (resultat?.produits||[])) {
    doc.setFontSize(8);
    doc.text(`${c.code} ${c.libelle}`, left+4, y);
    doc.text(`${Math.round(c.total_credit)} ${symbol}`, right, y, { align: 'right' }); y += 6;
  }
  doc.setFont(undefined, 'bold');
  doc.text('Total produits', left+4, y);
  doc.text(`${Math.round(resultat?.total_produits||0)} ${symbol}`, right, y, { align: 'right' });
  y += 10; doc.line(left, y, right, y); y += 6;
  doc.setFontSize(11);
  doc.text((resultat?.resultat||0) >= 0 ? 'BÉNÉFICE NET' : 'PERTE NETTE', left, y);
  doc.text(`${Math.round(resultat?.resultat||0)} ${symbol}`, right, y, { align: 'right' });
  y += 10; doc.setLineDashPattern([1,1], 0); doc.line(left, y, right, y); doc.setLineDashPattern([], 0); y += 5;
  doc.setFontSize(6); doc.setFont(undefined, 'normal');
  doc.text(`Emis le ${new Date().toLocaleString('fr-FR')}`, (left+right)/2, y, { align: 'center' }); y += 3.5;
  doc.text('Designed by IZIsoft', (left+right)/2, y, { align: 'center' });
  return doc;
};

export default function ComptabilitePage({ onNavigate }) {
  const devise = useDevise();
  const bizMode = useEntreprise();
  const entrepriseEmployes = bizMode.employes || [];
  const fmt = (n) => fmtMoney(n, devise);

  const [tab, setTab] = useState('Écritures');
  const [plan, setPlan] = useState([]);
  const [ecritures, setEcritures] = useState([]);
  const [charges, setCharges] = useState([]);
  const [employes, setEmployes] = useState([]);
  const [bulletins, setBulletins] = useState([]);
  const [periodes, setPeriodes] = useState([]);
  const [balance, setBalance] = useState([]);
  const [resultat, setResultat] = useState(null);
  const [masse, setMasse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [auditLog, setAuditLog] = useState([]);
  const [msg, setMsg] = useState('');

  const [fE, setFE] = useState({ date: today(), compte_debit: '', compte_credit: '', montant: '', libelle: '' });
  const [fC, setFC] = useState({ date: today(), categorie: '', libelle: '', montant: '', compte_charge_id: '', compte_paiement_id: '' });
  const [fEmp, setFEmp] = useState({ user_ref: '', nom: '', poste: '', salaire_base: '', mode_paiement: 'especes' });
  const [showEmpForm, setShowEmpForm] = useState(false);
  const [showEmployesModal, setShowEmployesModal] = useState(false);
  const [showEcritureForm, setShowEcritureForm] = useState(false);
  const [showChargeForm, setShowChargeForm] = useState(false);
  const [showBulletinForm, setShowBulletinForm] = useState(false);
  const [showPeriodeForm, setShowPeriodeForm] = useState(false);
  const [fB, setFB] = useState({ employe_id: '', periode_debut: '', periode_fin: '', primes: 0, retenues: 0, compte_salaire_id: '', compte_paiement_id: '' });
  const [fP, setFP] = useState({ date_debut: '', date_fin: '' });

  const notify = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const load = async () => {
    setLoading(true);
    await initPlanComptableDefaut();
    await migrerVentesVersEcritures();
    const [p, e, c, emp, b, per, bal, res, mas, audit] = await Promise.all([
      getPlanComptable(), getEcritures(), getCharges(),
      getEmployes(), getBulletins(), getPeriodes(),
      getBalance(), getCompteResultat(), getMasseSalariale(), getAuditLog()
    ]);
    setPlan(p); setEcritures(e); setCharges(c);
    setEmployes(emp); setBulletins(b); setPeriodes(per);
    setBalance(bal); setResultat(res); setMasse(mas); setAuditLog(audit || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // selects natifs utilisés directement dans le JSX

  const selStyle = { width: '100%', padding: 13, borderRadius: 10, border: `1px solid ${C.input_border}`, background: C.input_bg, color: C.text_primary, fontSize: 14, marginBottom: 14 };
  const selLabel = (label) => <div style={{ fontSize: 11, color: C.text_secondary, fontWeight: 600, marginBottom: 6 }}>{label}</div>;

  if (loading) return <div style={{ padding: 24, color: C.text_secondary }}>Chargement...</div>;

  return (
    <div style={{ padding: 16 }}>

      {msg && (
        <div style={{ background: '#d4edda', color: '#155724', padding: '10px 14px', borderRadius: 10, marginBottom: 14, fontSize: 14 }}>
          {msg}
        </div>
      )}

      {/* TABS */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: tab === t ? C.accent : C.card_bg,
            color: tab === t ? '#fff' : C.text_secondary,
            boxShadow: tab === t ? '0 2px 8px rgba(61,90,254,0.3)' : '0 1px 3px rgba(0,0,0,0.08)',
          }}>{t}</button>
        ))}
        <button onClick={() => { bizMode.refreshEmployes && bizMode.refreshEmployes(); setShowEmployesModal(true); }} style={{
          padding: '7px 14px', borderRadius: 20, border: `1px solid ${C.pink}`, cursor: 'pointer', fontSize: 13, fontWeight: 600,
          background: C.card_bg, color: C.pink,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>👥 Employés</button>
      </div>

      <EmployesModal visible={showEmployesModal} onClose={() => setShowEmployesModal(false)} bizMode={bizMode} />

      {/* ECRITURES */}
      {tab === 'Écritures' && (
        <>
          {showEcritureForm && (
            <Modal visible onClose={() => setShowEcritureForm(false)} title="Nouvelle écriture">
            <div style={{ padding: 16 }}>
            <FieldInput label="Date" type="date" value={fE.date} onChange={v => setFE(p => ({...p, date: v}))} />
            <div>{selLabel("Compte débit")}<select style={selStyle} value={fE.compte_debit} onChange={e => setFE(p=>({...p,compte_debit:e.target.value}))}><option value="">Choisir...</option>{plan.map(c=><option key={c._id} value={c._id}>{c.code} - {c.libelle}</option>)}</select></div>
            <div>{selLabel("Compte crédit")}<select style={selStyle} value={fE.compte_credit} onChange={e => setFE(p=>({...p,compte_credit:e.target.value}))}><option value="">Choisir...</option>{plan.map(c=><option key={c._id} value={c._id}>{c.code} - {c.libelle}</option>)}</select></div>
            <FieldInput label="Montant" type="number" value={fE.montant} onChange={v => setFE(p => ({...p, montant: v}))} placeholder="0" />
            <FieldInput label="Libellé" value={fE.libelle} onChange={v => setFE(p => ({...p, libelle: v}))} placeholder="Description de l opération" />
            <PrimaryBtn label="Enregistrer" onClick={async () => {
              if (!fE.compte_debit || !fE.compte_credit || !fE.montant || !fE.libelle) return notify('Tous les champs sont requis');
              try {
                await saveEcriture({ ...fE, montant: parseFloat(fE.montant) });
                setFE({ date: today(), compte_debit: '', compte_credit: '', montant: '', libelle: '' });
                setShowEcritureForm(false); await load(); notify('Écriture enregistrée ✓');
              } catch(e) { notify('❌ ' + e.message); }
            }} />
            </div></Modal>
          )}
          <div style={{ marginBottom: 14 }}><PrimaryBtn label="Nouvelle écriture" onClick={() => setShowEcritureForm(true)} style={{ width: 'auto' }} /></div>

          <Card>
            <SectionTitle>Journal ({ecritures.length})</SectionTitle>
            {ecritures.length === 0 && <div style={{ color: C.text_light, fontSize: 13, padding: '8px 0' }}>Aucune écriture</div>}
            {ecritures.map(e => {
              const d = plan.find(p => p._id === e.compte_debit);
              const c = plan.find(p => p._id === e.compte_credit);
              return (
                <div key={e._id} style={{ borderBottom: `1px solid ${C.card_border}`, padding: '10px 0', opacity: e.annule_par ? 0.4 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text_primary }}>{e.libelle}</div>
                      <div style={{ fontSize: 11, color: C.text_secondary, marginTop: 2 }}>
                        {e.date} · D: {d?.code || '-'} · C: {c?.code || '-'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: C.accent }}>{fmt(e.montant)}</div>
                      {!e.annule_par && (
                        <button onClick={async () => { await annulerEcriture(e._id); await load(); notify('Écriture annulée'); }}
                          style={{ fontSize: 11, color: C.danger, background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}>
                          Annuler
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>
        </>
      )}

      {/* CHARGES */}
      {tab === 'Charges' && (
        <>
          {showChargeForm && (
            <Modal visible onClose={() => setShowChargeForm(false)} title="Nouvelle charge">
            <div style={{ padding: 16 }}>
            <FieldInput label="Date" type="date" value={fC.date} onChange={v => setFC(p => ({...p, date: v}))} />
            <div>{selLabel('Catégorie')}<select style={selStyle} value={fC.categorie} onChange={e=>setFC(p=>({...p,categorie:e.target.value}))}><option value=''>Choisir...</option>{['Loyer','Transport','Achat marchandises','Salaires','Charges sociales','Autre'].map(x=><option key={x} value={x}>{x}</option>)}</select></div>
            <FieldInput label="Libellé" value={fC.libelle} onChange={v => setFC(p => ({...p, libelle: v}))} placeholder="Description" />
            <FieldInput label="Montant" type="number" value={fC.montant} onChange={v => setFC(p => ({...p, montant: v}))} placeholder="0" />
            <div>{selLabel('Compte charge (débit)')}<select style={selStyle} value={fC.compte_charge_id} onChange={e=>setFC(p=>({...p,compte_charge_id:e.target.value}))}><option value=''>Choisir...</option>{plan.filter(c=>c.type==='charge').map(c=><option key={c._id} value={c._id}>{c.code} - {c.libelle}</option>)}</select></div>
            <div>{selLabel('Compte paiement (crédit)')}<select style={selStyle} value={fC.compte_paiement_id} onChange={e=>setFC(p=>({...p,compte_paiement_id:e.target.value}))}><option value=''>Choisir...</option>{plan.filter(c=>c.type==='actif').map(c=><option key={c._id} value={c._id}>{c.code} - {c.libelle}</option>)}</select></div>
            <PrimaryBtn label="Enregistrer" onClick={async () => {
              if (!fC.categorie || !fC.libelle || !fC.montant) return notify('Champs manquants');
              await saveCharge({ ...fC, montant: parseFloat(fC.montant) });
              setFC({ date: today(), categorie: '', libelle: '', montant: '', compte_charge_id: '', compte_paiement_id: '' });
              setShowChargeForm(false); await load(); notify('Charge enregistrée ✓');
            }} />
            </div></Modal>
          )}
          <div style={{ marginBottom: 14 }}><PrimaryBtn label="Nouvelle charge" onClick={() => setShowChargeForm(true)} style={{ width: 'auto' }} /></div>
          <Card>
            <SectionTitle>Charges ({charges.length})</SectionTitle>
            {charges.length === 0 && <div style={{ color: C.text_light, fontSize: 13 }}>Aucune charge</div>}
            {charges.map(c => (
              <div key={c._id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${C.card_border}`, padding: '10px 0' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text_primary }}>{c.libelle}</div>
                  <div style={{ fontSize: 11, color: C.text_secondary }}>{c.date} · {c.categorie}</div>
                </div>
                <div style={{ fontWeight: 700, color: C.danger }}>{fmt(c.montant)}</div>
              </div>
            ))}
          </Card>
        </>
      )}

      {/* EMPLOYES */}
      {tab === 'Employés' && (
        <>
          {showEmpForm && (
            <Modal visible onClose={() => setShowEmpForm(false)} title="Ajouter un employé à la paie">
            <div style={{ padding: 16 }}>
            <div>{selLabel("Membre de l'équipe")}
              <select style={selStyle} value={fEmp.user_ref} onChange={e => {
                const m = entrepriseEmployes.find(x => (x.id||x.email) === e.target.value);
                if (m) setFEmp(p => ({ ...p, user_ref: e.target.value, nom: m.nom||m.name||m.email, poste: m.poste||m.role||'' }));
                else setFEmp(p => ({ ...p, user_ref: e.target.value }));
              }}>
                <option value=''>Choisir un membre...</option>
                {(entrepriseEmployes||[]).map(m => <option key={m.id||m.email} value={m.id||m.email}>{m.nom||m.name||m.email}{m.poste||m.role ? ` — ${m.poste||m.role}` : ''}</option>)}
              </select>
            </div>
            <FieldInput label="Nom" value={fEmp.nom} onChange={v => setFEmp(p => ({...p, nom: v}))} placeholder="Nom complet" />
            <FieldInput label="Poste" value={fEmp.poste} onChange={v => setFEmp(p => ({...p, poste: v}))} placeholder="Ex: Vendeuse" />
            <FieldInput label="Salaire de base" type="number" value={fEmp.salaire_base} onChange={v => setFEmp(p => ({...p, salaire_base: v}))} placeholder="0" />
            <div>{selLabel('Mode de paiement')}<select style={selStyle} value={fEmp.mode_paiement} onChange={e=>setFEmp(p=>({...p,mode_paiement:e.target.value}))}><option value='especes'>Espèces</option><option value='mobile_money'>Mobile Money</option><option value='banque'>Banque</option></select></div>
            <PrimaryBtn label="Enregistrer" onClick={async () => {
              if (!fEmp.nom || !fEmp.salaire_base) return notify('Nom et salaire requis');
              await saveEmploye({ ...fEmp, salaire_base: parseFloat(fEmp.salaire_base) });
              setFEmp({ user_ref: '', nom: '', poste: '', salaire_base: '', mode_paiement: 'especes' });
              setShowEmpForm(false); await load(); notify('Employé enregistré ✓');
            }} />
            </div></Modal>
          )}
          <div style={{ marginBottom: 14 }}><PrimaryBtn label="Ajouter un employé" onClick={() => setShowEmpForm(true)} style={{ width: 'auto' }} /></div>
          <Card>
            <SectionTitle>Membres de l'équipe ({entrepriseEmployes.length})</SectionTitle>
            {entrepriseEmployes.length === 0 && <div style={{ color: C.text_light, fontSize: 13 }}>Aucun membre — configurez votre équipe dans Paramètres</div>}
            {entrepriseEmployes.map(e => (
              <div key={e.id||e.email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.card_border}`, padding: '10px 0' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text_primary }}>{e.nom||e.name||e.email}</div>
                  <div style={{ fontSize: 11, color: C.text_secondary }}>{e.poste||e.role||'—'}</div>
                </div>
                <div style={{ fontSize: 11, color: e.salaire_base ? C.accent : C.text_light }}>
                  {e.salaire_base ? fmt(e.salaire_base) : 'Salaire non défini'}
                </div>
              </div>
            ))}
          </Card>
        </>
      )}

      {/* PAIE */}
      {tab === 'Paie' && (
        <>
          {masse && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
              {[
                { label: 'Masse brute', val: fmt(masse.total_brut), color: C.text_primary },
                { label: 'Total net versé', val: fmt(masse.total_net), color: C.accent },
                { label: 'Bulletins émis', val: masse.nb_bulletins, color: C.success },
              ].map(x => (
                <Card key={x.label} style={{ textAlign: 'center', padding: 12 }}>
                  <div style={{ fontSize: 11, color: C.text_secondary, marginBottom: 4 }}>{x.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: x.color }}>{x.val}</div>
                </Card>
              ))}
            </div>
          )}
          {showBulletinForm && (
            <Modal visible onClose={() => setShowBulletinForm(false)} title="Générer un bulletin de paie">
            <div style={{ padding: 16 }}>
            <div>{selLabel('Employé')}<select style={selStyle} value={fB.employe_id} onChange={e=>setFB(p=>({...p,employe_id:e.target.value}))}><option value=''>Choisir...</option>{employes.map(e=><option key={e._id} value={e._id}>{e.nom} — base {fmt(e.salaire_base)}</option>)}</select></div>
            <FieldInput label="Période début" type="date" value={fB.periode_debut} onChange={v => setFB(p => ({...p, periode_debut: v}))} />
            <FieldInput label="Période fin" type="date" value={fB.periode_fin} onChange={v => setFB(p => ({...p, periode_fin: v}))} />
            <FieldInput label="Primes" type="number" value={fB.primes} onChange={v => setFB(p => ({...p, primes: v}))} placeholder="0" />
            <FieldInput label="Retenues" type="number" value={fB.retenues} onChange={v => setFB(p => ({...p, retenues: v}))} placeholder="0" />
            <div>{selLabel('Compte salaires (débit)')}<select style={selStyle} value={fB.compte_salaire_id} onChange={e=>setFB(p=>({...p,compte_salaire_id:e.target.value}))}><option value=''>Choisir...</option>{plan.filter(c=>c.type==='charge').map(c=><option key={c._id} value={c._id}>{c.code} - {c.libelle}</option>)}</select></div>
            <div>{selLabel('Compte paiement (crédit)')}<select style={selStyle} value={fB.compte_paiement_id} onChange={e=>setFB(p=>({...p,compte_paiement_id:e.target.value}))}><option value=''>Choisir...</option>{plan.filter(c=>c.type==='actif').map(c=><option key={c._id} value={c._id}>{c.code} - {c.libelle}</option>)}</select></div>
            {fB.compte_paiement_id && (() => {
              const solde = balance.find(b => b._id === fB.compte_paiement_id)?.solde || 0;
              return (
                <div style={{ background: solde > 0 ? '#c6f6d5' : '#fed7d7', borderRadius:8, padding:'8px 12px', fontSize:13, marginBottom:10, fontWeight:600, color: solde > 0 ? '#276749' : '#c53030' }}>
                  Solde disponible : {fmt(solde)}
                </div>
              );
            })()}
            {fB.compte_paiement_id && (() => {
              const solde = balance.find(b => b._id === fB.compte_paiement_id)?.solde || 0;
              return (
                <div style={{ background: solde > 0 ? '#c6f6d5' : '#fed7d7', borderRadius:8, padding:'8px 12px', fontSize:13, marginBottom:10, fontWeight:600, color: solde > 0 ? '#276749' : '#c53030' }}>
                  Solde disponible : {fmt(solde)}
                </div>
              );
            })()}
            <PrimaryBtn label="Générer" onClick={async () => {
              if (!fB.employe_id || !fB.periode_debut || !fB.periode_fin) return notify('Champs manquants');
              try {
                await saveBulletin({ ...fB, primes: parseFloat(fB.primes||0), retenues: parseFloat(fB.retenues||0) });
                setFB({ employe_id: '', periode_debut: '', periode_fin: '', primes: 0, retenues: 0, compte_salaire_id: '', compte_paiement_id: '' });
                setShowBulletinForm(false); await load(); notify('Bulletin généré ✓');
              } catch(e) { notify('❌ ' + e.message); }
            }} />
            </div></Modal>
          )}
          <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:14 }}>
            <PrimaryBtn label="Générer un bulletin de paie" onClick={() => { setBulletinError(''); setShowBulletinForm(true); }} style={{ width: 'auto' }} />
            <button onClick={() => exportBulletinsExcel(bulletins, employes, devise)} style={{ fontSize:12, background: '#21a36620', border:'1px solid #21a36640', borderRadius:8, padding:'8px 14px', color:'#21a366', cursor:'pointer', fontWeight:600 }}>📊 Excel paie</button>
          </div>
          <Card>
            <SectionTitle>Bulletins émis ({bulletins.length})</SectionTitle>
            {bulletins.length === 0 && <div style={{ color: C.text_light, fontSize: 13 }}>Aucun bulletin</div>}
            {bulletins.map(b => {
              const emp = employes.find(e => e._id === b.employe_id);
              return (
                <div key={b._id} style={{ borderBottom: `1px solid ${C.card_border}`, padding: '10px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text_primary }}>{emp?.nom || '-'}</div>
                      <div style={{ fontSize: 11, color: C.text_secondary }}>{b.periode_debut} → {b.periode_fin}</div>
                      <div style={{ fontSize: 11, color: C.text_light }}>Brut: {fmt(b.salaire_brut)} · Retenues: {fmt(b.retenues)}</div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                      <div style={{ fontWeight: 800, fontSize: 16, color: C.success }}>{fmt(b.salaire_net)}</div>
                      <div style={{ display:'flex', gap:4 }}>
                        <button onClick={async () => { const emp = employes.find(e=>e._id===b.employe_id); const doc = await buildBulletinPdf(b, emp, devise); doc.save(`bulletin_${emp?.nom||'employe'}_${b.periode_debut}.pdf`); }} style={{ fontSize:10, background: C.accent+'15', border:`1px solid ${C.accent}40`, borderRadius:6, padding:'3px 7px', color:C.accent, cursor:'pointer', fontWeight:600 }}>⬇</button>
                        <button onClick={async () => { const emp = employes.find(e=>e._id===b.employe_id); const doc = await buildBulletinPdf(b, emp, devise); printPdf(doc); }} style={{ fontSize:10, background:'#f5f5f5', border:'1px solid #ddd', borderRadius:6, padding:'3px 7px', color:'#555', cursor:'pointer', fontWeight:600 }}>🖨</button>
                        <button onClick={async () => { const emp = employes.find(e=>e._id===b.employe_id); const doc = await buildBulletinPdf(b, emp, devise); await sharePdf(doc, `bulletin_${emp?.nom||'employe'}_${b.periode_debut}.pdf`, `Bulletin de paie - ${emp?.nom||''}`); }} style={{ fontSize:10, background:'#25D36620', border:'1px solid #25D36640', borderRadius:6, padding:'3px 7px', color:'#25D366', cursor:'pointer', fontWeight:600 }}>📤</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>
        </>
      )}

      {/* BALANCE */}
      {tab === 'Balance' && (
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <SectionTitle>Balance des comptes</SectionTitle>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={async () => { const doc = await buildBalancePdf(balance, devise); doc.save(`balance_${today()}.pdf`); }} style={{ fontSize:11, background: C.accent+'15', border:`1px solid ${C.accent}40`, borderRadius:8, padding:'5px 10px', color:C.accent, cursor:'pointer', fontWeight:600 }}>⬇ PDF</button>
              <button onClick={async () => { const doc = await buildBalancePdf(balance, devise); printPdf(doc); }} style={{ fontSize:11, background: '#f5f5f5', border:'1px solid #ddd', borderRadius:8, padding:'5px 10px', color:'#555', cursor:'pointer', fontWeight:600 }}>🖨 Imprimer</button>
              <button onClick={async () => { const doc = await buildBalancePdf(balance, devise); await sharePdf(doc, `balance_${today()}.pdf`, 'Balance des comptes'); }} style={{ fontSize:11, background: '#25D36620', border:'1px solid #25D36640', borderRadius:8, padding:'5px 10px', color:'#25D366', cursor:'pointer', fontWeight:600 }}>📤 Envoyer</button>
            </div>
          </div>
          {balance.map(c => (
            <div key={c._id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${C.card_border}`, padding: '8px 0', fontSize: 13 }}>
              <div>
                <span style={{ fontWeight: 600, color: C.text_primary }}>{c.code}</span>
                <span style={{ color: C.text_secondary, marginLeft: 8 }}>{c.libelle}</span>
                <span style={{ fontSize: 10, color: C.text_light, marginLeft: 6 }}>({c.type})</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: C.text_secondary, fontSize: 11 }}>D:{fmt(c.total_debit)} / C:{fmt(c.total_credit)} </span>
                <span style={{ fontWeight: 700, color: c.solde >= 0 ? C.success : C.danger }}>{fmt(c.solde)}</span>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* RESULTAT */}
      {tab === 'Résultat' && resultat && (
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <SectionTitle>Compte de résultat</SectionTitle>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={async () => { const doc = await buildResultatPdf(resultat, devise); doc.save(`resultat_${today()}.pdf`); }} style={{ fontSize:11, background: C.success+'20', border:`1px solid ${C.success}40`, borderRadius:8, padding:'5px 10px', color:C.success, cursor:'pointer', fontWeight:600 }}>⬇ PDF</button>
              <button onClick={async () => { const doc = await buildResultatPdf(resultat, devise); printPdf(doc); }} style={{ fontSize:11, background: '#f5f5f5', border:'1px solid #ddd', borderRadius:8, padding:'5px 10px', color:'#555', cursor:'pointer', fontWeight:600 }}>🖨 Imprimer</button>
              <button onClick={async () => { const doc = await buildResultatPdf(resultat, devise); await sharePdf(doc, `resultat_${today()}.pdf`, 'Compte de résultat'); }} style={{ fontSize:11, background: '#25D36620', border:'1px solid #25D36640', borderRadius:8, padding:'5px 10px', color:'#25D366', cursor:'pointer', fontWeight:600 }}>📤 Envoyer</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, color: C.danger, marginBottom: 8 }}>CHARGES</div>
              {resultat.charges.map(c => (
                <div key={c._id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: `1px solid ${C.card_border}` }}>
                  <span style={{ color: C.text_secondary }}>{c.code} {c.libelle}</span>
                  <span style={{ fontWeight: 600 }}>{fmt(c.total_debit)}</span>
                </div>
              ))}
              <div style={{ fontWeight: 800, marginTop: 8, color: C.danger }}>Total : {fmt(resultat.total_charges)}</div>
            </div>
            <div>
              <div style={{ fontWeight: 700, color: C.success, marginBottom: 8 }}>PRODUITS</div>
              {resultat.produits.map(c => (
                <div key={c._id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: `1px solid ${C.card_border}` }}>
                  <span style={{ color: C.text_secondary }}>{c.code} {c.libelle}</span>
                  <span style={{ fontWeight: 600 }}>{fmt(c.total_credit)}</span>
                </div>
              ))}
              <div style={{ fontWeight: 800, marginTop: 8, color: C.success }}>Total : {fmt(resultat.total_produits)}</div>
            </div>
          </div>
          <div style={{ background: resultat.resultat >= 0 ? '#c6f6d5' : '#fed7d7', borderRadius: 12, padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: C.text_secondary, marginBottom: 4 }}>{resultat.resultat >= 0 ? 'BÉNÉFICE NET' : 'PERTE NETTE'}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: resultat.resultat >= 0 ? C.success : C.danger }}>{fmt(resultat.resultat)}</div>
          </div>
        </Card>
      )}

      {/* AUDIT */}
      {tab === 'Audit' && (
        <Card>
          <SectionTitle>Journal d'audit ({auditLog.length})</SectionTitle>
          {auditLog.length === 0 && <div style={{ color: C.text_light, fontSize: 13 }}>Aucune action enregistrée</div>}
          {auditLog.map((a, i) => (
            <div key={a._id || i} style={{ borderBottom: `1px solid ${C.card_border}`, padding: '8px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text_primary }}>{a.action} — {a.entite}</div>
                <div style={{ fontSize: 11, color: C.text_light }}>{a.created_at ? new Date(a.created_at).toLocaleString('fr-FR') : ''}</div>
              </div>
              <div style={{ fontSize: 11, color: C.text_secondary, marginTop: 2 }}>
                {a.user_id || 'système'} {a.entite_id ? `· ID: ${a.entite_id}` : ''}
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* PERIODES */}
      {tab === 'Périodes' && (
        <>
          {showPeriodeForm && (
            <Modal visible onClose={() => setShowPeriodeForm(false)} title="Nouvelle période comptable">
            <div style={{ padding: 16 }}>
            <FieldInput label="Date début" type="date" value={fP.date_debut} onChange={v => setFP(p => ({...p, date_debut: v}))} />
            <FieldInput label="Date fin" type="date" value={fP.date_fin} onChange={v => setFP(p => ({...p, date_fin: v}))} />
            <PrimaryBtn label="Créer" onClick={async () => {
              if (!fP.date_debut || !fP.date_fin) return notify('Dates requises');
              await savePeriode(fP);
              setFP({ date_debut: '', date_fin: '' });
              setShowPeriodeForm(false); await load(); notify('Période créée ✓');
            }} />
            </div></Modal>
          )}
          <div style={{ marginBottom: 14 }}><PrimaryBtn label="Nouvelle période" onClick={() => setShowPeriodeForm(true)} style={{ width: 'auto' }} /></div>
          <Card>
            <SectionTitle>Périodes ({periodes.length})</SectionTitle>
            {periodes.length === 0 && <div style={{ color: C.text_light, fontSize: 13 }}>Aucune période</div>}
            {periodes.map(p => (
              <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.card_border}`, padding: '10px 0' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text_primary }}>{p.date_debut} → {p.date_fin}</div>
                  <div style={{ fontSize: 11, color: p.cloturee ? C.text_light : C.success }}>{p.cloturee ? 'Clôturée' : 'Ouverte'}</div>
                </div>
                {!p.cloturee && (
                  <GhostBtn label="Clôturer" onClick={async () => { await cloturerPeriode(p._id); await load(); notify('Période clôturée'); }} />
                )}
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
