# The frontend is built in a throwaway stage so its dev dependencies (Vite and
# friends) never reach the runtime image — only the compiled dist/ does.
FROM node:22-bookworm-slim AS web-build
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# better-sqlite3 ships a prebuilt binary for node 22 on linux/amd64, so this
# install needs no compiler. --omit=dev keeps the image to runtime deps only.
COPY server/package.json server/package-lock.json ./server/
RUN npm --prefix server ci --omit=dev && npm cache clean --force

COPY server/ ./server/
COPY --from=web-build /app/web/dist ./web/dist

# The database lives on a mounted volume; this is only the fallback mountpoint
# so a run without a volume still starts instead of crashing.
RUN mkdir -p /data
ENV DATA_DIR=/data

# Railway injects PORT, but keep a sane default for `docker run` locally.
ENV PORT=4000
EXPOSE 4000

# Runs as root on purpose: Railway mounts the volume at /data owned by root
# after the image is built, so a chown here would not survive and an
# unprivileged user could not write the database.

CMD ["npm", "--prefix", "server", "start"]
