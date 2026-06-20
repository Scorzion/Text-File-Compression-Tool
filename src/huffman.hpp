#ifndef HUFFMAN_HPP
#define HUFFMAN_HPP

#include <vector>
#include <string>
#include <cstdint>

// Huffman Tree Node
struct Node {
    uint8_t ch;
    uint32_t freq;
    Node* left;
    Node* right;

    Node(uint8_t c, uint32_t f);
    Node(uint32_t f, Node* l, Node* r);
    ~Node();
};

// Functor for priority queue sorting
struct Compare {
    bool operator()(const Node* l, const Node* r) const;
};

// In-Memory Huffman Coder APIs
std::vector<uint8_t> compress_memory(const std::vector<uint8_t>& input_data, const std::string& ext);
std::vector<uint8_t> decompress_memory(const std::vector<uint8_t>& compressed_data, std::string& ext);

// Engine self-test runner
void run_tests();

#endif // HUFFMAN_HPP
