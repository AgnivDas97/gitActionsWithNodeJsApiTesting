# Use official Node.js LTS (Alpine Linux) as base image for lightweight footprint
FROM node:20-alpine

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000

# Set working directory inside container
WORKDIR /usr/src/app

# Copy package manifests first to leverage Docker layer caching
COPY package*.json ./

# Install only production dependencies cleanly
RUN npm ci --omit=dev && npm cache clean --force

# Copy application source code
COPY index.js ./

# Switch to non-root user for enhanced security
USER node

# Expose server port
EXPOSE 3000

# Container healthcheck using Node.js built-in fetch (Node 18+)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start the application
CMD ["node", "index.js"]
