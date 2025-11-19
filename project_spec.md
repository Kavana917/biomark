## Bio-Mark Guard Project Specification

### 1. Overview
- **Goal**: Secure text or Word documents (`.txt`, `.doc`, `.docx`) by binding them to a user's fingerprint. The fingerprint drives a Fuzzy Vault key, and ownership/authenticity info is embedded as an invisible watermark inside the document itself.
- **Core idea**: The encrypted document looks identical to the original in editors like Microsoft Word because the watermark uses zero-width Unicode characters appended to the document.
- **Security Features**:
  - **Authenticity**: Verifies document ownership via fingerprint matching
  - **Integrity**: Detects content tampering via content hash validation
  - **Invisibility**: Watermark uses zero-width Unicode characters
- **Key flows**:
  1. **Encryption**: Upload fingerprint + document → extract minutiae → create vault & watermark (with content hash) → embed watermark → download secured document.
  2. **Verification**: Upload fingerprint + watermarked doc → extract watermark → validate content integrity → recompute fingerprint hash → confirm ownership.

### 2. Frontend Architecture (Vite + React + Tailwind + shadcn/ui)
- `src/components/EncryptionSection.tsx`
  - Manages uploads, progress UI, and the lifecycle of encryption.
  - Instantiates `BiometricEncryptionService`.
  - Handles both text and Word files; when encryption finishes it stores either a watermarked string (`.txt`) or Blob (`.docx`) and exposes download + preview.
- `src/components/VerificationSection.tsx`
  - Similar progressive UX for verifying ownership.
  - Sends either the raw text (for `.txt`) or the original File (for `.docx`) to `BiometricEncryptionService.verifyDocument`.
- Support components: `FileUpload`, `FilePreview`, `ProgressDisplay`, etc.
- Notifications handled via `sonner` toasts; icons via `lucide-react`.

### 3. Biometric & Watermark Pipeline (`src/lib/biometric.ts`)
1. **Fingerprint processing** (`FingerprintProcessor`)
   - Uses an off-screen `<canvas>` to load the fingerprint image.
   - Steps: grayscale → contrast enhancement → median filter → binarization → skeletonization → minutiae extraction (ridge endings/bifurcations).
2. **Fuzzy Vault generation** (`FuzzyVaultGenerator`)
   - Generates a short random secret.
   - Converts the secret to polynomial coefficients.
   - Evaluates the polynomial at encoded minutiae points and mixes with chaff points.
3. **Watermark embedding** (`DocumentWatermarker`)
   - Converts fingerprint hash + vault secret + timestamp + **content hash** to an "ultra compact" JSON structure.
   - Serializes to binary, then to zero-width characters (`\u200B` = 0, `\u200C` = 1) with a `\uFEFF` marker.
   - Appends the invisible payload to the document; extracting reverses this process.
   - **Content hash**: Normalized hash of original document content for tampering detection.
4. **Service orchestration** (`BiometricEncryptionService`)
   - `encryptDocument(fingerprintFile, documentFile)`:
     - Runs phases above.
     - Detects `.doc`/`.docx` vs `.txt`.
     - Computes content hash via `hashContent()` method (normalizes whitespace, trims, then hashes).
     - Embeds watermark containing: fingerprint hash, vault secret, timestamp, and content hash.
     - `.docx` path: uses `docx-handler` (see below) to read/embed/create a proper Word file; returns a Blob plus metadata.
     - `.txt` path: returns the watermarked string.
   - `verifyDocument(fingerprintFile, encryptedDocument)`:
     - Accepts either a `File` (Word doc) or a string (text file).
     - Extracts watermark → validates content integrity (compares stored hash with current content hash) → recomputes fingerprint hash → compares.
     - **Critical**: Uses consistent text extraction method (`mammoth.extractRawText()` for DOCX) in both encryption and verification to avoid false positives.
     - Fails if either content hash mismatch (tampering) or fingerprint mismatch (unauthorized) occurs.
   - `hashContent(content: string)`: Normalizes content (trim + collapse whitespace) and computes deterministic hash.
   - `getUserVisibleText()` removes the watermark marker for previews/logging.
   - `readWatermarkedDocument()`: **Fixed** to use `readDocument()` consistently with `mammoth` for DOCX files.

### 4. Word Document Handling (`src/lib/docx-handler.ts`)
- Uses **mammoth** to extract raw text from `.docx`.
- Uses **JSZip** to build a minimal but valid `.docx` package containing the watermarked text.
- Maintains proper XML structure (`word/document.xml`, relationships, `[Content_Types].xml`) so the generated file opens cleanly in Word.
- Also exposes helpers to extract text from already watermarked `.docx` files during verification or UI previews.

### 5. Validation & UX Safeguards (`src/lib/validation.ts`)
- Validates fingerprint file type/size/dimensions.
- Validates document file type (`.txt`, `.doc`, `.docx`) and size ranges.
- Provides combined `validateFiles` helper used before both encryption and verification steps.

### 6. Encryption UI Behavior
1. User uploads fingerprint (PNG/JPG) + document.
2. Validation runs; progress steps simulate each stage while async work happens.
3. After embedding, the UI shows:
   - Preview of visible text (for `.docx` it’s extracted via `docx-handler` for display purposes).
   - Download button producing either `encrypted_<name>.docx` or `.txt`.
   - Optional “Test” button logging diagnostic info.

