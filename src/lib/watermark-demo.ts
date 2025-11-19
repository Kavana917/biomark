// Demonstration of Zero-Width Character Watermarking Technique

export interface WatermarkDemo {
  originalText: string;
  watermarkedText: string;
  watermarkData: any;
  binaryData: string;
  zeroWidthChars: string[];
}

/**
 * Demonstrate the zero-width character watermarking process
 */
export function demonstrateWatermarking(): WatermarkDemo {
  // Sample document text
  const originalText = "This is a confidential document that needs to be protected with biometric watermarking.";
  
  // Sample watermark data (biometric key + vault)
  const watermarkData = {
    fingerprintHash: "a1b2c3d4e5f6",
    vault: {
      vault: [[123, 456], [789, 12], [345, 678]],
      secret: "secretkey123",
      polynomial: [1, 2, 3, 4]
    },
    timestamp: 1704067200000
  };

  // Convert to binary
  const jsonString = JSON.stringify(watermarkData);
  let binary = '';
  for (let i = 0; i < jsonString.length; i++) {
    const charCode = jsonString.charCodeAt(i);
    binary += charCode.toString(2).padStart(8, '0');
  }

  // Zero-width characters used
  const ZERO_WIDTH_SPACE = '\u200B';      // 0
  const ZERO_WIDTH_NON_JOINER = '\u200C'; // 1
  const ZERO_WIDTH_JOINER = '\u200D';     // (unused in this implementation)

  // Embed watermark
  let watermarkedText = originalText;
  for (let i = 0; i < binary.length; i++) {
    const bit = binary[i];
    if (bit === '0') {
      watermarkedText += ZERO_WIDTH_SPACE;
    } else if (bit === '1') {
      watermarkedText += ZERO_WIDTH_NON_JOINER;
    }
  }

  // Extract zero-width characters for demonstration
  const zeroWidthChars: string[] = [];
  for (let i = originalText.length; i < watermarkedText.length; i++) {
    const char = watermarkedText[i];
    if (char === ZERO_WIDTH_SPACE) {
      zeroWidthChars.push('ZWS (0)');
    } else if (char === ZERO_WIDTH_NON_JOINER) {
      zeroWidthChars.push('ZWNJ (1)');
    }
  }

  return {
    originalText,
    watermarkedText,
    watermarkData,
    binaryData: binary,
    zeroWidthChars
  };
}

/**
 * Show the difference between original and watermarked text
 */
export function showTextComparison(): void {
  const demo = demonstrateWatermarking();
  
  console.log("=== ZERO-WIDTH CHARACTER WATERMARKING DEMO ===");
  console.log("\n1. ORIGINAL TEXT:");
  console.log(`"${demo.originalText}"`);
  console.log(`Length: ${demo.originalText.length} characters`);
  
  console.log("\n2. WATERMARKED TEXT:");
  console.log(`"${demo.watermarkedText}"`);
  console.log(`Length: ${demo.watermarkedText.length} characters`);
  console.log(`Added: ${demo.watermarkedText.length - demo.originalText.length} zero-width characters`);
  
  console.log("\n3. WATERMARK DATA:");
  console.log(JSON.stringify(demo.watermarkData, null, 2));
  
  console.log("\n4. BINARY REPRESENTATION:");
  console.log(`Binary: ${demo.binaryData}`);
  console.log(`Length: ${demo.binaryData.length} bits`);
  
  console.log("\n5. ZERO-WIDTH CHARACTERS ADDED:");
  console.log(demo.zeroWidthChars.slice(0, 20).join(' '));
  if (demo.zeroWidthChars.length > 20) {
    console.log(`... and ${demo.zeroWidthChars.length - 20} more`);
  }
  
  console.log("\n6. VISUAL COMPARISON:");
  console.log("Original:  This is a confidential document that needs to be protected with biometric watermarking.");
  console.log("Watermarked: This is a confidential document that needs to be protected with biometric watermarking.");
  console.log("           ↑ Looks identical to users, but contains hidden biometric data!");
  
  console.log("\n7. EXTRACTION PROCESS:");
  console.log("- Scan text from end to beginning");
  console.log("- Find zero-width characters");
  console.log("- Convert ZWS (\\u200B) to '0'");
  console.log("- Convert ZWNJ (\\u200C) to '1'");
  console.log("- Reconstruct binary data");
  console.log("- Parse JSON to get watermark data");
  console.log("- Verify fingerprint and unlock vault");
}

/**
 * Test watermark extraction
 */
export function testWatermarkExtraction(watermarkedText: string): any {
  const ZERO_WIDTH_SPACE = '\u200B';
  const ZERO_WIDTH_NON_JOINER = '\u200C';
  
  let binary = '';
  let foundWatermark = false;
  
  // Extract from end of text
  for (let i = watermarkedText.length - 1; i >= 0; i--) {
    const char = watermarkedText[i];
    
    if (char === ZERO_WIDTH_SPACE) {
      binary = '0' + binary;
      foundWatermark = true;
    } else if (char === ZERO_WIDTH_NON_JOINER) {
      binary = '1' + binary;
      foundWatermark = true;
    } else if (foundWatermark) {
      break;
    }
  }
  
  if (!foundWatermark) {
    return null;
  }
  
  // Convert binary back to JSON
  let jsonString = '';
  for (let i = 0; i < binary.length; i += 8) {
    const byte = binary.substr(i, 8);
    const charCode = parseInt(byte, 2);
    jsonString += String.fromCharCode(charCode);
  }
  
  try {
    return JSON.parse(jsonString);
  } catch {
    return null;
  }
}
