#include <iostream>
#include <fstream>
#include <vector>
#include <chrono>
#include "third_party/httplib.h"
#include "huffman.hpp"

int main(int argc, char* argv[]) {
    // Handle self-tests execution
    if (argc > 1 && std::string(argv[1]) == "--test") {
        run_tests();
        return 0;
    }

    httplib::Server svr;

    // Server dashboard index
    svr.Get("/", [](const httplib::Request&, httplib::Response& res) {
        std::ifstream ifs("index.html");
        if (ifs) {
            std::string content((std::istreambuf_iterator<char>(ifs)),
                                std::istreambuf_iterator<char>());
            res.set_content(content, "text/html");
        } else {
            res.status = 404;
            res.set_content("Dashboard index.html not found.", "text/plain");
        }
    });

    // Mount static directory for resources
    svr.set_mount_point("/static", "./static");

    // Compression Endpoint
    svr.Post("/api/compress", [](const httplib::Request& req, httplib::Response& res) {
        if (!req.form.has_file("file")) {
            res.status = 400;
            res.set_content("{\"error\":\"No file uploaded\"}", "application/json");
            return;
        }

        const auto& file = req.form.get_file("file");
        std::string filename = file.filename;
        std::vector<uint8_t> input_data(file.content.begin(), file.content.end());

        // Extract extension
        std::string ext = "";
        size_t last_dot = filename.find_last_of('.');
        if (last_dot != std::string::npos) {
            ext = filename.substr(last_dot + 1);
        }

        auto start = std::chrono::high_resolution_clock::now();
        std::vector<uint8_t> compressed = compress_memory(input_data, ext);
        auto end = std::chrono::high_resolution_clock::now();
        auto duration_ms = std::chrono::duration_cast<std::chrono::milliseconds>(end - start).count();

        size_t orig_size = input_data.size();
        size_t comp_size = compressed.size();
        double savings = orig_size > 0 ? (1.0 - (double)comp_size / orig_size) * 100.0 : 0.0;
        double ratio = comp_size > 0 ? (double)orig_size / comp_size : 0.0;

        // Injects statistics in HTTP response headers
        res.set_header("Access-Control-Expose-Headers", "*");
        res.set_header("X-Original-Name", filename);
        res.set_header("X-Original-Size", std::to_string(orig_size));
        res.set_header("X-Compressed-Size", std::to_string(comp_size));
        res.set_header("X-Savings", std::to_string(savings));
        res.set_header("X-Ratio", std::to_string(ratio));
        res.set_header("X-Duration-MS", std::to_string(duration_ms));

        std::string binary_str(compressed.begin(), compressed.end());
        res.set_content(binary_str, "application/octet-stream");
    });

    // Decompression Endpoint
    svr.Post("/api/decompress", [](const httplib::Request& req, httplib::Response& res) {
        if (!req.form.has_file("file")) {
            res.status = 400;
            res.set_content("{\"error\":\"No file uploaded\"}", "application/json");
            return;
        }

        const auto& file = req.form.get_file("file");
        std::string filename = file.filename;
        std::vector<uint8_t> input_data(file.content.begin(), file.content.end());

        std::string ext = "";
        auto start = std::chrono::high_resolution_clock::now();
        std::vector<uint8_t> decompressed = decompress_memory(input_data, ext);
        auto end = std::chrono::high_resolution_clock::now();
        auto duration_ms = std::chrono::duration_cast<std::chrono::milliseconds>(end - start).count();

        size_t orig_size = input_data.size();
        size_t decomp_size = decompressed.size();

        res.set_header("Access-Control-Expose-Headers", "*");
        res.set_header("X-Original-Name", filename);
        res.set_header("X-Original-Size", std::to_string(orig_size));
        res.set_header("X-Decompressed-Size", std::to_string(decomp_size));
        res.set_header("X-Extension", ext);
        res.set_header("X-Duration-MS", std::to_string(duration_ms));

        std::string binary_str(decompressed.begin(), decompressed.end());
        res.set_content(binary_str, "application/octet-stream");
    });

    std::string host = "0.0.0.0";
    int port = 5000;

    const char* port_env = std::getenv("PORT");
    if (port_env) {
        try {
            port = std::stoi(port_env);
        } catch (...) {}
    }

    std::cout << "Server starting at http://" << host << ":" << port << "\n";
    svr.listen(host.c_str(), port);
    return 0;
}
