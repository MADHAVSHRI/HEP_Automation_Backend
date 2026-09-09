# face_verify — issues the one-time capture links and receives the photographs.
FROM node:20-alpine

WORKDIR /app

# sharp ships prebuilt binaries for alpine; this keeps them working.
RUN apk add --no-cache vips-dev >/dev/null 2>&1 || true

# Dependencies first, so a source change does not re-install them.
COPY package*.json ./
# sequelize-cli is a devDependency and is needed to run migrations in the
# container, so devDependencies are kept rather than pruned.
RUN npm ci

COPY . .

# Photographs are written here. Declared so the data survives a container
# rebuild — without a volume mounted over it, every redeploy loses the
# buffered captures that applicants have already sent.
RUN mkdir -p uploads/liveCaptures logs
VOLUME ["/app/uploads"]

EXPOSE 5011

# Fails the container rather than sitting there accepting traffic it cannot serve.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:5011/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["npm", "start"]
