import { useState, useEffect, useCallback } from 'react';
import { C, CANAUX, STATUTS_RDV } from '../theme';
import { getProspects, saveProspect, deleteProspect, getRdvs, saveRdv, deleteRdv, today } from '../db/index';
import { Card, SearchBar, SectionTitle, PrimaryBtn, GhostBtn, FieldInput, PickerSelect, Modal, FormFooter, Avatar, Badge, Divider, fmtDate } from '../components/UI';

const ProspectForm = ({ prospect, onClose, onSaved }) => {
  const [form, setForm] = useState({
    nom: prospect?.nom || '',
    telephone: prospect?.telephone || '',
    email: prospect?.email || '',
    canal: prospect?.canal || CANAUX[0],
    pays: prospect?.pays || '',
    ville: prospect?.ville || '',
    notes: prospect?.notes || '',
    statut: prospect?.statut || 'prospect',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setError('');
    if (!form.nom.trim()) { setError('Le nom est obligatoire.'); return; }
    setLoading(true);
    try {
      const all = await getProspects();
      if (!prospect) {
        const dupNom = all.find(p => p.nom.toLowerCase() === form.nom.toLowerCase().trim());
        if (dupNom) { setError('Un contact avec ce nom existe deja.'); setLoading(false); return; }
        if (form.telephone) {
          const dupTel = all.find(p => p.telephone === form.telephone.trim());
          if (dupTel) { setError('Un contact avec ce numero existe deja.'); setLoading(false); return; }
        }
      }
      await saveProspect({ ...form, _id: prospect?._id });
      onSaved();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible onClose={onClose} title={prospect ? 'Modifier contact' : 'Nouveau contact'}>
      <div style={{ padding: 16 }}>
        {error && <div style={{ color: C.danger, backgroundColor: C.danger+'15', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 14 }}>
          <div style={{ flex: 1, marginBottom: 0 }}><FieldInput label="Nom *" value={form.nom} onChange={v => setForm(f=>({...f,nom:v}))} /></div>
          <>
            <input id="csv-import" type="file" accept=".csv,text/csv,.vcf,text/vcard" style={{ display:'none' }} onChange={async e => {
              const file = e.target.files?.[0]; if (!file) return;
              e.target.value = '';
              const text = await file.text();
              if (file.name.endsWith('.vcf') || text.startsWith('BEGIN:VCARD')) {
                const nom = (text.match(/FN:(.+)/)?.[1] || '').trim();
                const tel = (text.match(/TEL[^:]*:(.+)/)?.[1] || '').trim();
                const email = (text.match(/EMAIL[^:]*:(.+)/)?.[1] || '').trim();
                if (nom || tel) setForm(f => ({ ...f, nom: nom||f.nom, telephone: tel||f.telephone, email: email||f.email }));
                else alert('Aucune donnée trouvée dans ce fichier VCF.');
                return;
              }
              const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
              if (lines.length < 2) { alert('CSV vide ou invalide.'); return; }
              const headers = lines[0].split(',').map(h => h.toLowerCase().trim());
              const vals = lines[1].split(',').map(v => v.replace(/^"|"$/g,'').trim());
              const get = (...keys) => { for (const k of keys) { const i = headers.findIndex(h => h.includes(k)); if (i>=0 && vals[i]) return vals[i]; } return ''; };
              const nom = get('nom','name','prenom');
              const tel = get('tel','phone','mobile','portable');
              const email = get('email','mail','courriel');
              if (nom || tel) setForm(f => ({ ...f, nom: nom||f.nom, telephone: tel||f.telephone, email: email||f.email }));
              else alert('Colonnes non reconnues. Utilisez des entêtes : nom, telephone, email');
            }} />
            <button type="button" onClick={async () => {
              if ("contacts" in navigator) {
                try {
                  const PAYS_CODES = { "+243": "RDC", "+242": "Congo Brazzaville", "+237": "Cameroun", "+225": "Cote d Ivoire", "+221": "Senegal", "+33": "France", "+32": "Belgique", "+41": "Suisse", "+1": "USA", "+44": "Royaume-Uni", "+27": "Afrique du Sud", "+250": "Rwanda", "+257": "Burundi", "+256": "Ouganda", "+255": "Tanzanie", "+254": "Kenya", "+212": "Maroc", "+216": "Tunisie", "+213": "Algerie" };
                  const cts = await navigator.contacts.select(["name","tel","email"], { multiple: false });
                  if (cts.length > 0) {
                    const ct = cts[0];
                    const tel = ct.tel?.[0] || "";
                    const telClean = tel.replace(/[\s\-]/g, "");
                    let paysDetecte = "";
                    for (const code of Object.keys(PAYS_CODES).sort((a,b) => b.length - a.length)) {
                      if (telClean.startsWith(code)) { paysDetecte = PAYS_CODES[code]; break; }
                    }
                    setForm(f => ({ ...f, nom: ct.name?.[0]||f.nom, telephone: tel, email: ct.email?.[0]||f.email, pays: paysDetecte||f.pays }));
                  }
                } catch(err) { alert("Erreur : " + err.message); }
              } else {
                document.getElementById('csv-import').click();
              }
            }}
              title="Importer un contact"
              style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#3D5AFE", border: "none", cursor: "pointer", fontSize: 18, color: "#fff", flexShrink: 0, marginBottom: 14 }}>👤</button>
          </>
        </div>
        <FieldInput label="Telephone (WhatsApp)" value={form.telephone} onChange={v => setForm(f=>({...f,telephone:v}))} type="tel" />
        <FieldInput label="Email" value={form.email} onChange={v => setForm(f=>({...f,email:v}))} type="email" />
        <PickerSelect label="Canal" value={form.canal} onChange={v => setForm(f=>({...f,canal:v}))} options={CANAUX} />
        <FieldInput label="Pays" value={form.pays} onChange={v => setForm(f=>({...f,pays:v}))} placeholder="Ex: RDC, Cameroun..." />
        <FieldInput label="Ville / Quartier" value={form.ville} onChange={v => setForm(f=>({...f,ville:v}))} />
        <FieldInput label="Notes" value={form.notes} onChange={v => setForm(f=>({...f,notes:v}))} multiline />
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: C.text_secondary, fontWeight: 600, marginBottom: 8 }}>Statut</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[['prospect','Prospect',C.tag_prospect],['partenaire','Partenaire',C.success]].map(([val,label,color]) => (
              <div key={val} onClick={() => setForm(f=>({...f,statut:val}))} style={{
                flex: 1, padding: 12, borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                backgroundColor: form.statut === val ? color+'20' : C.input_bg,
                border: `1px solid ${form.statut === val ? color : C.input_border}`,
                fontWeight: 700, fontSize: 13,
                color: form.statut === val ? color : C.text_secondary,
              }}>{label}</div>
            ))}
          </div>
        </div>
      </div>
      <FormFooter onSave={save} onClose={onClose} loading={loading} />
    </Modal>
  );
};

