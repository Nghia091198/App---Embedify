# Vite build + preview
# Express auth / webhook / proxy chạy trong vite preview (vite.config.ts middleware)
# Không dùng nginx static — cần vite preview để mount Express handlers

FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Không `npm i @rollup/rollup-linux-*@latest` — lệch phiên bản với rollup trong lockfile có thể làm bundle JS ~vài trăm byte (chỉ polyfill).
RUN npm ci

FROM node:20-bookworm-slim AS build
WORKDIR /app
# VPS RAM thấp — tránh minify/Rollup bị OOM giữa chừng (file JS chỉ vài trăm byte).
ENV NODE_OPTIONS=--max-old-space-size=4096
COPY --from=deps /app/node_modules ./node_modules
# Không dùng `COPY . .` — tránh host ghi đè node_modules (bundle ~711B) kể cả .dockerignore sai tên/SFTP.
COPY package.json package-lock.json ./
COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY postcss.config.js tailwind.config.js ./
COPY src ./src
COPY public ./public
RUN rm -rf dist node_modules/.vite && \
    node_modules/.bin/vite build && \
    sed -i '/src="\/src\/app\/index\.tsx"/d' dist/index.html
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Preview cần vite + plugin + toàn bộ src/ (Express handlers trong vite.config.ts)
COPY --from=build /app/node_modules    ./node_modules
COPY --from=build /app/package.json    ./
COPY --from=build /app/package-lock.json ./
COPY --from=build /app/dist            ./dist
COPY --from=build /app/index.html      ./
COPY --from=build /app/vite.config.ts  ./
COPY --from=build /app/tsconfig.json   ./
COPY --from=build /app/tsconfig.node.json ./
COPY --from=build /app/tsconfig.app.json  ./
COPY --from=build /app/src             ./src

EXPOSE 8090

# tsx lets Node resolve dynamic imports of ./src/**/*.ts from vite.config.ts during preview
CMD ["node", "--import", "tsx/esm", "./node_modules/.bin/vite", "preview", "--host", "0.0.0.0", "--port", "8090"]
