FROM node:20-slim

WORKDIR /app

# Copy built files
COPY dist ./dist
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Expose port
EXPOSE 3000

# Start the backend server
CMD ["node", "dist/boot.js"]
