(() => {
  const render = renderPage;
  let cleanup;
  renderPage = () => {
    cleanup?.(); cleanup = undefined;
    render();
    const today = $('#dashboardPrayer');
    const setting = $('#prayerGeneral');
    if (today) cleanup = mountPrayer(today, {location:S.settings.prayer_location || {}});
    if (setting && S.profile?.role === 'admin') cleanup = mountPrayer(setting, {
      location:S.settings.prayer_location || {},
      onSave:async location => {
        await saveSetting('prayer_location',location);
        if (S.page === 'settings' && S.profile?.role === 'admin') renderPage();
      }
    });
  };
  window.publicPrayerLocation = async () => {
    if (DEMO || S.profile) return S.settings.prayer_location || {};
    const {supabaseUrl,supabaseAnonKey} = window.PALIMA_CONFIG;
    const res = await fetch(`${supabaseUrl.trim().replace(/\/$/,'')}/rest/v1/rpc/portal_prayer_location`, {
      method:'POST',headers:{apikey:supabaseAnonKey.trim(),'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(6000)
    });
    if (!res.ok) throw new Error('Lokasi portal gagal dimuat');
    return (await res.json()) || {};
  };
})();
