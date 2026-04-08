FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm cache clean --force && \
    npm ci --legacy-peer-deps && \
    npm cache clean --force

COPY . .

# Force Tailwind to scan and compile all CSS upfront
RUN npx tailwindcss -i ./src/app/globals.css -o /tmp/validate-tailwind.css

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
    CMD sh -c 'curl -s http://localhost:3000 | grep -q "_next/static/css" && echo "UP" || exit 1'

CMD ["npm", "run", "dev"]
