// Test the new watermarking approach

import { BiometricEncryptionService } from './biometric';

export function testNewWatermarking() {
  const service = new BiometricEncryptionService();
  
  // Test with a simple text document
  const originalText = "This is a test document for watermarking. It should look normal when opened in Word or any text editor.";
  
  // Create test watermark data
  const testWatermarkData = {
    fingerprintHash: "test123",
    vault: {
      vault: [[1, 2], [3, 4]],
      secret: "secret",
      polynomial: [1, 2]
    },
    timestamp: Date.now()
  };
  
  // Test watermarking
  const watermarkedText = service.documentWatermarker.embedWatermark(originalText, testWatermarkData);
  const userVisibleText = service.getUserVisibleText(watermarkedText);
  const extractedData = service.documentWatermarker.extractWatermark(watermarkedText);
  
  console.log("=== NEW WATERMARKING TEST ===");
  console.log("Original text:", originalText);
  console.log("User visible text:", userVisibleText);
  console.log("Are they identical?", userVisibleText === originalText);
  console.log("Watermarked length:", watermarkedText.length);
  console.log("Original length:", originalText.length);
  console.log("Watermark size:", watermarkedText.length - originalText.length);
  console.log("Extracted data:", extractedData);
  
  // Test that the document can be opened normally
  const testDocument = userVisibleText;
  console.log("Document for Word/Notepad:", testDocument);
  
  return {
    original: originalText,
    watermarked: watermarkedText,
    userVisible: userVisibleText,
    extracted: extractedData,
    isIdentical: userVisibleText === originalText,
    watermarkSize: watermarkedText.length - originalText.length
  };
}

