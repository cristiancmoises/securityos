FROM node:26-alpine

RUN apk add --no-cache git

WORKDIR SecurityOS
COPY . .

RUN yarn
RUN yarn build

CMD yarn start
