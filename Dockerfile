# Ajarka Studio - image produksi (studio.ajarka.com).
#   docker build --network host -t ajarka/ajarka-studio:latest .
#   docker run -d -p 127.0.0.1:8190:8080 ajarka/ajarka-studio:latest
#
# Tahap 1 mengunduh @scratch/scratch-gui versi terkunci (sha512 diverifikasi) dan menyusun build/.
# Tahap 2 menyajikannya dengan nginx (lihat deploy/default.conf.template).

FROM node:22-alpine AS build
RUN apk add --no-cache tar
WORKDIR /src
COPY scratch.lock.json ./
COPY scripts ./scripts
COPY src ./src
# Origin halaman induk yang boleh mengendalikan Studio lewat postMessage (TANPA localhost di produksi).
ARG STUDIO_PARENT_ORIGINS=https://ajarka.com,https://www.ajarka.com
RUN STUDIO_PARENT_ORIGINS="$STUDIO_PARENT_ORIGINS" STUDIO_PRECOMPRESS=1 node scripts/build.mjs

FROM nginx:1.27-alpine
# Origin yang boleh menyematkan Studio sebagai iframe (CSP frame-ancestors, dipisah spasi).
ENV STUDIO_FRAME_ANCESTORS="https://ajarka.com https://www.ajarka.com"
RUN rm -f /etc/nginx/conf.d/default.conf
COPY deploy/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /src/build /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/versi.json >/dev/null || exit 1
