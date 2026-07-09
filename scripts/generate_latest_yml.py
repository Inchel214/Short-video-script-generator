import os
import hashlib
import json
import glob
from datetime import datetime, timezone
import sys

def generate_latest_yml(file_pattern, output_file):
    files = glob.glob(file_pattern)
    if not files:
        print(f"No file found matching: {file_pattern}")
        return
    
    target_file = files[0]
    file_name = os.path.basename(target_file)
    file_size = os.path.getsize(target_file)
    
    with open(target_file, 'rb') as f:
        sha512 = hashlib.sha512(f.read()).hexdigest()
    
    with open('package.json', 'r', encoding='utf-8') as f:
        version = json.load(f)['version']
    
    release_date = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
    
    content = f"""version: {version}
files:
  - url: {file_name}
    sha512: {sha512}
    size: {file_size}
path: {file_name}
sha512: {sha512}
releaseDate: {release_date}
"""
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Generated {output_file}")

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: python generate_latest_yml.py <file_pattern> <output_file>")
        sys.exit(1)
    
    file_pattern = sys.argv[1]
    output_file = sys.argv[2]
    generate_latest_yml(file_pattern, output_file)