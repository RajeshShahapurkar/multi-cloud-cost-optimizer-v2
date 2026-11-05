FROM node:22-alpine

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

COPY frontend/package.json ./package.json
RUN npm install

COPY frontend/ ./

RUN npm run build

ENV NODE_ENV=production
EXPOSE 10000

CMD ["npm", "run", "start", "--", "-p", "10000", "-H", "0.0.0.0"]
