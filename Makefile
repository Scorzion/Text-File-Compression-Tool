CXX = g++
CXXFLAGS = -O3 -Wall -Wextra -std=c++17

all: c d

c: huffcompress.cpp
	$(CXX) $(CXXFLAGS) huffcompress.cpp -o c

d: huffdecompress.cpp
	$(CXX) $(CXXFLAGS) huffdecompress.cpp -o d

clean:
	rm -f c d
