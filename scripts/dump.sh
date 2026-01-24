#!/bin/bash

# dump.sh - Export source code and documentation for code agent consumption
# Outputs a single text file optimized for LLM/agent context

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_FILE="$PROJECT_ROOT/nostr-sdk-dump.txt"

# Function to dump a file with a header
dump_file() {
    local file="$1"
    local relative_path="${file#$PROJECT_ROOT/}"

    echo ""
    echo "================================================================================"
    echo "FILE: $relative_path"
    echo "================================================================================"
    echo ""
    cat "$file"
    echo ""
}

# Start fresh
echo "Dumping project to $OUTPUT_FILE..."

{
    cat << 'EOF'
================================================================================
NOSTR-SDK PROJECT DUMP
================================================================================

This file contains all documentation and source code for @vbyte/nostr-sdk.
Optimized for code agent consumption.

TABLE OF CONTENTS:
  1. Project Documentation (CLAUDE.md, README.md, package.json)
  2. Documentation Files (docs/)
  3. Type Definitions (src/types/)
  4. Schema Definitions (src/schema/)
  5. Crypto Utilities (src/crypto/)
  6. Library Modules (src/lib/)
  7. Class Implementations (src/class/)
  8. Root Source Files (src/)

EOF

    echo ""
    echo "================================================================================"
    echo "SECTION 1: PROJECT DOCUMENTATION"
    echo "================================================================================"

    # Core project files first
    for file in "$PROJECT_ROOT/CLAUDE.md" "$PROJECT_ROOT/README.md" "$PROJECT_ROOT/package.json"; do
        if [ -f "$file" ]; then
            dump_file "$file"
        fi
    done

    echo ""
    echo "================================================================================"
    echo "SECTION 2: DOCUMENTATION FILES"
    echo "================================================================================"

    # Documentation files
    find "$PROJECT_ROOT/docs" -name "*.md" -type f 2>/dev/null | sort | while read -r file; do
        dump_file "$file"
    done

    echo ""
    echo "================================================================================"
    echo "SECTION 3: TYPE DEFINITIONS"
    echo "================================================================================"

    # Types first (for context)
    find "$PROJECT_ROOT/src/types" -name "*.ts" -type f 2>/dev/null | sort | while read -r file; do
        dump_file "$file"
    done

    echo ""
    echo "================================================================================"
    echo "SECTION 4: SCHEMA DEFINITIONS"
    echo "================================================================================"

    # Schema definitions
    find "$PROJECT_ROOT/src/schema" -name "*.ts" -type f 2>/dev/null | sort | while read -r file; do
        dump_file "$file"
    done

    echo ""
    echo "================================================================================"
    echo "SECTION 5: CRYPTO UTILITIES"
    echo "================================================================================"

    # Crypto utilities
    find "$PROJECT_ROOT/src/crypto" -name "*.ts" -type f 2>/dev/null | sort | while read -r file; do
        dump_file "$file"
    done

    echo ""
    echo "================================================================================"
    echo "SECTION 6: LIBRARY MODULES"
    echo "================================================================================"

    # Library modules
    find "$PROJECT_ROOT/src/lib" -name "*.ts" -type f 2>/dev/null | sort | while read -r file; do
        dump_file "$file"
    done

    echo ""
    echo "================================================================================"
    echo "SECTION 7: CLASS IMPLEMENTATIONS"
    echo "================================================================================"

    # Class implementations
    find "$PROJECT_ROOT/src/class" -name "*.ts" -type f 2>/dev/null | sort | while read -r file; do
        dump_file "$file"
    done

    echo ""
    echo "================================================================================"
    echo "SECTION 8: ROOT SOURCE FILES"
    echo "================================================================================"

    # Root source files (index.ts, const.ts, etc.)
    find "$PROJECT_ROOT/src" -maxdepth 1 -name "*.ts" -type f 2>/dev/null | sort | while read -r file; do
        dump_file "$file"
    done

} > "$OUTPUT_FILE"

echo ""
echo "Created: $OUTPUT_FILE"
echo "Size: $(du -h "$OUTPUT_FILE" | cut -f1)"
echo "Lines: $(wc -l < "$OUTPUT_FILE")"
