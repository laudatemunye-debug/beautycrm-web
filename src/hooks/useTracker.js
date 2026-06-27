const TRACKER_URL = 'https://script.google.com/macros/s/AKfycbwpS9OyXZ9tl3eSsDUec-t9bM7Jk6kdHjcUM-huILQD395nMIKowDSswzySESMkGOKmQw/exec';
const IZI360_URL = 'http://localhost:5000/api/beautycrm/register';
const IZI360_SECRET = 'beautycrm_izi360_2026';

export const trackUser = async (data) => {
  if (!navigator.onLine) return;

  // Envoi vers Google Sheets (existant)
  try {
    const form = new FormData();
    Object.entries({ ...data, version: '2.1' }).forEach(([k, v]) => form.append(k, v || ''));
    await fetch(TRACKER_URL, { method: 'POST', mode: 'no-cors', body: form });
  } catch(_) {}

  // Envoi vers IZI360 (nouveau)
  console.log('IZI360 tracker appelé avec:', data);
  try {
    await fetch(IZI360_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: IZI360_SECRET,
        nom: data.nom || '',
        email: data.email || '',
        telephone: data.telephone || data.phone || '',
        pays: data.pays || data.country || '',
        ville: data.ville || data.city || '',
        entreprise: data.entreprise || data.company || '',
        role: data.role || '',
        devise: data.devise || data.currency || '',
        version: '2.1',
        plateforme: 'web'
      })
    });
  } catch(_) {}
};
