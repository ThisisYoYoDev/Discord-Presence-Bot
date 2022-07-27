FROM node:16.16-alpine3.15

WORKDIR /app

COPY package.json /app/

RUN npm install

COPY src/*.js /app/src/
COPY ./config/config.json /app/config/
COPY ./config/db.json /app/config/
COPY log/ /app/log/

RUN node /app/src/deploy-commands.js

ENTRYPOINT [ "npm", "run", "start" ]
