# Mehrstufiger Build: Abhängigkeiten → Build → schlankes Laufzeit-Image (Next.js «standalone»).
# Das laufende Image enthält nur den Server, die gebauten Dateien, public/ und docs/ (Anleitung,
# Release Notes werden zur Laufzeit gelesen) – keine Entwicklungs-Pakete.

FROM node:22-alpine AS deps
# Next.js' SWC binary needs libc6-compat on Alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NO_UPDATE_NOTIFIER=1 \
    CI=true
# npm 10.8.2 crashes with "Exit handler never called"; npm 11 avoids that buggy version.
RUN npm install -g npm@11
# devDependencies are required to build, even if NODE_ENV=production is set in the environment
COPY package*.json .npmrc ./
RUN npm ci --include=dev --no-audit --no-fund

FROM node:22-alpine AS build
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* must be present at BUILD time (they get baked into the client bundle).
# Coolify and the GitHub workflow pass them as build args.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_TELEMETRY_DISABLED=1
# Speicher des Builds begrenzen: bricht lieber der Build ab, als dass ein knapper Server hängen bleibt
ARG BUILD_MAX_OLD_SPACE=3072
ENV NODE_OPTIONS=--max-old-space-size=${BUILD_MAX_OLD_SPACE}
RUN npm run build

FROM node:22-alpine AS run
# curl für den Healthcheck von Coolify: es fällt bei «localhost» auf IPv4 zurück (busybox-wget nimmt nur ::1,
# der Server hört aber auf 0.0.0.0)
RUN apk add --no-cache libc6-compat curl
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/docs ./docs
USER node
EXPOSE 3000
CMD ["node", "server.js"]
