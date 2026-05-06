# Use lightweight Node.js runtime
FROM node:20-alpine

# Set working directory inside the container
WORKDIR /app

# Copy dependency files first for better Docker layer caching
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy application source code
COPY src ./src

# Expose the backend port
EXPOSE 3000

# Start the backend application
CMD ["npm", "start"]