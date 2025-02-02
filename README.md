# Goal
To make a hello world app for video conferencing.
> Reference video: https://www.youtube.com/watch?v=DvlyzDZDEq4

# Tech Stack
- Docker
- Express
- EJS
- socket.io (node_module)
- uuid (node_module)
- Peer JS (WebRTC)

# Pre-Requisites
- Docker

# Dev Environment Setup

- App Server
```sh
# Set Secrets

# Start Server (as docker container)
docker run -it --rm \
    --name sales_copilot \
    -p 3000:3000 \
    -v ./:/app \
    -w /app \
    node:23 \
        /bin/bash

# Install
npm install

# START NODE SERVER IN DEV MODE
npm run dev
```

- Peer server
```sh
# START node image
docker run -it --rm \
    --name sales_copilot_peer_server \
    -p 3001:3001 \
    node:23 \
        /bin/bash

# Install PeerJS
npm i -g peer

# Start peer server
peerjs --port 3001
```

- To re-enter the (app) server container
```sh
docker exec -it sales_copilot /bin/bash
```

<!-- # Build
```sh
# Fix ESLint issue
npm run lint

# Check if build is successful
npm run build

# Test app
npm run start
```

## Docker image
```sh
# Build Docker image
docker build -t sales_copilot_image .

# Test app
docker run -d \
    --name sales_copilot \
    -p 3000:3000 \
    sales_copilot_image
``` -->