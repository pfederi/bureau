FROM node:22-alpine
WORKDIR /app

# Next.js' SWC binary needs libc6-compat on Alpine
RUN apk add --no-cache libc6-compat

# Keep npm quiet + skip end-of-install extras.
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NO_UPDATE_NOTIFIER=1 \
    CI=true

# npm 10.8.2 (bundled with node:20) crashes here with "Exit handler never called".
# node:22 + npm 11 avoids that buggy version.
RUN npm install -g npm@11

# Install dependencies (force devDependencies — they are required to build,
# even if NODE_ENV=production is set in the environment)
COPY package*.json .npmrc ./
RUN npm ci --include=dev --no-audit --no-fund

# App source
COPY . .

# NEXT_PUBLIC_* must be present at BUILD time (they get baked into the client
# bundle). Coolify passes env vars as build args; declare and promote them.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN npm run build

EXPOSE 3000
ENV PORT=3000
CMD ["npm", "start"]
