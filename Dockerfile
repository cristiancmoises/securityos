FROM node:16-alpine

RUN apk add --no-cache git

WORKDIR SecurityOS
COPY . .

RUN yarn
RUN yarn build

CMD yarn start
