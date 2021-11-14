FROM node:14.4.0-alpine
# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

ENV CHROME_BIN="/usr/bin/chromium-browser"\
	PUPPETEER_SKIP_CHROMIUM_DOWNLOAD="true"

RUN set -x \
	&& apk update \
	&& apk upgrade \
	# replacing default repositories with edge ones
	&& echo "http://dl-cdn.alpinelinux.org/alpine/edge/testing" > /etc/apk/repositories \
	&& echo "http://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories \
	&& echo "http://dl-cdn.alpinelinux.org/alpine/edge/main" >> /etc/apk/repositories \
	\
	# Add the packages
	&& apk add --no-cache dumb-init curl make gcc g++ python linux-headers binutils-gold gnupg libstdc++ nss chromium \
	\
	&& npm install puppeteer@0.13.0 \
	\
	# Do some cleanup
	&& apk del --no-cache make gcc g++ python binutils-gold gnupg libstdc++ \
	&& rm -rf /usr/include \
	&& rm -rf /var/cache/apk/* /root/.node-gyp /usr/share/man /tmp/* \
	&& echo

ENV ACCEPT_HIGHCHARTS_LICENSE=YES

# RUN npm install
# If you are building your code for production
RUN npm ci --only=production

# Bundle app source
COPY . .

EXPOSE 666
CMD [ "node", "bot.js" ]
