import { useState, useEffect, useCallback } from 'react';
import { C, STATUTS_RDV } from '../theme';
import { getRdvs, saveRdv, deleteRdv, getClients, getProspects, today } from '../db/index';
import { Card, SearchBar, SectionTitle, PrimaryBtn, FieldInput, PickerSelect, Modal, FormFooter, Badge, fmtDate } from '../components/UI';

const RdvForm = ({ rdv, clients, prospects, onClose, onSaved }) => {
  const [form, setForm] = useState({
    objet: rdv?.objet || '',
    date_rdv: rdv?.date_rdv || today(),
    heure_rdv: rdv?.heure_rdv || '09:00',
    lieu: rdv?.lieu || '',
    statut: rdv?.statut || 'planifie',
    notes: rdv?.notes || '',
    contact_type: rdv?.client_id ? 'client' : 'prospect',
    client_id: rdv?.client_id || '',
    prospect_id: rdv?.prospect_id || '',
  });
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    try {
      await saveRdv({
        _id: rdv?._id,
        objet: form.objet,
        date_rdv: form.date_rdv,
        heure_rdv: form.heure_rdv,
        lieu: form.lieu,
        statut: form.statut,
        notes: form.notes,
        client_id: form.contact_type === 'client' ? form.client_id : null,
        prospect_id: form.contact_type === 'prospect' ? form.prospect_id : null,
      });
      onSaved();
    } catch(e) { alert(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible onClose={onClose} title={rdv ? 'Modifier RDV' : 'Nouveau RDV'}>
      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: C.text_secondary, fontWeight: 600, marginBottom: 8 }}>Avec</div>
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
          ? <PickerSelect label="Client" value={form.client_id} onChange={v => setForm(f=>({...f,client_id:v}))} options={['', ...clients.map(c => c._id)]} />
          : <PickerSelect label="Contact" value={form.prospect_id} onChange={v => setForm(f=>({...f,prospect_id:v}))} options={['', ...prospects.map(p => p._id)]} />
        }
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

export const RdvsPage = () => {
  const [rdvs, setRdvs] = useState([]);
  const [clients, setClients] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRdv, setEditRdv] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, c, p] = await Promise.all([getRdvs(), getClients(), getProspects()]);
    setRdvs(r);
    setClients(c);
    setProspects(p);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const getNom = (rdv) => {
    if (rdv.client_id) return clients.find(c => c._id === rdv.client_id)?.nom || 'Client inconnu';
    if (rdv.prospect_id) return prospects.find(p => p._id === rdv.prospect_id)?.nom || 'Contact inconnu';
    return 'Sans contact';
  };

  const getTel = (rdv) => {
    if (rdv.client_id) return clients.find(c => c._id === rdv.client_id)?.telephone;
    if (rdv.prospect_id) return prospects.find(p => p._id === rdv.prospect_id)?.telephone;
    return null;
  };

  const sendRappel = (rdv) => {
    const tel = getTel(rdv);
    if (!tel) { alert('Aucun numero.'); return; }
    const num = tel.replace(/[\s+\-]/g, '');
    const msg = encodeURIComponent(`Bonjour ${getNom(rdv)},\n\nRappel de notre RDV :\nDate : ${rdv.date_rdv}\nHeure : ${rdv.heure_rdv}${rdv.lieu ? '\nLieu : '+rdv.lieu : ''}\n\nA bientot !`);
    window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
  };

  const del = (id) => {
    if (!window.confirm('Supprimer ce RDV ?')) return;
    deleteRdv(id).then(load);
  };

  const STATUT_COLORS = {
    planifie: C.accent,
    confirme: C.success,
    effectue: C.text_secondary,
    annule: C.danger,
  };

  const filtered = rdvs.filter(r =>
    getNom(r).toLowerCase().includes(search.toLowerCase()) ||
    (r.objet || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '14px', paddingBottom: 80, width: '100%', boxSizing: 'border-box' }}>
      <SearchBar value={search} onChange={setSearch} placeholder="Chercher un RDV..." />
      <PrimaryBtn label="+ Nouveau RDV" onClick={() => { setEditRdv(null); setShowForm(true); }} style={{ marginBottom: 14 }} color={C.warning} />
      <SectionTitle title={`${filtered.length} RDV`} />

      {loading
        ? <div style={{ textAlign: 'center', padding: 40, color: C.text_secondary }}>Chargement...</div>
        : filtered.length === 0
          ? <div style={{ textAlign: 'center', padding: 40, color: C.text_secondary, fontSize: 13 }}>Aucun RDV.</div>
          : filtered.map(r => (
            <div key={r._id} style={{ marginBottom: 10 }}>
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 4 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    backgroundColor: C.warning+'20',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 9, color: C.warning, fontWeight: 700 }}>{r.date_rdv?.slice(8)}</span>
                    <span style={{ fontSize: 7, color: C.text_secondary }}>{r.date_rdv?.slice(5,7)}/{r.date_rdv?.slice(0,4)}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.text_primary }}>{r.objet || 'RDV'}</div>
                    <div style={{ fontSize: 11, color: C.text_secondary, marginTop: 2 }}>{getNom(r)} · {r.heure_rdv}</div>
                    {r.lieu && <div style={{ fontSize: 11, color: C.text_secondary }}>📍 {r.lieu}</div>}
                    <div style={{ marginTop: 4 }}><Badge label={r.statut} color={STATUT_COLORS[r.statut] || C.accent} /></div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button onClick={() => sendRappel(r)} style={{ backgroundColor: C.tag_whatsapp, border: 'none', borderRadius: 7, width: 28, height: 28, cursor: 'pointer', color: '#fff', fontSize: 12 }}>📲</button>
                    <button onClick={() => { setEditRdv(r); setShowForm(true); }} style={{ backgroundColor: C.accent, border: 'none', borderRadius: 7, width: 28, height: 28, cursor: 'pointer', color: '#fff' }}>✏</button>
                    <button onClick={() => del(r._id)} style={{ backgroundColor: C.danger, border: 'none', borderRadius: 7, width: 28, height: 28, cursor: 'pointer', color: '#fff' }}>🗑</button>
                  </div>
                </div>
              </Card>
            </div>
          ))
      }

      {showForm && (
        <RdvForm
          rdv={editRdv}
          clients={clients}
          prospects={prospects}
          onClose={() => { setShowForm(false); setEditRdv(null); }}
          onSaved={() => { setShowForm(false); setEditRdv(null); load(); }}
        />
      )}
    </div>
  );
};