const RdvForm = ({ prospect, rdv, onClose, onSaved }) => {
  const [form, setForm] = useState({
    date_rdv: rdv?.date_rdv || today(),
    heure_rdv: rdv?.heure_rdv || '09:00',
    lieu: rdv?.lieu || '',
    objet: rdv?.objet || '',
    notes: rdv?.notes || '',
    statut: rdv?.statut || 'planifie',
  });
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    try {
      await saveRdv({ ...form, prospect_id: prospect._id, _id: rdv?._id });
      onSaved();
    } catch(e) { alert(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible onClose={onClose} title={rdv ? 'Modifier RDV' : 'Nouveau RDV'}>
      <div style={{ padding: 16 }}>
        <FieldInput label="Objet" value={form.objet} onChange={v => setForm(f=>({...f,objet:v}))} />
        <FieldInput label="Date *" value={form.date_rdv} onChange={v => setForm(f=>({...f,date_rdv:v}))} type="date" />
        <FieldInput label="Heure *" value={form.heure_rdv} onChange={v => setForm(f=>({...f,heure_rdv:v}))} type="time" />
        <FieldInput label="Lieu" value={form.lieu} onChange={v => setForm(f=>({...f,lieu:v}))} />
        <PickerSelect label="Statut" value={form.statut} onChange={v => setForm(f=>({...f,statut:v}))} options={STATUTS_RDV} />
        <FieldInput label="Notes" value={form.notes} onChange={v => setForm(f=>({...f,notes:v}))} multiline />
      </div>
      <FormFooter onSave={save} onClose={onClose} loading={loading} />
    </Modal>
  );
};

const ContactDetail = ({ prospect, onBack, onEdit }) => {
  const [rdvs, setRdvs] = useState([]);
  const [showRdv, setShowRdv] = useState(false);
  const [editRdv, setEditRdv] = useState(null);

  const load = useCallback(async () => {
    const all = await getRdvs();
    setRdvs(all.filter(r => r.prospect_id === prospect._id));
  }, [prospect._id]);

  useEffect(() => { load(); }, [load]);

  const delRdv = (id) => {
    if (!window.confirm('Supprimer ce RDV ?')) return;
    deleteRdv(id).then(load);
  };

  const sendWhatsApp = () => {
    if (!prospect.telephone) return;
    const tel = prospect.telephone.replace(/[\s+\-]/g, '');
    const msg = encodeURIComponent(`Bonjour ${prospect.nom},\n\nJe vous contacte suite a notre echange.\n\nCordialement`);
    window.open(`https://wa.me/${tel}?text=${msg}`, '_blank');
  };

  const sendRappelRdv = (rdv) => {
    if (!prospect.telephone) return;
    const tel = prospect.telephone.replace(/[\s+\-]/g, '');
    const msg = encodeURIComponent(`Bonjour ${prospect.nom},\n\nRappel RDV :\nDate : ${rdv.date_rdv}\nHeure : ${rdv.heure_rdv}${rdv.lieu ? '\nLieu : '+rdv.lieu : ''}\n\nA bientot !`);
    window.open(`https://wa.me/${tel}?text=${msg}`, '_blank');
  };

  return (
    <div style={{ padding: '14px', paddingBottom: 80, width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span onClick={onBack} style={{ fontSize: 24, cursor: 'pointer', color: C.text_primary }}>‹</span>
        <span style={{ fontWeight: 800, fontSize: 18, color: C.text_primary, flex: 1 }}>{prospect.nom}</span>
        <button onClick={onEdit} style={{ backgroundColor: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontWeight: 700, cursor: 'pointer' }}>✏</button>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 4 }}>
          <Avatar nom={prospect.nom} size={52} color={C.tag_prospect} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: C.text_primary }}>{prospect.nom}</div>
            {prospect.telephone && <div style={{ fontSize: 13, color: C.text_secondary, marginTop: 2 }}>📱 {prospect.telephone}</div>}
            {prospect.email && <div style={{ fontSize: 13, color: C.text_secondary, marginTop: 2 }}>✉️ {prospect.email}</div>}
            {prospect.pays && <div style={{ fontSize: 13, color: C.text_secondary, marginTop: 2 }}>🌍 {prospect.pays}{prospect.ville ? ` · ${prospect.ville}` : ''}</div>}
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <Badge label={prospect.canal} color={C.accent} />
              <Badge label={prospect.statut || 'prospect'} color={prospect.statut === 'partenaire' ? C.success : C.tag_prospect} />
            </div>
          </div>
        </div>
        {prospect.telephone && (
          <button onClick={sendWhatsApp} style={{
            marginTop: 12, width: '100%', backgroundColor: C.tag_whatsapp,
            color: '#fff', border: 'none', borderRadius: 10, padding: '10px 0',
            fontWeight: 700, cursor: 'pointer', fontSize: 13,
          }}>💬 Contacter sur WhatsApp</button>
        )}
      </Card>

      <PrimaryBtn label="+ Nouveau RDV" onClick={() => { setEditRdv(null); setShowRdv(true); }} style={{ marginBottom: 14 }} color={C.warning} />

      <SectionTitle title={`${rdvs.length} RDV`} />
      <Card>
        {rdvs.length === 0
          ? <div style={{ textAlign: 'center', padding: 30, color: C.text_secondary, fontSize: 13 }}>Aucun RDV planifie.</div>
          : rdvs.map((r, i) => (
            <div key={r._id}>
              <div style={{ display: 'flex', alignItems: 'center', padding: 12, gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: C.warning+'20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📅</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: C.text_primary }}>{r.objet || 'RDV'}</div>
                  <div style={{ fontSize: 11, color: C.text_secondary, marginTop: 2 }}>{fmtDate(r.date_rdv)} · {r.heure_rdv}</div>
                  {r.lieu && <div style={{ fontSize: 11, color: C.text_secondary }}>📍 {r.lieu}</div>}
                  <div style={{ marginTop: 4 }}><Badge label={r.statut} color={C.warning} /></div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {prospect.telephone && <button onClick={() => sendRappelRdv(r)} style={{ backgroundColor: C.tag_whatsapp, border: 'none', borderRadius: 7, width: 28, height: 28, cursor: 'pointer', color: '#fff', fontSize: 12 }}>📲</button>}
                  <button onClick={() => { setEditRdv(r); setShowRdv(true); }} style={{ backgroundColor: C.accent, border: 'none', borderRadius: 7, width: 28, height: 28, cursor: 'pointer', color: '#fff' }}>✏</button>
                  <button onClick={() => delRdv(r._id)} style={{ backgroundColor: C.danger, border: 'none', borderRadius: 7, width: 28, height: 28, cursor: 'pointer', color: '#fff' }}>🗑</button>
                </div>
              </div>
              {i < rdvs.length - 1 && <Divider />}
            </div>
          ))
        }
      </Card>

      {showRdv && (
        <RdvForm
          prospect={prospect}
          rdv={editRdv}
          onClose={() => { setShowRdv(false); setEditRdv(null); }}
          onSaved={() => { setShowRdv(false); setEditRdv(null); load(); }}
        />
      )}
    </div>
  );
};

export const ContactsPage = () => {
  const [prospects, setProspects] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProspect, setEditProspect] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getProspects();
    setProspects(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const del = (p) => {
    if (!window.confirm(`Supprimer ${p.nom} ?`)) return;
    deleteProspect(p._id).then(load);
  };

  const filtered = prospects.filter(p =>
    p.nom.toLowerCase().includes(search.toLowerCase()) ||
    (p.telephone || '').includes(search) ||
    (p.pays || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.ville || '').toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce((acc, p) => {
    const pays = p.pays || 'Sans pays';
    const ville = p.ville || 'Sans ville';
    if (!acc[pays]) acc[pays] = {};
    if (!acc[pays][ville]) acc[pays][ville] = [];
    acc[pays][ville].push(p);
    return acc;
  }, {});
  const paysList = Object.keys(grouped).sort();

  if (selected) return (
    <ContactDetail
      prospect={selected}
      onBack={() => { setSelected(null); load(); }}
      onEdit={() => { setEditProspect(selected); setShowForm(true); }}
    />
  );

  return (
    <div style={{ padding: '14px', paddingBottom: 80, width: '100%', boxSizing: 'border-box' }}>
      <SearchBar value={search} onChange={setSearch} placeholder="Chercher un contact..." />
      <PrimaryBtn label="+ Nouveau contact" onClick={() => { setEditProspect(null); setShowForm(true); }} style={{ marginBottom: 14 }} />
      <SectionTitle title={`${filtered.length} contact(s)`} />

      {loading
        ? <div style={{ textAlign: 'center', padding: 40, color: C.text_secondary }}>Chargement...</div>
        : filtered.length === 0
          ? <div style={{ textAlign: 'center', padding: 40, color: C.text_secondary, fontSize: 13 }}>Aucun contact.</div>
          : paysList.map(pays => (
            <div key={pays} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 16 }}>🌍</span>
                <span style={{ fontWeight: 800, fontSize: 15, color: C.text_primary }}>{pays}</span>
                <span style={{ fontSize: 12, color: C.text_secondary }}>({Object.values(grouped[pays]).flat().length})</span>
              </div>
              {Object.keys(grouped[pays]).sort().map(ville => (
                <div key={ville} style={{ marginBottom: 12, paddingLeft: 8 }}>
                  <div style={{ fontSize: 12, color: C.text_secondary, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>📍</span>{ville} <span style={{ color: C.text_light }}>({grouped[pays][ville].length})</span>
                  </div>
                  {grouped[pays][ville].map(p => (
                    <div key={p._id} style={{ marginBottom: 8 }}>
                      <Card onClick={() => setSelected(p)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <Avatar nom={p.nom} size={44} color={C.tag_prospect} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: C.text_primary }}>{p.nom}</div>
                            <div style={{ fontSize: 11, color: C.text_secondary, marginTop: 2 }}>{p.telephone || 'Pas de numero'}</div>
                            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                              <Badge label={p.canal} color={C.accent} />
                              <Badge label={p.statut || 'prospect'} color={p.statut === 'partenaire' ? C.success : C.tag_prospect} />
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={e => { e.stopPropagation(); setEditProspect(p); setShowForm(true); }} style={{ backgroundColor: C.accent, border: 'none', borderRadius: 7, width: 28, height: 28, cursor: 'pointer', color: '#fff' }}>✏</button>
                            <button onClick={e => { e.stopPropagation(); del(p); }} style={{ backgroundColor: C.danger, border: 'none', borderRadius: 7, width: 28, height: 28, cursor: 'pointer', color: '#fff' }}>🗑</button>
                          </div>
                        </div>
                      </Card>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))
      }

      {showForm && (
        <ProspectForm
          prospect={editProspect}
          onClose={() => { setShowForm(false); setEditProspect(null); }}
          onSaved={() => { setShowForm(false); setEditProspect(null); load(); }}
        />
      )}
    </div>
  );
};
