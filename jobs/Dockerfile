FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps 2>&1 || (cat /root/.npm/_logs/*.log && exit 1)
COPY tsconfig.json ./
COPY src/lib ./src/lib
COPY jobs ./jobs
ARG JOB
ENV JOB=${JOB}
CMD ["sh", "-c", "npx tsx jobs/${JOB}.ts"]
