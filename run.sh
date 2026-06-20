#!/bin/bash
# Developer Convenience script for Huffman Web Application

set -e

echo "=== Compiling C++ Huffman Web Server & Engine ==="
make clean
make

echo "=== Running unit tests ==="
./bin/server --test

echo "=== Starting Web Server ==="
echo "The application will be available at http://127.0.0.1:5000"
./bin/server
