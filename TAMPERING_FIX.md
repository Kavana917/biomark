# Tampering Detection Fix

## Problem
The original verification logic had a critical vulnerability: when a user modified the visible content of an encrypted document, the verification still passed as long as the invisible watermark (zero-width characters) remained intact. This meant the system only verified:
1. The fingerprint hash matched the one embedded in the watermark
2. But NOT whether the document content had been changed

## Root Cause
The `verifyDocument` method only compared:
- The fingerprint hash extracted from the watermark
- The fingerprint hash computed from the supplied fingerprint

It never validated that the **visible content** of the document matched what was originally encrypted.

## Solution
Added **content integrity verification** by:

1. **During Encryption**: 
   - Compute a hash of the original visible content
   - Store this `contentHash` in the watermark data structure
   - The hash is included in the ultra-compact watermark format (`UltraCompactWatermarkData`)

2. **During Verification**:
   - Extract the watermark to get the original `contentHash`
   - Remove watermark characters from the current document to get visible content
   - Compute hash of current visible content
   - Compare current hash with stored hash
   - If hashes don't match → document has been tampered with → verification FAILS

## Technical Changes

### Modified Interfaces
- `WatermarkData`: Added `contentHash: string` field
- `UltraCompactWatermarkData`: Added `c: string` field for content hash
- `CompactWatermarkData`: Added optional `c?: string` for backward compatibility

### Modified Methods
- `BiometricEncryptionService.encryptDocument()`: Now computes and stores content hash
- `BiometricEncryptionService.verifyDocument()`: Now validates content integrity
- `BiometricEncryptionService.hashContent()`: New method to compute normalized content hash
- `BiometricEncryptionService.readWatermarkedDocument()`: **CRITICAL FIX** - Now uses the same text extraction method (mammoth) as encryption for consistency
- `DocumentWatermarker.embedWatermark()`: Includes content hash in watermark
- `DocumentWatermarker.extractWatermark()`: Extracts content hash from watermark

### Critical Bug Fix
The initial implementation had a subtle bug where:
- **Encryption** used `mammoth.extractRawText()` to extract text from DOCX files
- **Verification** used `readDocxXmlText()` which directly parses XML nodes

These two methods produce slightly different text outputs (e.g., different whitespace handling), causing content hash mismatches even for unmodified documents.

**Fix**: Changed `readWatermarkedDocument()` to always use `readDocument()`, which consistently uses mammoth for DOCX files in both encryption and verification paths.

### Content Normalization
The `hashContent()` method normalizes content by:
- Trimming whitespace
- Replacing multiple consecutive whitespace with single space
- This makes the hash resilient to minor formatting changes while detecting real content modifications

## Testing
To verify the fix works:

1. **Create an encrypted document**:
   - Upload fingerprint + document
   - Encrypt and download

2. **Verify with original content** (should pass):
   - Upload same fingerprint + encrypted document
   - Verification should succeed ✓

3. **Tamper with content**:
   - Open encrypted document in Word/text editor
   - Modify some text content
   - Save the file

4. **Verify tampered document** (should fail):
   - Upload same fingerprint + tampered document
   - Verification should now FAIL ✗
   - Console will show: "Content integrity check failed: document has been tampered with"

## Backward Compatibility
- Old watermarks without `contentHash` will still work (check uses `watermarkData.contentHash && ...`)
- The `contentHash` field in `CompactWatermarkData` is optional
- Only new encryptions will include content hash validation

## Security Notes
- The content hash prevents tampering of visible text
- The fingerprint hash prevents unauthorized ownership claims
- Together, they provide both **authenticity** and **integrity** verification
- The hash function uses a simple deterministic algorithm for consistency across verifications
