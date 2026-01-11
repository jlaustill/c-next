#!/bin/bash
# C-Next Test Inventory Script
# Generates structured catalog of all 251 test files

OUTPUT_FILE="test-inventory.csv"
TESTS_DIR="tests"

echo "Test File,Size,Type,Directory,Keywords" > "$OUTPUT_FILE"

# Find all .test.cnx files
find "$TESTS_DIR" -name "*.test.cnx" -type f | sort | while read test_file; do
    # Extract metadata
    size=$(stat -c%s "$test_file" 2>/dev/null || stat -f%z "$test_file" 2>/dev/null)

    # Determine test type (success or error)
    test_type="success"
    if [ -f "${test_file%.cnx}.expected.error" ]; then
        test_type="error"
    fi

    # Extract directory name
    dir_name=$(dirname "$test_file" | sed 's|tests/||')

    # Keyword scanning (first 50 lines to avoid huge files)
    keywords=""

    # Check for primitive types
    if head -50 "$test_file" | grep -q '\bf32\b'; then keywords="${keywords}f32,"; fi
    if head -50 "$test_file" | grep -q '\bf64\b'; then keywords="${keywords}f64,"; fi
    if head -50 "$test_file" | grep -q '\bu8\b'; then keywords="${keywords}u8,"; fi
    if head -50 "$test_file" | grep -q '\bu16\b'; then keywords="${keywords}u16,"; fi
    if head -50 "$test_file" | grep -q '\bu32\b'; then keywords="${keywords}u32,"; fi
    if head -50 "$test_file" | grep -q '\bu64\b'; then keywords="${keywords}u64,"; fi
    if head -50 "$test_file" | grep -q '\bi8\b'; then keywords="${keywords}i8,"; fi
    if head -50 "$test_file" | grep -q '\bi16\b'; then keywords="${keywords}i16,"; fi
    if head -50 "$test_file" | grep -q '\bi32\b'; then keywords="${keywords}i32,"; fi
    if head -50 "$test_file" | grep -q '\bi64\b'; then keywords="${keywords}i64,"; fi
    if head -50 "$test_file" | grep -q '\bbool\b'; then keywords="${keywords}bool,"; fi

    # Check for modifiers
    if head -50 "$test_file" | grep -q '\batomic\b'; then keywords="${keywords}atomic,"; fi
    if head -50 "$test_file" | grep -q '\bvolatile\b'; then keywords="${keywords}volatile,"; fi
    if head -50 "$test_file" | grep -q '\bconst\b'; then keywords="${keywords}const,"; fi
    if head -50 "$test_file" | grep -q '\bclamp\b'; then keywords="${keywords}clamp,"; fi
    if head -50 "$test_file" | grep -q '\bwrap\b'; then keywords="${keywords}wrap,"; fi

    # Check for special constructs
    if head -50 "$test_file" | grep -q '\bscope\b'; then keywords="${keywords}scope,"; fi
    if head -50 "$test_file" | grep -q '\bregister\b'; then keywords="${keywords}register,"; fi
    if head -50 "$test_file" | grep -q '\benum\b'; then keywords="${keywords}enum,"; fi
    if head -50 "$test_file" | grep -q '\bstruct\b'; then keywords="${keywords}struct,"; fi
    if head -50 "$test_file" | grep -q '\bbitmap'; then keywords="${keywords}bitmap,"; fi
    if head -50 "$test_file" | grep -q '\bstring<'; then keywords="${keywords}string,"; fi
    if head -50 "$test_file" | grep -q '\bcritical\b'; then keywords="${keywords}critical,"; fi

    # Check for operators
    if head -50 "$test_file" | grep -q '?'; then keywords="${keywords}ternary,"; fi
    if head -50 "$test_file" | grep -q 'switch'; then keywords="${keywords}switch,"; fi
    if head -50 "$test_file" | grep -q 'do.*while'; then keywords="${keywords}do-while,"; fi

    # Check for array dimensions
    if head -50 "$test_file" | grep -qE '\[[0-9]+\]\[[0-9]+\]'; then keywords="${keywords}multi-dim-array,"; fi

    # Remove trailing comma
    keywords="${keywords%,}"

    # Output CSV row
    echo "\"$test_file\",$size,$test_type,$dir_name,\"$keywords\""
done >> "$OUTPUT_FILE"

# Generate summary
echo ""
echo "=== Test Inventory Summary ==="
echo "Total test files: $(find "$TESTS_DIR" -name "*.test.cnx" | wc -l)"
echo "Success tests: $(find "$TESTS_DIR" -name "*.expected.c" | wc -l)"
echo "Error tests: $(find "$TESTS_DIR" -name "*.expected.error" | wc -l)"
echo ""
echo "Test files by directory:"
find "$TESTS_DIR" -type d -mindepth 1 -maxdepth 1 | while read dir; do
    count=$(find "$dir" -name "*.test.cnx" | wc -l)
    echo "  $(basename $dir): $count"
done | sort -t: -k2 -rn
echo ""
echo "Inventory saved to: $OUTPUT_FILE"
