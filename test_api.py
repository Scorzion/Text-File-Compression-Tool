import os
import requests
import hashlib
import time

def get_md5(data):
    return hashlib.md5(data).hexdigest()

def main():
    print("=== Running Flask API Integration Test ===")
    
    server_url = "http://127.0.0.1:5000"
    original_content = b"This is a test content that will be compressed using the Huffman Coding REST API.\n" * 100
    original_md5 = get_md5(original_content)
    
    print(f"Original size: {len(original_content)} bytes")
    print(f"Original MD5: {original_md5}")
    
    # 1. Compress
    print("\nSending compression request...")
    files = {"file": ("test_api_file.txt", original_content)}
    try:
        r = requests.post(f"{server_url}/api/compress", files=files)
    except requests.exceptions.ConnectionError:
        print(f"FAIL: Could not connect to Flask server at {server_url}. Is it running?")
        return
        
    if r.status_code != 200:
        print(f"FAIL: Compress API returned status code {r.status_code}")
        print("Response:", r.text)
        return
        
    data = r.json()
    if not data.get("success"):
        print("FAIL: Compress API returned success=False")
        print("Response:", data)
        return
        
    print("Compress API Response: SUCCESS")
    print(f"Compressed Name: {data['compressed_name']}")
    print(f"Compressed Size: {data['compressed_size']} bytes")
    print(f"Space Savings: {data['savings']}")
    print(f"Compression Ratio: {data['ratio']}")
    print(f"Duration: {data['time_ms']} ms")
    
    download_url = data["download_url"]
    
    # 2. Download compressed
    print(f"\nDownloading compressed file from {download_url}...")
    r_dl = requests.get(f"{server_url}{download_url}")
    if r_dl.status_code != 200:
        print(f"FAIL: Download compressed file returned status code {r_dl.status_code}")
        return
        
    compressed_content = r_dl.content
    print(f"Downloaded compressed file: {len(compressed_content)} bytes")
    
    # 3. Decompress
    print("\nSending decompression request...")
    files_dec = {"file": ("test_api_file-compressed.bin", compressed_content)}
    r_dec = requests.post(f"{server_url}/api/decompress", files=files_dec)
    
    if r_dec.status_code != 200:
        print(f"FAIL: Decompress API returned status code {r_dec.status_code}")
        print("Response:", r_dec.text)
        return
        
    data_dec = r_dec.json()
    if not data_dec.get("success"):
        print("FAIL: Decompress API returned success=False")
        print("Response:", data_dec)
        return
        
    print("Decompress API Response: SUCCESS")
    print(f"Decompressed Name: {data_dec['decompressed_name']}")
    print(f"Decompressed Size: {data_dec['decompressed_size']} bytes")
    print(f"Duration: {data_dec['time_ms']} ms")
    
    download_dec_url = data_dec["download_url"]
    
    # 4. Download decompressed and verify
    print(f"\nDownloading decompressed file from {download_dec_url}...")
    r_dl_dec = requests.get(f"{server_url}{download_dec_url}")
    if r_dl_dec.status_code != 200:
        print(f"FAIL: Download decompressed file returned status code {r_dl_dec.status_code}")
        return
        
    decompressed_content = r_dl_dec.content
    decomp_md5 = get_md5(decompressed_content)
    
    print(f"Decompressed size: {len(decompressed_content)} bytes")
    print(f"Decompressed MD5: {decomp_md5}")
    
    if original_md5 != decomp_md5:
        print("FAIL: MD5 Hash Mismatch!")
        return
        
    print("\n=== INTEGRATION TEST PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    main()
