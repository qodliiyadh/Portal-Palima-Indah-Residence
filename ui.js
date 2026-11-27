const isStaff = () => ['admin', 'pengurus'].includes(S.profile?.role);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const jsArg = value => esc(JSON.stringify(String(value ?? '')));
const imageSrc = value => /^data:image\/(png|jpeg|webp|gif);base64,[a-z\d+/=]+$/i.test(value || '') ? value : '';
function openCctv() {
  try {
    const url = new URL(S.settings.cctv_url);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error();
    window.open(url.href, '_blank', 'noopener,noreferrer');
  } catch { toast('URL CCTV harus berupa alamat HTTP atau HTTPS yang valid.', 'error'); }
}
function broadcastAnnouncement(id) {
  const a = DDB.announcements.find(record => record.id === id);
  if (isStaff() && a) broadcastWA(a.title, a.content);
}
