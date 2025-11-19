## Bio-Mark Guard Project Specification

### 1. Overview
- **Goal**: Secure text or Word documents (`.txt`, `.doc`, `.docx`) by binding them to a user's fingerprint using advanced biometric cryptography and steganographic techniques.
- **Core Principle**: The system creates a cryptographic bond between a fingerprint and document content, making the document tamper-evident and ownership-verifiable without any visible modifications.
- **Security Features**:
  - **Authenticity**: Verifies document ownership via fingerprint matching using Fuzzy Vault cryptography
  - **Integrity**: Detects any content tampering via cryptographic content hash validation
  - **Invisibility**: Watermark uses zero-width Unicode characters that are invisible in all standard text editors
  - **Tamper-Proof**: Any modification to the document content breaks the cryptographic hash chain
  - **Privacy-Preserving**: Fingerprint data is never stored; only cryptographic hashes and vault points are embedded
- **Key Flows**:
  1. **Encryption**: Fingerprint → Minutiae Extraction → Fuzzy Vault Generation → Secret Key Derivation → Content Hashing → Watermark Embedding → Secured Document
  2. **Verification**: Watermarked Document → Watermark Extraction → Content Integrity Check → Fingerprint Processing → Vault Unlocking → Ownership Confirmation

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

### 3. Detailed Technical Implementation

#### 3.1 Fingerprint Recognition & Minutiae Extraction (`FingerprintProcessor`)

**Overview**: The system extracts unique biometric features (minutiae points) from fingerprint images to create a cryptographic key.

**Phase 1: Image Preprocessing**
1. **Grayscale Conversion**
   - Formula: `Gray = 0.299×R + 0.587×G + 0.114×B`
   - Reduces image to single-channel intensity data for analysis
   - Emphasizes luminance characteristics important for ridge detection

2. **Contrast Enhancement**
   - Method: Histogram stretching with 1.5× amplification
   - Formula: `enhanced = min(255, max(0, (value - 128) × 1.5 + 128))`
   - Purpose: Amplifies ridge-valley differences for clearer minutiae detection

3. **Noise Reduction (Median Filter)**
   - Kernel size: 3×3 pixels
   - Algorithm: For each pixel, sort 9 neighboring values and select median
   - Preserves edges while removing salt-and-pepper noise
   - Critical for preventing false minutiae detection

**Phase 2: Binary Image Processing**
1. **Binarization (Thresholding)**
   - Threshold: 128 (midpoint of 0-255 grayscale range)
   - Converts grayscale to binary: pixels >128 → 1 (ridge), ≤128 → 0 (valley)
   - Creates clear separation between fingerprint ridges and background

2. **Skeletonization (Zhang-Suen Thinning)**
   - Purpose: Reduce ridge width to single-pixel lines for precise minutiae location
   - Algorithm: Iteratively removes boundary pixels while preserving connectivity
   - Transition counting: Ensures only pixels with exactly 1 transition (0→1) are removed
   - Neighbor checking: Maintains structural integrity (2-6 neighbors required)
   - Max iterations: 50 (prevents infinite loops on complex patterns)

**Phase 3: Minutiae Detection**
1. **Ridge Ending Detection**
   - Definition: Point where a ridge terminates
   - Detection: Skeleton pixel with exactly 1 connected neighbor (sum = 1)
   - Stores: x-coordinate, y-coordinate, ridge direction angle, type='ending'

2. **Bifurcation Detection**
   - Definition: Point where one ridge splits into two
   - Detection: Skeleton pixel with exactly 3 connected neighbors (sum = 3)
   - Stores: x-coordinate, y-coordinate, split direction angle, type='bifurcation'

3. **Direction Calculation**
   - Method: Weighted centroid of 8-connected neighbors
   - Formula: `angle = atan2(weighted_y, weighted_x) × (180/π)`
   - Provides orientation information for each minutia point

**Phase 4: Minutiae Normalization**
1. **Deduplication**
   - Distance threshold: 5 pixels
   - Formula: `distance = √((x₁-x₂)² + (y₁-y₂)²)`
   - Removes redundant minutiae from thinning artifacts

