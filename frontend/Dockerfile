# ------------------------------------------------------------------------------
# STAGE 1: BUILD ENVIRONMENT
# This first stage is responsible for building the React application
# ------------------------------------------------------------------------------

# Use Node.js Alpine image for a smaller footprint
# 'AS build' names this stage so it can be referenced in the next stage
FROM node:24-alpine AS build

# Set the working directory inside the container for all subsequent commands
WORKDIR /app

# Copy only package files first to leverage Docker's layer caching
# If package.json and package-lock.json don't change, Docker will reuse the cached dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
# This happens after npm install to avoid reinstalling dependencies when only code changes
COPY . .

# Accept build arguments for environment variables
# These are passed from docker-compose.yml and need to be available during build
ARG SCATTERING_TILED_URL
ARG SCATTERING_TILED_API_KEY

# Set environment variables from build args
# Vite will pick these up and bake them into the static files at build time
ENV SCATTERING_TILED_URL=$SCATTERING_TILED_URL
ENV SCATTERING_TILED_API_KEY=$SCATTERING_TILED_API_KEY

# Build the React application in production mode using the app config
# This creates optimized, minified files in the /app/dist-app directory
# The environment variables will be baked into the JavaScript bundle
RUN npm run build -- --config vite.app.config.ts

# ------------------------------------------------------------------------------
# STAGE 2: PRODUCTION ENVIRONMENT
# This stage uses a clean Nginx image and only includes the built application
# ------------------------------------------------------------------------------

# Start a new stage with a fresh Nginx Alpine image
# This results in a much smaller final image without Node.js, npm, or build tools
FROM nginx:alpine

# Copy only the built files from the previous stage
# This is the key benefit of multi-stage builds - the final image only contains what's needed
COPY --from=build /app/dist-app /usr/share/nginx/html

# Copy the Nginx configuration file
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Inform Docker that the container listens on port 80
# This is mostly documentation - it doesn't actually publish the port
EXPOSE 80

# Define the command to run when the container starts
# The "daemon off" flag keeps Nginx running in the foreground (required for Docker)
CMD ["nginx", "-g", "daemon off;"]
