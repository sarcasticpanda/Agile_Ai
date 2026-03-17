FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better caching
COPY package.json package-lock.json* ./
RUN npm install

# Copy application files
COPY . .

# Set up volume for uploads
RUN mkdir -p uploads

EXPOSE 5000

CMD ["npm", "start"]
