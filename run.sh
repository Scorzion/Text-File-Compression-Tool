#!/bin/bash
# Developer Convenience script for Text File Compression Tool

set -e

echo "=== Setting up python virtual environment ==="
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi

echo "=== Installing dependencies ==="
.venv/bin/pip install -r requirements.txt

echo "=== Compiling C++ Huffman Coding Engine ==="
make clean
make

echo "=== Starting Flask Web Server ==="
echo "The application will be available at http://127.0.0.1:5000"
.venv/bin/python3 app.py