### 7. Verification UI Behavior
1. User uploads fingerprint + previously watermarked document.
2. Validation (with larger allowance for watermarked size) runs.
3. Steps mirror the verification phases (minutiae extraction, watermark check, comparison).
4. Calls `BiometricEncryptionService.verifyDocument` with the appropriate payload type.

### 8. Key Assumptions & Limitations
- Fingerprint processing is client-side and simplified for demo purposes (not production-grade matching).
- Fuzzy Vault parameters are intentionally small/minimal to keep payload tiny.
- Watermark is appended; if users aggressively edit/save in incompatible editors the invisible data could be removed.
- `.doc` files are treated like `.docx` via text extraction/rewrite; rich formatting is not preserved—content fidelity is prioritized.
- No persistent backend; everything runs in-browser.
- Content hash is normalized (whitespace-collapsed) to be resilient to minor formatting changes while detecting substantive content modifications.

### 9. External Dependencies
- **mammoth**: DOCX → text extraction.
- **jszip**: Creating DOCX archives.
- **react**, **vite**, **tailwindcss**, **shadcn/ui** stack for UI.
- **sonner**, **lucide-react** for toasts and icons.

### 10. Security Implementation Details

#### Tampering Detection (Added)
- **Problem**: Original system only verified fingerprint ownership, not content integrity. Modified documents with intact watermarks would pass verification.
- **Solution**: Added content hash to watermark data structure:
  - During encryption: Compute hash of visible content and store in watermark
  - During verification: Extract watermark, recompute current content hash, compare with stored hash
  - Verification fails if hashes don't match (tampering detected)

#### Data Structures
- `WatermarkData`: Full structure with `fingerprintHash`, `secret`, `timestamp`, `contentHash`
- `UltraCompactWatermarkData`: Compact format with single-letter keys (`f`, `s`, `t`, `c`)
- `CompactWatermarkData`: Intermediate format with optional `c?` for backward compatibility

#### Critical Bug Fix: Text Extraction Consistency
- **Issue**: Encryption used `mammoth.extractRawText()`, verification used direct XML parsing (`readDocxXmlText()`)
- **Result**: Different text representations caused hash mismatches even for unmodified documents
- **Fix**: Modified `readWatermarkedDocument()` to consistently use `mammoth.extractRawText()` via `readDocument()` helper
- **Lesson**: Text extraction method MUST be identical in encryption and verification paths

#### Backward Compatibility
- Old watermarks without `contentHash` still work (check: `if (watermarkData.contentHash && ...)`)
- Only new encryptions enforce content integrity validation

### 11. Developer Tips
- When modifying watermark logic, ensure both embedding and extraction stay in sync.
- For UI preview/logging, always use `getUserVisibleText()` to avoid exposing invisible characters.
- DOCX helper functions rely on browser APIs (`DOMParser`, `XMLSerializer`, `File`, `Blob`). Keep changes browser-compatible.
- If you add new document types, update both validation and the service read/write logic.
- **CRITICAL**: When modifying text extraction, ensure the same method is used in both encryption and verification to avoid false hash mismatches.
- Content normalization in `hashContent()` uses `trim()` and `replace(/\s+/g, ' ')` - maintain this pattern if modifying.

### 12. Testing Guidelines

#### Test Case 1: Normal Encryption & Verification (Should PASS)
1. Upload fingerprint + document
2. Encrypt and download
3. Immediately verify with same fingerprint
4. ✅ Expected: Verification succeeds

#### Test Case 2: Tampered Content (Should FAIL)
1. Encrypt a document
2. Open in Word/text editor and modify content
3. Save and verify with original fingerprint
4. ❌ Expected: "Content integrity check failed: document has been tampered with"

#### Test Case 3: Unauthorized Fingerprint (Should FAIL)
1. Encrypt document with fingerprint A
2. Verify with different fingerprint B
3. ❌ Expected: Fingerprint mismatch error

#### Test Case 4: Watermark Removal (Should FAIL)
1. Encrypt document
2. Remove invisible watermark characters (if editor supports it)
3. Attempt verification
4. ❌ Expected: Watermark extraction fails

### 13. Recent Changes & Fixes

Refer to `FIX_SUMMARY.md` and `TAMPERING_FIX.md` for detailed fix documentation.

#### Major Updates:
1. **Content Integrity Validation** (Security Enhancement)
   - Added content hash to watermark structure
   - Prevents tampering attacks where content is modified but watermark remains
   - Hash computation uses normalized text for resilience

2. **Text Extraction Consistency Fix** (Critical Bug Fix)
   - Unified text extraction to use `mammoth.extractRawText()` in both paths
   - Eliminated false verification failures on unmodified documents
   - Modified `readWatermarkedDocument()` implementation

3. **Backward Compatibility**
   - Optional content hash field in compact format
   - Graceful handling of legacy watermarks

#### Build Status
✅ TypeScript compilation: SUCCESS  
✅ All type checks pass  
✅ No runtime errors  
✅ Vite build completes successfully

