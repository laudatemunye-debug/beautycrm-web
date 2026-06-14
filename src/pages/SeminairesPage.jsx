import { useState, useEffect, useCallback } from 'react';
import { C, TYPES_EVENT, STATUTS_EVENT, STATUTS_PRESENCE } from '../theme';
import { getSeminaires, saveSeminaire, deleteSeminaire, getParticipants, saveParticipant, deleteParticipant, getClients, getProspects, today } from '../db/index';
import { Card, SearchBar, SectionTitle, PrimaryBtn, FieldInput, PickerSelect, Modal, FormFooter, Badge, Avatar, Divider, fmtDate } from '../components/UI';

const SeminaireForm = ({ seminaire, onClose, onSaved }) => {
  const [form, setForm] = useState({
    titre: seminaire?.titre || '',
    type_event: seminaire?.type_event || TYPES_EVENT[0],
    date_event: seminaire?.date_event || today(),
    heure_debut: seminaire?.heure_debut || '09:00',
    lieu: seminaire?.lieu || '',
    description: seminaire?.description || '',
    statut: seminaire?.statut || 'planifie',
    capacite_max: seminaire?.capacite_max ? String(seminaire.capacite_max) : '',
    prix_inscription: seminaire?.prix_inscription ? String(seminaire.prix_inscription) : '',
  });
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!form.titre.trim()) { alert('Titre obligatoire.'); return; }
    setLoading(true);
    try {
      await saveSeminaire({
        _id: seminaire?._id,
        ...form,
        capacite_max: form.capacite_max ? parseInt(form.capacite_max) : null,
        prix_inscription: form.prix_inscription ? parseFloat(form.prix_inscription) : null,
      });
      onSaved();
    } catch(e) { alert(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible onClose={onClose} title={seminaire ? 'Modifier evenement' : 'Nouvel evenement'}>
      <div style={{ padding: 16 }}>
        <FieldInput label="Titre *" value={form.titre} onChange={v => setForm(f=>({...f,titre:v}))} />
        <PickerSelect label="Type" value={form.type_event} onChange={v => setForm(f=>({...f,type_event:v}))} options={TYPES_EVENT} />
        <FieldInput label="Date *" value={form.date_event} onChange={v => setForm(f=>({...f,date_event:v}))} type="date" />
        <FieldInput label="Heure de debut" value={form.heure_debut} onChange={v => setForm(f=>({...f,heure_debut:v}))} type="time" />
        <FieldInput label="Lieu" value={form.lieu} onChange={v => setForm(f=>({...f,lieu:v}))} />
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><FieldInput label="Capacite max" value={form.capacite_max} onChange={v => setForm(f=>({...f,capacite_max:v}))} type="number" /></div>
          <div style={{ flex: 1 }}><FieldInput label="Prix inscription" value={form.prix_inscription} onChange={v => setForm(f=>({...f,prix_inscription:v}))} type="number" /></div>
        </div>
        <PickerSelect label="Statut" value={form.statut} onChange={v => setForm(f=>({...f,statut:v}))} options={STATUTS_EVENT} />
        <FieldInput label="Description" value={form.description} onChange={v => setForm(f=>({...f,description:v}))} multiline />
      </div>
      <FormFooter onSave={save} onClose={onClose} loading={loading} />
    </Modal>
  );
};

const ParticipantForm = ({ seminaireId, participant, clients, prospects, onClose, onSaved }) => {
  const [form, setForm] = useState({
    contact_type: participant?.client_id ? 'client' : participant?.prospect_id ? 'prospect' : 'client',
    client_id: participant?.client_id || '',
    prospect_id: participant?.prospect_id || '',
    statut_presence: participant?.statut_presence || 'inscrit',
    montant_paye: participant?.montant_paye ? String(participant.montant_paye) : '',
    notes: participant?.notes || '',
  });
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    try {
      await saveParticipant({
        _id: participant?._id,
        seminaire_id: seminaireId,
        client_id: form.contact_type === 'client' ? (clients.find(c => c.nom === form.client_id)?._id || form.client_id) : null,
        prospect_id: form.contact_type === 'prospect' ? (prospects.find(p => p.nom === form.prospect_id)?._id || form.prospect_id) : null,
        statut_presence: form.statut_presence,
        montant_paye: form.montant_paye ? parseFloat(form.montant_paye) : null,
        notes: form.notes,
      });
      onSaved();
    } catch(e) { alert(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible onClose={onClose} title="Ajouter participant">
      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: C.text_secondary, fontWeight: 600, marginBottom: 8 }}>Type de contact</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[['client','Client'],['prospect','Contact']].map(([val,label]) => (
              <div key={val} onClick={() => setForm(f=>({...f,contact_type:val}))} style={{
                flex: 1, padding: 10, borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                backgroundColor: form.contact_type === val ? C.accent+'20' : C.input_bg,
                border: `1px solid ${form.contact_type === val ? C.accent : C.input_border}`,
                fontWeight: 700, fontSize: 13,
                color: form.contact_type === val ? C.accent : C.text_secondary,
              }}>{label}</div>
            ))}
          </div>
        </div>
        {form.contact_type === 'client'
          ? <PickerSelect label="Client" value={form.client_id} onChange={v => setForm(f=>({...f,client_id:v}))} options={['', ...clients.map(c => c.nom)]} />
          : <PickerSelect label="Contact" value={form.prospect_id} onChange={v => setForm(f=>({...f,prospect_id:v}))} options={['', ...prospects.map(p => p.nom)]} />
        }
        <PickerSelect label="Statut presence" value={form.statut_presence} onChange={v => setForm(f=>({...f,statut_presence:v}))} options={STATUTS_PRESENCE} />
        <FieldInput label="Montant paye" value={form.montant_paye} onChange={v => setForm(f=>({...f,montant_paye:v}))} type="number" />
        <FieldInput label="Notes" value={form.notes} onChange={v => setForm(f=>({...f,notes:v}))} multiline />
      </div>
      <FormFooter onSave={save} onClose={onClose} loading={loading} />
    </Modal>
  );
};

