# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# OpenCode only accepts the identifiers it knows: we extract them from OpenCode
# itself, so the site cannot publish a command that would not run. The keys are
# dummies and only make it list the providers: no call is made to any model.
FROM node:22-alpine AS opencode
RUN npm install -g opencode-ai@1.18.32
ENV DEEPINFRA_API_KEY=x OPENROUTER_API_KEY=x ANTHROPIC_API_KEY=x OPENAI_API_KEY=x \
    GEMINI_API_KEY=x GROQ_API_KEY=x MISTRAL_API_KEY=x TOGETHER_API_KEY=x \
    FIREWORKS_API_KEY=x CEREBRAS_API_KEY=x DEEPSEEK_API_KEY=x MOONSHOT_API_KEY=x \
    ZHIPU_API_KEY=x MINIMAX_API_KEY=x XAI_API_KEY=x NOVITA_API_KEY=x \
    BASETEN_API_KEY=x NEBIUS_API_KEY=x HUGGINGFACE_API_KEY=x VENICE_API_KEY=x
RUN mkdir -p /registry \
 && opencode models > /registry/models.txt \
 && opencode --version > /registry/version.txt \
 && test -s /registry/models.txt

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production TZ=Europe/Rome
RUN apk add --no-cache tzdata wget && addgroup -S app && adduser -S app -G app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=opencode /registry ./registry
COPY package.json ./
COPY data/curated ./data/curated
RUN mkdir -p /app/data/cache /app/data/runs && chown -R app:app /app/data
USER app
EXPOSE 8031
HEALTHCHECK --interval=60s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-8031}/health" >/dev/null || exit 1
CMD ["node", "dist/server/server.js"]
