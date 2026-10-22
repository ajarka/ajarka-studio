#!/bin/sh
# Isi template nginx dari env (hanya STUDIO_FRAME_ANCESTORS; variabel nginx seperti $uri tidak tersentuh),
# uji konfigurasi, lalu jalankan nginx di foreground.
set -eu
: "${STUDIO_FRAME_ANCESTORS:?STUDIO_FRAME_ANCESTORS wajib diisi}"
envsubst '${STUDIO_FRAME_ANCESTORS}' < /etc/nginx/studio.conf.template > /etc/nginx/http.d/default.conf
nginx -t -q
exec nginx -g 'daemon off;'
