# ---- Together We Rise: container image ----
FROM node:18-alpine

# app lives here inside the container
WORKDIR /app

# install deps first (layer caching: only re-runs if package files change)
COPY package*.json ./
RUN npm install --omit=dev

# copy the rest of the app (server.js, public/)
COPY . .

# the server reads process.env.PORT; default 3000. Document it:
EXPOSE 3000

# start the server
CMD ["node", "server.js"]