const SeminaireDetail = ({ seminaire, clients, prospects, onBack, onEdit }) => {
  const [participants, setParticipants] = useState([]);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    const data = await getParticipants(seminaire._id);
    setParticipants(data);
  }, [seminaire._id]);

  useEffect(() => { load(); }, [load]);

  const getNom = (p) => {
    if (p.client_id) return clients.find(c => c._id === p.client_id)?.nom || 'Client inconnu';
    if (p.prospect_id) return prospects.find(x => x._id === p.prospect_id)?.nom || 'Contact inconnu';
    return 'Inconnu';
  };

  const getTel = (p) => {
    if (p.client_id) return clients.find(c => c._id === p.client_id)?.telephone;
    if (p.prospect_id) return prospects.find(x => x._id === p.prospect_id)?.telephone;
    return null;
  };

  const sendRappelBatch = () => {
    const avecTel = participants.filter(p => getTel(p));
    if (!avecTel.length) { alert('Aucun participant avec numero.'); return; }
    avecTel.forEach((p, i) => {
      setTimeout(() => {
        const tel = getTel(p).replace(/[\s+\-]/g, '');
        const msg = encodeURIComponent(`Bonjour ${getNom(p)},\n\nRappel : ${seminaire.titre}\nDate : ${seminaire.date_event} a ${seminaire.heure_debut}${seminaire.lieu ? '\nLieu : '+seminaire.lieu : ''}\n\nA bientot !`);
        window.open(`https://wa.me/${tel}?text=${msg}`, '_blank');
      }, i * 800);
    });
  };

  const PRESENCE_COLORS = { inscrit: C.accent, confirme: C.warning, present: C.success, absent: C.danger };
  const totalPaye = participants.reduce((s, p) => s + (p.montant_paye || 0), 0);

  return (
    <div style={{ padding: '14px', paddingBottom: 80, width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span onClick={onBack} style={{ fontSize: 24, cursor: 'pointer', color: C.text_primary }}>‹</span>
        <span style={{ fontWeight: 800, fontSize: 17, color: C.text_primary, flex: 1 }}>{seminaire.titre}</span>
        <button onClick={onEdit} style={{ backgroundColor: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontWeight: 700, cursor: 'pointer' }}>✏</button>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <Badge label={seminaire.type_event} color={C.tag_event} />
          <Badge label={seminaire.statut} color={C.success} />
        </div>
        <div style={{ fontSize: 13, color: C.text_secondary }}>📅 {fmtDate(seminaire.date_event)} · {seminaire.heure_debut}</div>
        {seminaire.lieu && <div style={{ fontSize: 13, color: C.text_secondary, marginTop: 4 }}>📍 {seminaire.lieu}</div>}
        {seminaire.description && <div style={{ fontSize: 12, color: C.text_secondary, marginTop: 8 }}>{seminaire.description}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: C.accent }}>{participants.length}</div>
            <div style={{ fontSize: 10, color: C.text_secondary }}>Participants</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: C.success }}>{totalPaye.toLocaleString()} FC</div>
            <div style={{ fontSize: 10, color: C.text_secondary }}>Total paye</div>
          </div>
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <PrimaryBtn label="+ Participant" onClick={() => setShowForm(true)} style={{ flex: 1 }} />
        <button onClick={sendRappelBatch} style={{
          flex: 1, backgroundColor: C.tag_whatsapp, color: '#fff',
          border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>📲 Rappel batch</button>
      </div>

      <SectionTitle title={`${participants.length} participant(s)`} />
      <Card>
        {participants.length === 0
          ? <div style={{ textAlign: 'center', padding: 30, color: C.text_secondary, fontSize: 13 }}>Aucun participant.</div>
          : participants.map((p, i) => (
            <div key={p._id}>
              <div style={{ display: 'flex', alignItems: 'center', padding: 12, gap: 12 }}>
                <Avatar nom={getNom(p)} size={38} color={C.tag_event} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: C.text_primary }}>{getNom(p)}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <Badge label={p.statut_presence} color={PRESENCE_COLORS[p.statut_presence] || C.accent} />
                    {p.montant_paye > 0 && <span style={{ fontSize: 11, color: C.success, fontWeight: 600 }}>{p.montant_paye.toLocaleString()} FC</span>}
                  </div>
                </div>
                <button onClick={() => deleteParticipant(p._id).then(load)} style={{ backgroundColor: C.danger, border: 'none', borderRadius: 7, width: 28, height: 28, cursor: 'pointer', color: '#fff' }}>🗑</button>
              </div>
              {i < participants.length - 1 && <Divider />}
            </div>
          ))
        }
      </Card>

      {showForm && (
        <ParticipantForm
          seminaireId={seminaire._id}
          clients={clients}
          prospects={prospects}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
};

export const SeminairesPage = () => {
  const [seminaires, setSeminaires] = useState([]);
  const [clients, setClients] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editSem, setEditSem] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, c, p] = await Promise.all([getSeminaires(), getClients(), getProspects()]);
    setSeminaires(s);
    setClients(c);
    setProspects(p);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const del = (s) => {
    if (!window.confirm(`Supprimer ${s.titre} ?`)) return;
    deleteSeminaire(s._id).then(load);
  };

  const filtered = seminaires.filter(s =>
    s.titre.toLowerCase().includes(search.toLowerCase()) ||
    (s.lieu || '').toLowerCase().includes(search.toLowerCase())
  );

  const STATUT_COLORS = { planifie: C.accent, en_cours: C.warning, termine: C.success, annule: C.danger };

  if (selected) return (
    <SeminaireDetail
      seminaire={selected}
      clients={clients}
      prospects={prospects}
      onBack={() => { setSelected(null); load(); }}
      onEdit={() => { setEditSem(selected); setShowForm(true); }}
    />
  );

  return (
    <div style={{ padding: '14px', paddingBottom: 80, width: '100%', boxSizing: 'border-box' }}>
      <SearchBar value={search} onChange={setSearch} placeholder="Rechercher un evenement..." />
      <PrimaryBtn label="+ Nouvel evenement" onClick={() => { setEditSem(null); setShowForm(true); }} style={{ marginBottom: 14 }} color={C.tag_event} />
      <SectionTitle title={`${filtered.length} evenement(s)`} />

      {loading
        ? <div style={{ textAlign: 'center', padding: 40, color: C.text_secondary }}>Chargement...</div>
        : filtered.length === 0
          ? <div style={{ textAlign: 'center', padding: 40, color: C.text_secondary, fontSize: 13 }}>Aucun evenement.</div>
          : filtered.map(s => (
            <div key={s._id} style={{ marginBottom: 10 }}>
              <Card onClick={() => setSelected(s)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.tag_event+'20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🎓</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.text_primary }}>{s.titre}</div>
                    <div style={{ fontSize: 11, color: C.text_secondary, marginTop: 2 }}>{fmtDate(s.date_event)} · {s.heure_debut}</div>
                    {s.lieu && <div style={{ fontSize: 11, color: C.text_secondary }}>📍 {s.lieu}</div>}
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <Badge label={s.type_event} color={C.tag_event} />
                      <Badge label={s.statut} color={STATUT_COLORS[s.statut] || C.accent} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={e => { e.stopPropagation(); setEditSem(s); setShowForm(true); }} style={{ backgroundColor: C.accent, border: 'none', borderRadius: 7, width: 28, height: 28, cursor: 'pointer', color: '#fff' }}>✏</button>
                    <button onClick={e => { e.stopPropagation(); del(s); }} style={{ backgroundColor: C.danger, border: 'none', borderRadius: 7, width: 28, height: 28, cursor: 'pointer', color: '#fff' }}>🗑</button>
                  </div>
                </div>
              </Card>
            </div>
          ))
      }

      {showForm && (
        <SeminaireForm
          seminaire={editSem}
          onClose={() => { setShowForm(false); setEditSem(null); }}
          onSaved={() => { setShowForm(false); setEditSem(null); load(); }}
        />
      )}
    </div>
  );
};