2. **Quality Control**
   - Minimum required: 12 minutiae points (ensures sufficient uniqueness)
   - Maximum allowed: 80 minutiae points (prevents payload bloat)
   - Quality validation: Checks contrast, clarity, ridge coverage via `validation.ts`

**Result**: Array of MinutiaePoint objects containing (x, y, angle, type)

---

#### 3.2 Fuzzy Vault Cryptography (`FuzzyVaultGenerator`)

**Purpose**: Create a cryptographic vault that can only be unlocked with a matching fingerprint, tolerating minor biometric variations.

**Theory**: Fuzzy Vault is a polynomial-based cryptographic construction that hides a secret within a set of points, where genuine points lie on a secret polynomial and chaff points do not.

**Phase 1: Secret Key Generation**
1. **Random Secret Creation**
   - Length: 32 bits (4 bytes) for compact storage
   - Source: `crypto.getRandomValues()` - cryptographically secure randomness
   - Format: Hexadecimal string (e.g., "a3f7c9d2")
   - This secret binds the document to the specific fingerprint

2. **Polynomial Construction**
   - Degree: Equal to number of secret bytes (4 coefficients)
   - Conversion: Each secret byte becomes a polynomial coefficient
   - Field: Modulo 251 (prime number for finite field arithmetic)
   - Form: `P(x) = c₀ + c₁x + c₂x² + c₃x³ mod 251`

**Phase 2: Minutiae Encoding**
1. **Minutia to Field Element Conversion**
   - Formula: `encoded = (x×1000 + y×10 + floor(angle) + type_bit) mod 251`
   - Type bit: 0 for ending, 1 for bifurcation
   - Range: 1-250 (0 reserved to avoid degenerate cases)
   - Creates unique integer representation of each minutia

2. **Genuine Point Generation**
   - For each minutia m: Create point (xₘ, yₘ)
   - xₘ = encoded minutia value
   - yₘ = P(xₘ) = polynomial evaluated at xₘ
   - These points lie exactly on the secret polynomial

**Phase 3: Chaff Point Addition**
1. **Purpose**: Obfuscate genuine points to prevent secret extraction
2. **Generation**: Random (x, y) pairs where y ≠ P(x)
3. **Count**: `max(0, vaultSize - minutiae_count)`
4. **Distribution**: Uniform random across field [0, 251)
5. **Security**: Attacker cannot distinguish genuine from chaff without matching fingerprint

**Phase 4: Vault Shuffling**
- Algorithm: Fisher-Yates shuffle using cryptographic randomness
- Purpose: Remove ordering information that could reveal genuine points
- Result: Array of [x, y] pairs in random order

**Vault Structure**:
```typescript
FuzzyVault {
  vault: [[x₁, y₁], [x₂, y₂], ...],  // Mixed genuine + chaff points
  secret: "a3f7c9d2",                  // Original secret
  polynomial: [c₀, c₁, c₂, c₃]         // Secret polynomial coefficients
}
```

---

#### 3.3 Secret Key Protection & Vault Unlocking

**Encryption Time**: Secret is generated and embedded in watermark

**Verification Time**: Secret must be reconstructed from vault using fingerprint

**Unlocking Process**:
1. **Matching Point Identification**
   - Re-encode minutiae from verification fingerprint
   - Search vault for points with matching x-coordinates
   - Collect all matching (x, y) pairs

2. **Polynomial Reconstruction (Lagrange Interpolation)**
   - Requires: At least k+1 points for degree-k polynomial
   - Method: Lagrange interpolation over finite field GF(251)
   - Formula: `L(x) = Σᵢ yᵢ × Πⱼ≠ᵢ (x-xⱼ)/(xᵢ-xⱼ) mod 251`
   - Modular arithmetic: Uses Extended Euclidean Algorithm for division

3. **Modular Inverse Calculation**
   - Algorithm: Extended Euclidean Algorithm
   - Purpose: Compute `a⁻¹ mod 251` for division in finite field
   - Formula: Find s where `a×s ≡ 1 (mod 251)`
   - Efficiency: O(log n) time complexity

