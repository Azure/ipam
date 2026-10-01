ARG BASE_IMAGE=nginx:alpine
FROM $BASE_IMAGE

# IPAM Version (for OCI Image Label)
ARG IPAM_VERSION=0.0.0

# OCI Image Labels
LABEL org.opencontainers.image.title="Azure IPAM Load Balancer" \
      org.opencontainers.image.version="${IPAM_VERSION}" \
      org.opencontainers.image.source="https://github.com/Azure/ipam"

# Create File Links
RUN ln -sf /dev/stdout /var/log/nginx/access.log
RUN ln -sf /dev/stderr /var/log/nginx/error.log

# Copy NGINX Config
COPY nginx.conf /etc/nginx/nginx.conf

# Run script uses standard ways to run the application
CMD ["nginx", "-g", "daemon off;"]
