# Jadwal Sholat Kemenag

The widget reads Bimas Islam Kemenag’s public SIHAT endpoints used by the [official prayer page](https://bimasislam.kemenag.go.id/jadwal-sholat): `GET /api/sihat/provinsi`, `GET /api/sihat/kabko?prov=…`, and `GET /api/sihat/jadwal?prov=…&kabko=…&thn=YYYY&bln=MM`. Province and city IDs are opaque and fetched from the listings. All displayed times come from the official response; no calculated or demo times are substituted. Kecamatan Curug is context only: SIHAT serves Kota Serang, not a district-specific schedule.

## Deploy

The official responses did not return `Access-Control-Allow-Origin` for a cross-origin request. Deploy the read-only Supabase relay from the `palima-indah` directory to an existing project:

```sh
supabase functions deploy kemenag-prayer --project-ref YOUR_PROJECT_REF --no-verify-jwt
```

This function intentionally serves public data without credentials, with no database or secrets. It accepts only three actions and validated parameters, forwards only to fixed Kemenag paths, and rejects redirects. For high-traffic deployments, consider gateway rate limiting to protect the upstream service.

## Mount

Load `config.js` and `prayer.js` before the view code. With `PALIMA_CONFIG.supabaseUrl` set, the widget uses `<supabaseUrl>/functions/v1/kemenag-prayer`. For a separate edge deployment or a same-origin relay, set `window.PALIMA_PRAYER_ENDPOINT` to the relay URL before mounting.

```html
<div id="prayer"></div>
<script src="config.js"></script>
<script src="prayer.js"></script>
<script>
  const unmountPrayer = window.mountPrayer(document.getElementById('prayer'));
</script>
```

Call `unmountPrayer()` when leaving a dynamically rendered view to abort pending requests. Mounting replaces the container’s contents. The panel hooks are `.prayer-panel`, `.prayer-filters`, `.prayer-grid`, `.prayer-item`, and `.prayer-status`. Without a configured relay, the panel still links to the official schedule.

After deploying, check `/functions/v1/kemenag-prayer?action=provinsi` for a JSON region list. Open the widget and verify default Banten → Kota Serang, today’s date (WIB), and change the province, month, and date to confirm other official schedules load. An unavailable month should display a message and no times.