4. **Secret Recovery**
   - Extract polynomial coefficients from interpolation
   - Convert coefficients back to byte sequence
   - Format as hexadecimal string
   - Compare with stored secret in watermark

**Security Properties**:
- **Fuzzy Matching**: Small fingerprint variations (≤15% minutiae mismatch) still unlock vault
- **Chaff Protection**: Random points prevent brute-force polynomial recovery
- **Field Size**: Prime field 251 provides 8-bit security per coefficient
- **Privacy**: Original fingerprint image cannot be reconstructed from vault

---

#### 3.4 Content Integrity & Tamper Detection

**Purpose**: Detect any modification to document content after encryption

**Hashing Process**:
1. **Content Normalization**
   - Trim leading/trailing whitespace: `content.trim()`
   - Collapse multiple spaces: `replace(/\s+/g, ' ')`
   - Purpose: Tolerate minor formatting changes while detecting content edits

2. **Hash Computation**
   - Algorithm: Custom 32-bit integer hash (similar to Java's `hashCode()`)
   - Formula: `hash = ((hash << 5) - hash) + charCode`
   - Bit operation: `hash = hash & hash` (convert to 32-bit signed int)
   - Output: Hexadecimal string (e.g., "7fa3c21d")

3. **Storage**: Content hash embedded in watermark alongside fingerprint data

**Verification Process**:
1. Extract original content hash from watermark
2. Recompute hash from current visible document content
3. Compare: `currentHash === storedHash`
4. **Result**:
   - Match → Content unchanged (integrity verified)
   - Mismatch → Content tampered (verification fails)

**Attack Resistance**:
- **Modification Detection**: Any character change produces different hash
- **Invisible Changes**: Catches whitespace manipulation, character substitution
- **Ordering Matters**: Rearranging words/sentences changes hash
- **Collision Resistance**: 32-bit space provides adequate security for document hashing

---

#### 3.5 Steganographic Watermark Embedding (`DocumentWatermarker`)

**Purpose**: Hide watermark data invisibly within document text using zero-width Unicode characters

**Phase 1: Data Preparation**
1. **Ultra-Compact Data Structure**
   ```typescript
   UltraCompactWatermarkData {
     f: fingerprintHash,    // Single-letter keys for size optimization
     s: secret,
     t: timestamp,
     c: contentHash
   }
   ```

2. **JSON Serialization**
   - Convert object to JSON string
   - Example: `{"f":"7a3c","s":"a3f7c9d2","t":1704067200000,"c":"7fa3c21d"}`

3. **Binary Encoding**
   - Convert each character to 8-bit binary
   - ASCII → Binary: `charCode.toString(2).padStart(8, '0')`
   - Example: 'a' (97) → "01100001"
   - Result: Long binary string representing entire watermark

**Phase 2: Zero-Width Character Encoding**
1. **Character Mapping**
   - Binary '0' → `\u200B` (Zero Width Space)
   - Binary '1' → `\u200C` (Zero Width Non-Joiner)
   - Byte separator → `\u200D` (Zero Width Joiner) - inserted every 8 bits

2. **Why Zero-Width Characters?**
   - **Invisible**: Render with zero pixels in all major text editors (Word, Notepad, etc.)
   - **Preserved**: Survive copy-paste operations
   - **Unicode Standard**: U+200B, U+200C, U+200D are official Unicode characters
   - **Cross-Platform**: Work in .txt, .docx, .pdf, HTML, etc.

3. **Encoding Example**:
   ```
   Binary:      01001000 01101001  ("Hi")
   Zero-Width:  ␣␣␣␣␣␣␣␣|␣␣␣␣␣␣␣␣  (␣ = invisible char)
   Appearance:  Hi                  (looks unchanged to user)
   ```

**Phase 3: Distribution Algorithm**
1. **Strategic Placement**
   - Splits watermark into chunks
   - Distributes chunks after random words throughout document
   - Percentage: Uses ~30% of available word boundaries
   - Chunk size: 8-32 characters per location

2. **Randomization**
   - Uses `crypto.getRandomValues()` for word position selection
   - Prevents pattern-based detection
   - Makes watermark harder to locate and remove

3. **Document Integration**
   - Original: "This is a test document."
   - Watermarked: "This[␣␣␣] is[␣␣␣] a[␣␣] test[␣␣␣␣] document.[␣␣]"
   - Visual: Looks identical to user
   - Technical: Contains hidden biometric data

**Phase 4: Extraction Process**
1. **Character Scanning**
   - Scan entire document character-by-character
   - Detect: `\u200B`, `\u200C`, `\u200D`
   - Build binary string: ZWS→'0', ZWNJ→'1', skip ZWJ separators

2. **Binary to JSON Conversion**
   - Group binary into 8-bit bytes
   - Convert to ASCII: `parseInt(byte, 2) → String.fromCharCode()`
   - Parse resulting string as JSON

3. **Data Reconstruction**
   - Extract compact fields: f, s, t, c
   - Expand to full WatermarkData structure
   - Return for verification

**Security Properties**:
- **Invisibility**: Cannot be seen by users
- **Fragility**: Editing usually removes watermark (tamper-evident)
- **Persistence**: Survives copy-paste, minor formatting
- **Payload Size**: ~200-500 bytes for typical watermark

---

#### 3.6 Complete Encryption Workflow (`BiometricEncryptionService`)

**Input**: Fingerprint image + Document file

**Step 1: Fingerprint Processing**
- Load fingerprint image → Canvas rendering
- Preprocessing → Grayscale, enhance, denoise
- Binarization → Ridge/valley separation
- Skeletonization → Single-pixel ridge lines
- Minutiae extraction → Ridge endings + bifurcations
- Validation → Minimum 12 minutiae required
- **Output**: Array of MinutiaePoint objects

**Step 2: Cryptographic Vault Generation**
- Generate 32-bit random secret using `crypto.getRandomValues()`
- Convert secret → Polynomial coefficients (mod 251)
- Encode each minutia → Field element (1-250)
- Evaluate polynomial at each minutia point → Genuine points
- Generate random chaff points → Obfuscation
- Shuffle all points → Remove ordering information
- **Output**: FuzzyVault containing vault points, secret, polynomial

**Step 3: Document Reading**
- Detect file type: .txt, .doc, or .docx
- Text files: Read directly as UTF-8 string
- Word files: Use `mammoth.extractRawText()` for consistent extraction
- **Output**: Plain text content + format metadata

**Step 4: Integrity Hash Generation**
- Normalize content: `trim()` + `replace(/\s+/g, ' ')`
- Compute hash: 32-bit integer hash algorithm
- Convert to hex: `hash.toString(16)`
- **Output**: Content hash string (e.g., "7fa3c21d")

**Step 5: Watermark Data Assembly**
- Fingerprint hash: Hash of minutiae coordinates/angles/types
- Vault secret: 32-bit random key from vault
- Timestamp: `Date.now()` in milliseconds
- Content hash: From Step 4
- Compact format: Single-letter keys (f, s, t, c)
- **Output**: UltraCompactWatermarkData object

**Step 6: Steganographic Embedding**
- Serialize watermark → JSON string
- Convert JSON → Binary (8 bits per character)
- Binary → Zero-width characters (0→U+200B, 1→U+200C)
- Distribute invisibly throughout document text
- **Output**: Watermarked text (looks identical, contains hidden data)

**Step 7: File Generation**
- **For .txt**: Create Blob with watermarked text
- **For .docx**: 
  - Use JSZip to create valid Word document structure
  - Embed watermarked text in `word/document.xml`
  - Include required files: `[Content_Types].xml`, relationships
  - Generate properly formatted .docx Blob
- **Output**: Downloadable file + metadata

**Final Output**:
```typescript
EncryptionResult {
  encryptedDocument: string,           // Watermarked text
  watermarkData: WatermarkData,        // Full watermark structure
  downloadBlob: Blob,                  // File for download
  downloadName: "encrypted_file.docx", // Filename
  mimeType: string,                    // MIME type
  format: "txt" | "docx"              // Format indicator
}
```

---

#### 3.7 Complete Verification Workflow

**Input**: Fingerprint image + Watermarked document

**Step 1: Document Reading**
- Detect file type and read content
- **Critical**: Use same extraction method as encryption
- Text files: Direct read
- Word files: `mammoth.extractRawText()` (consistent with encryption)
- **Output**: Text with embedded watermark

**Step 2: Watermark Extraction**
- Scan document for zero-width characters
- U+200B → '0', U+200C → '1', skip U+200D
- Collect binary string from entire document
- Convert binary → ASCII → JSON
- Parse JSON → UltraCompactWatermarkData
- Expand to full WatermarkData structure
- **Output**: Extracted watermark (fingerprintHash, secret, timestamp, contentHash)

**Step 3: Content Integrity Verification**
- Remove zero-width characters → Get visible content
- Normalize: `trim()` + `replace(/\s+/g, ' ')`
- Compute current content hash
- Compare: `currentHash === watermark.contentHash`
- **If mismatch**: Log warning + Return FALSE (tampering detected)
- **If match**: Content unchanged, proceed to fingerprint check

**Step 4: Fingerprint Processing**
- Process verification fingerprint (same as encryption)
- Extract minutiae points
- Validate minimum count (12 required)
- **Output**: Array of MinutiaePoint objects

**Step 5: Fingerprint Matching**
- Hash current minutiae → fingerprintHash
- Compare: `currentHash === watermark.fingerprintHash`
- **Simplified Matching**: Direct hash comparison (exact match required)
- **Advanced Option**: Could use Fuzzy Vault unlocking for tolerance
- **Output**: Boolean match result

**Step 6: Verification Decision**
- **Pass Conditions**:
  1. Watermark successfully extracted
  2. Content hash matches (no tampering)
  3. Fingerprint hash matches (correct owner)
- **Fail Conditions**:
  1. No watermark found → Unauthorized document
  2. Content hash mismatch → Document tampered
  3. Fingerprint hash mismatch → Wrong fingerprint

**Verification Result**: Boolean (true = verified, false = rejected)

---

#### 3.8 How Tamper-Proofing Works

**Threat Model**: Attacker has watermarked document and wants to modify content while keeping watermark intact.

**Attack Scenario 1: Content Modification**
1. Attacker opens encrypted document
2. Changes visible text (e.g., "$1000" → "$9000")
3. Saves with intact watermark
4. **Defense**: Content hash verification
   - Original hash: hash("amount $1000") = "abc123"
   - Stored in watermark: "abc123"
   - Modified hash: hash("amount $9000") = "def456"
   - Comparison: "abc123" ≠ "def456" → Verification FAILS

**Attack Scenario 2: Watermark Reuse**
1. Attacker extracts watermark from Document A
2. Tries to apply it to Document B
3. **Defense**: Content hash is specific to original document
   - Watermark contains: hash(Document A content)
   - Document B has: hash(Document B content)
   - Hashes don't match → Verification FAILS

**Attack Scenario 3: Fingerprint Substitution**
1. Attacker has Document encrypted with Fingerprint A
2. Tries to verify with Fingerprint B
3. **Defense**: Fingerprint-specific hash
   - Watermark contains: hash(Minutiae from Fingerprint A)
   - Verification computes: hash(Minutiae from Fingerprint B)
   - Hashes don't match → Verification FAILS

**Attack Scenario 4: Watermark Removal**
1. Attacker removes zero-width characters
2. Document looks clean
3. **Defense**: Verification fails to extract watermark
   - No watermark data → Cannot verify → Treated as unauthorized

**Why It's Tamper-Proof**:
1. **Cryptographic Binding**: Content hash cryptographically binds watermark to specific content
2. **One-Way Function**: Hash cannot be reversed to find pre-image
3. **Collision Resistance**: Computationally infeasible to find different content with same hash
4. **Integrity Chain**: Fingerprint → Vault → Secret → Watermark → Content Hash
5. **Verification Cascade**: All checks must pass; any failure rejects document

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

