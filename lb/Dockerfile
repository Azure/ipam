# registry.access.redhat.com/ubi8/nginx-122
ARG BASE_IMAGE=nginx:alpine
FROM $BASE_IMAGE

RUN ln -sf /dev/stdout /var/log/nginx/access.log
RUN ln -sf /dev/stderr /var/log/nginx/error.log

COPY nginx.conf /etc/nginx/nginx.conf

# Run script uses standard ways to run the application
CMD nginx -g "daemon off;"
