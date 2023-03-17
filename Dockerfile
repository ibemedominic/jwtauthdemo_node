FROM node:14.19.3-alpine

EXPOSE ${ENDPOINT_PORT}
WORKDIR /app

COPY . .
RUN npm install
RUN npm run build
#CMD ["node", "--inspect-brk=0.0.0.0", "dist/main.js"]
CMD ["node", "dist/main.js"]

#prod COPY . .
#prod RUN npm install
#prod RUN npm run build
#prod CMD ["node", "dist/main.js"]

#dev COPY . .
#dev CMD ["npm", "run", "start:dev"]
