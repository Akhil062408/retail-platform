FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY app ./app
COPY tests ./tests

RUN addgroup -S appgroup && \
    adduser -S appuser -G appgroup

ENV PORT=8081
ENV VERSION=4.2.0
ENV HEALTH_STATUS=UP

EXPOSE 8081

USER appuser

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -q -O - http://127.0.0.1:8081/health || exit 1

CMD ["node", "app/server.js"]