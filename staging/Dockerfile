FROM node:20-slim AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build

COPY . .
ARG VITE_STRIPE_PUBLISHABLE_KEY
ARG VITE_APP_ID=staging
ARG VITE_KIMI_AUTH_URL=https://unused.example.com
ENV VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY
ENV VITE_APP_ID=$VITE_APP_ID
ENV VITE_KIMI_AUTH_URL=$VITE_KIMI_AUTH_URL
RUN npm run check && npm run lint && npm run test && npm run build

FROM dependencies AS migration

COPY . .
CMD ["node", "staging/guarded-db-push.mjs"]

FROM node:20-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY staging/run-app.mjs ./staging/run-app.mjs

USER node
EXPOSE 3000
CMD ["node", "staging/run-app.mjs"]
