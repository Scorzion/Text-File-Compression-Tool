CXX = g++
CXXFLAGS = -O3 -Wall -Wextra -std=c++17 -Isrc/

all: prepare server

prepare:
	mkdir -p bin

server: src/server.cpp src/huffman.cpp src/huffman.hpp src/third_party/httplib.h
	$(CXX) $(CXXFLAGS) src/server.cpp src/huffman.cpp -lpthread -o bin/server

clean:
	rm -rf bin
