const TRACKER_URL = 'https://script.google.com/macros/s/AKfycbwpS9OyXZ9tl3eSsDUec-t9bM7Jk6kdHjcUM-huILQD395nMIKowDSswzySESMkGOKmQw/exec';

export const trackUser = async (data) => {
  if (!navigator.onLine) return;
  try {
    const form = new FormData();
    Object.entries({ ...data, version: '2.1' }).forEach(([k, v]) => form.append(k, v || ''));
    await fetch(TRACKER_URL, { method: 'POST', mode: 'no-cors', body: form });
  } catch(_) {}
};
