FROM node:24-alpine

WORKDIR /usr/src/app

# These should be part of docker compose, or passed on the docker run command line
ENV CREDENTIALS_FOLDER=/usr/src/credentials
ENV CURRENT_SEASON=season-0
ENV NUM_WEEKS=10
ENV DATA_FOLDER=/usr/src/data
ENV IFPA_API_KEY=??
ENV LEAGUE_ADMINS=admin
ENV TEST_EMAIL_ADDRESS=??
ENV UPLOADS_FOLDER=/usr/src/data/uploads

# The league: match rules, branding checkout, deployment (see README)
ENV MATCH_FORMAT=ten-player
ENV BRANDING_FOLDER=/usr/src/branding
# ENV BRANDING_URL=
# ENV PUBLIC_URL=
ENV TLS=internal
# ENV PORT=
# ENV TRUST_PROXY=

ENV EMAIL_HOST=smtp.example.com
ENV EMAIL_PORT=587
ENV EMAIL_ADDRESS=noreply@example.com
ENV EMAIL_NAME=Example League
# email password need to be passed on the docker commandline
# ENV EMAIL_PASSWORD=

COPY package*.json ./

RUN npm ci --only=production

COPY . .

EXPOSE 80 443
CMD ["node", "app.js"]

