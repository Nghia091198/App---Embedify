# Vite build + preview
# Express auth / webhook / proxy chạy trong vite preview (vite.config.ts middleware)
# Không dùng nginx static — cần vite preview để mount Express handlers

FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci && \
  case "$(uname -m)" in \
    x86_64)   npm install --no-save @rollup/rollup-linux-x64-gnu ;; \
    aarch64)  npm install --no-save @rollup/rollup-linux-arm64-gnu ;; \
    armv7l)   npm install --no-save @rollup/rollup-linux-arm-gnueabihf ;; \
    *) echo "Unsupported arch: $(uname -m)" >&2; exit 1 ;; \
  esac

FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

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
COPY --from=build /app/src             ./src

EXPOSE 8080
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "8080"]
