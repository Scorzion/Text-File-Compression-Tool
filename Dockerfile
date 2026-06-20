# Build Stage
FROM gcc:latest AS builder
WORKDIR /app
COPY . .
RUN make clean && make

# Run Stage
FROM debian:bookworm-slim
WORKDIR /app

# Copy compiled binary and static resources
COPY --from=builder /app/bin/server /app/bin/server
COPY --from=builder /app/static /app/static
COPY --from=builder /app/index.html /app/index.html

# Open port 5000
EXPOSE 5000

# Execute server
CMD ["./bin/server"]
