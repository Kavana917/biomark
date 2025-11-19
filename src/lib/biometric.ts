import {
  createDocxFromText,
  DOCX_MIME,
  DocumentFormat,
  embedPayloadInDocx,
  isDocLikeFile,
  readDocxXmlText,
  readDocumentAsPlainText,
} from "./docx-handler";

// Biometric processing utilities for fingerprint analysis and Fuzzy Vault implementation

export interface MinutiaePoint {
  x: number;
  y: number;
  angle: number;
  type: 'ending' | 'bifurcation';
}

export interface FuzzyVault {
  vault: number[][];
  secret: string;
  polynomial: number[];
}

export interface WatermarkData {
  fingerprintHash: string;
  vault: FuzzyVault;
  timestamp: number;
  contentHash: string; // Hash of the original visible content
}

export interface CompactWatermarkData {
  fh: string; // fingerprintHash (shortened)
  s: string;  // secret (shortened)
  v: number[][]; // vault points (shortened)
  t: number;  // timestamp (shortened)
  c?: string; // contentHash (shortened, optional for backward compatibility)
}

export interface UltraCompactWatermarkData {
  f: string; // fingerprintHash (ultra short)
  s: string; // secret (ultra short)
  t: number; // timestamp (ultra short)
  c: string; // contentHash (ultra short)
}

export interface WatermarkEmbeddingResult {
  watermarkedText: string;
  invisiblePayload: string;
}

export interface EncryptionResult {
  encryptedDocument: string;
  watermarkData: WatermarkData;
  downloadBlob: Blob;
  downloadName: string;
  mimeType: string;
  format: DocumentFormat;
}

/**
 * Phase 1: Fingerprint preprocessing and minutiae extraction
 */
export class FingerprintProcessor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private readonly MIN_MINUTIAE = 12;
  private readonly MAX_MINUTIAE = 80;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  /**
   * Process fingerprint image and extract minutiae points
   */
  async processFingerprint(imageFile: File): Promise<MinutiaePoint[]> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          // Set canvas dimensions
          this.canvas.width = img.width;
          this.canvas.height = img.height;

          // Draw image to canvas
          this.ctx.drawImage(img, 0, 0);

          // Get image data
          const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
          
          // Convert to grayscale and enhance
          const processedData = this.preprocessImage(imageData);
          
          // Extract minutiae points
          const minutiae = this.extractMinutiae(processedData);
          const normalizedMinutiae = this.normalizeMinutiae(minutiae);

          if (normalizedMinutiae.length < this.MIN_MINUTIAE) {
            reject(new Error(`Fingerprint quality insufficient: detected ${normalizedMinutiae.length} minutiae; at least ${this.MIN_MINUTIAE} are required.`));
            return;
          }
          
          resolve(normalizedMinutiae);
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(imageFile);
    });
  }

  /**
   * Preprocess image: convert to grayscale, enhance contrast, reduce noise
   */
  private preprocessImage(imageData: ImageData): ImageData {
    const { data, width, height } = imageData;
    const processedData = new Uint8ClampedArray(data.length);

    // Convert to grayscale and enhance contrast
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      const enhanced = this.enhanceContrast(gray);
      
      processedData[i] = enhanced;     // R
      processedData[i + 1] = enhanced; // G
      processedData[i + 2] = enhanced; // B
      processedData[i + 3] = data[i + 3]; // A
    }

    // Apply noise reduction (simple median filter)
    const denoisedData = this.applyMedianFilter(processedData, width, height);

    return new ImageData(new Uint8ClampedArray(denoisedData), width, height);
  }

  /**
   * Enhance contrast using histogram equalization
   */
  private enhanceContrast(value: number): number {
    // Simple contrast enhancement
    return Math.min(255, Math.max(0, (value - 128) * 1.5 + 128));
  }

  /**
   * Apply median filter for noise reduction
   */
  private applyMedianFilter(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    const filtered = new Uint8ClampedArray(data.length);
    const kernelSize = 3;
    const offset = Math.floor(kernelSize / 2);

    for (let y = offset; y < height - offset; y++) {
      for (let x = offset; x < width - offset; x++) {
        const idx = (y * width + x) * 4;
        const neighbors: number[] = [];

        // Collect neighboring pixel values
        for (let ky = -offset; ky <= offset; ky++) {
          for (let kx = -offset; kx <= offset; kx++) {
            const neighborIdx = ((y + ky) * width + (x + kx)) * 4;
            neighbors.push(data[neighborIdx]);
          }
        }

        // Sort and get median
        neighbors.sort((a, b) => a - b);
        const median = neighbors[Math.floor(neighbors.length / 2)];

        filtered[idx] = median;
        filtered[idx + 1] = median;
        filtered[idx + 2] = median;
        filtered[idx + 3] = data[idx + 3];
      }
    }

    return filtered;
  }

  /**
   * Extract minutiae points from processed image
   */
  private extractMinutiae(imageData: ImageData): MinutiaePoint[] {
    const { data, width, height } = imageData;
    const minutiae: MinutiaePoint[] = [];

    // Convert to binary image (threshold)
    const binaryData = this.binarizeImage(data);
    
    // Apply skeletonization (thinning)
    const skeletonData = this.skeletonize(binaryData, width, height);
    
    // Find minutiae points
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        
        if (skeletonData[idx] === 1) {
          const minutia = this.analyzeMinutia(skeletonData, x, y, width, height);
          if (minutia) {
            minutiae.push(minutia);
          }
        }
      }
    }

    return minutiae;
  }

  /**
   * Convert grayscale image to binary
   */
  private binarizeImage(data: Uint8ClampedArray): number[] {
    const binary: number[] = [];
    const threshold = 128;

    for (let i = 0; i < data.length; i += 4) {
      binary.push(data[i] > threshold ? 1 : 0);
    }

    return binary;
  }

  /**
   * Apply skeletonization to binary image
   */
  private skeletonize(binaryData: number[], width: number, height: number): number[] {
    const skeleton = [...binaryData];
    let changed = true;
    let iterations = 0;
    const maxIterations = 50;

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      // Zhang-Suen thinning algorithm (simplified)
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = y * width + x;
          
          if (skeleton[idx] === 1) {
            const neighbors = this.getNeighbors(skeleton, x, y, width, height);
            const transitions = this.countTransitions(neighbors);
            
            if (transitions === 1 && this.shouldRemove(neighbors)) {
              skeleton[idx] = 0;
              changed = true;
            }
          }
        }
      }
    }

    return skeleton;
  }

  /**
   * Get 8-connected neighbors
   */
  private getNeighbors(data: number[], x: number, y: number, width: number, height: number): number[] {
    const neighbors: number[] = [];
    const positions = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1]
    ];

    for (const [dx, dy] of positions) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        neighbors.push(data[ny * width + nx]);
      } else {
        neighbors.push(0);
      }
    }

    return neighbors;
  }

  /**
   * Count transitions from 0 to 1 in neighbor sequence
   */
  private countTransitions(neighbors: number[]): number {
    let transitions = 0;
    for (let i = 0; i < neighbors.length; i++) {
      const current = neighbors[i];
      const next = neighbors[(i + 1) % neighbors.length];
      if (current === 0 && next === 1) {
        transitions++;
      }
    }
    return transitions;
  }

  /**
   * Determine if pixel should be removed during thinning
   */
  private shouldRemove(neighbors: number[]): boolean {
    const sum = neighbors.reduce((a, b) => a + b, 0);
    return sum >= 2 && sum <= 6;
  }

  /**
   * Analyze minutia type and properties
   */
  private analyzeMinutia(skeletonData: number[], x: number, y: number, width: number, height: number): MinutiaePoint | null {
    const neighbors = this.getNeighbors(skeletonData, x, y, width, height);
    const sum = neighbors.reduce((a, b) => a + b, 0);

    if (sum === 1) {
      // Ridge ending
      return {
        x,
        y,
        angle: this.calculateAngle(neighbors),
        type: 'ending'
      };
    } else if (sum === 3) {
      // Bifurcation
      return {
        x,
        y,
        angle: this.calculateAngle(neighbors),
        type: 'bifurcation'
      };
    }

    return null;
  }

  /**
   * Deduplicate minutiae that are too close together and cap the total count
   */
  private normalizeMinutiae(minutiae: MinutiaePoint[]): MinutiaePoint[] {
    const filtered: MinutiaePoint[] = [];

    for (const point of minutiae) {
      const isTooClose = filtered.some(
        existing => Math.hypot(existing.x - point.x, existing.y - point.y) < 5
      );

      if (!isTooClose) {
        filtered.push(point);
      }

      if (filtered.length >= this.MAX_MINUTIAE) {
        break;
      }
    }

    return filtered;
  }

  /**
   * Calculate ridge direction angle
   */
  private calculateAngle(neighbors: number[]): number {
    // Simplified angle calculation based on neighbor pattern
    const positions = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1]
    ];

    let weightedX = 0;
    let weightedY = 0;

    for (let i = 0; i < neighbors.length; i++) {
      if (neighbors[i] === 1) {
        weightedX += positions[i][0];
        weightedY += positions[i][1];
      }
    }

    return Math.atan2(weightedY, weightedX) * (180 / Math.PI);
  }
}

/**
 * Phase 2: Fuzzy Vault implementation for biometric key generation
 */
export class FuzzyVaultGenerator {
  private readonly fieldSize: number = 251; // Prime field size
  private readonly vaultSize: number = 5; // Much smaller vault for minimal size

  /**
   * Generate Fuzzy Vault from minutiae points
   */
  generateVault(minutiae: MinutiaePoint[]): FuzzyVault {
    // Generate random secret key
    const secret = this.generateSecret();
    
    // Convert secret to polynomial coefficients
    const polynomial = this.secretToPolynomial(secret);
    
    // Generate vault points
    const vault = this.generateVaultPoints(minutiae, polynomial);
    
    return {
      vault,
      secret,
      polynomial
    };
  }

  /**
   * Generate random secret key
   */
  private generateSecret(): string {
    const bytes = new Uint8Array(4); // 32-bit key (much smaller)
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Convert secret to polynomial coefficients
   */
  private secretToPolynomial(secret: string): number[] {
    const coefficients: number[] = [];
    const secretBytes = this.hexToBytes(secret);
    
    // Use secret bytes as polynomial coefficients
    for (let i = 0; i < secretBytes.length; i++) {
      coefficients.push(secretBytes[i] % this.fieldSize);
    }
    
    return coefficients;
  }

  /**
   * Generate vault points from minutiae and polynomial
   */
  private generateVaultPoints(minutiae: MinutiaePoint[], polynomial: number[]): number[][] {
    const vault: number[][] = [];
    
    // Add real points (minutiae-based)
    for (const minutia of minutiae) {
      const x = this.encodeMinutia(minutia);
      const y = this.evaluatePolynomial(polynomial, x);
      vault.push([x, y]);
    }
    
    // Add chaff points (fake points)
    const chaffCount = Math.max(0, this.vaultSize - minutiae.length);
    for (let i = 0; i < chaffCount; i++) {
      const x = Math.floor(Math.random() * this.fieldSize);
      const y = Math.floor(Math.random() * this.fieldSize);
      vault.push([x, y]);
    }
    
    // Shuffle vault points
    return this.shuffleArray(vault);
  }

  /**
   * Encode minutia point to field element
   */
  private encodeMinutia(minutia: MinutiaePoint): number {
    // Combine x, y, angle, and type into a single field element
    const combined = (minutia.x * 1000 + minutia.y * 10 + Math.floor(minutia.angle) + (minutia.type === 'bifurcation' ? 1 : 0)) % this.fieldSize;
    return Math.max(1, combined); // Ensure non-zero
  }

  /**
   * Evaluate polynomial at given point
   */
  private evaluatePolynomial(coefficients: number[], x: number): number {
    let result = 0;
    let power = 1;
    
    for (const coeff of coefficients) {
      result = (result + coeff * power) % this.fieldSize;
      power = (power * x) % this.fieldSize;
    }
    
    return result;
  }

  /**
   * Convert hex string to bytes
   */
  private hexToBytes(hex: string): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
  }

  /**
   * Shuffle array randomly
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Attempt to unlock vault with minutiae points
   */
  unlockVault(vault: FuzzyVault, minutiae: MinutiaePoint[]): string | null {
    try {
      // Find matching points
      const matchingPoints = this.findMatchingPoints(vault.vault, minutiae);
      
      if (matchingPoints.length < vault.polynomial.length) {
        return null; // Not enough points to reconstruct polynomial
      }
      
      // Reconstruct polynomial using Lagrange interpolation
      const reconstructedPolynomial = this.lagrangeInterpolation(matchingPoints);
      
      // Convert polynomial back to secret
      const secret = this.polynomialToSecret(reconstructedPolynomial);
      
      return secret;
    } catch (error) {
      return null;
    }
  }

  /**
   * Find points in vault that match given minutiae
   */
  private findMatchingPoints(vault: number[][], minutiae: MinutiaePoint[]): number[][] {
    const matching: number[][] = [];
    
    for (const minutia of minutiae) {
      const encodedX = this.encodeMinutia(minutia);
      
      for (const point of vault) {
        if (point[0] === encodedX) {
          matching.push(point);
          break;
        }
      }
    }
    
    return matching;
  }

  /**
   * Lagrange interpolation to reconstruct polynomial
   */
  private lagrangeInterpolation(points: number[][]): number[] {
    const n = points.length;
    const coefficients: number[] = new Array(n).fill(0);
    
    for (let i = 0; i < n; i++) {
      const [xi, yi] = points[i];
      let term = new Array(n).fill(0);
      term[0] = yi;
      
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          const [xj] = points[j];
          const denominator = this.modInverse((xi - xj + this.fieldSize) % this.fieldSize, this.fieldSize);
          
          // Multiply by (x - xj) / (xi - xj)
          const newTerm = new Array(n).fill(0);
          for (let k = 0; k < n; k++) {
            newTerm[k] = (term[k] * denominator) % this.fieldSize;
            if (k > 0) {
              newTerm[k] = (newTerm[k] - term[k - 1] * xj * denominator) % this.fieldSize;
            }
          }
          term = newTerm;
        }
      }
      
      // Add to coefficients
      for (let k = 0; k < n; k++) {
        coefficients[k] = (coefficients[k] + term[k]) % this.fieldSize;
      }
    }
    
    return coefficients;
  }

  /**
   * Convert polynomial back to secret
   */
  private polynomialToSecret(polynomial: number[]): string {
    const bytes: number[] = [];
    for (const coeff of polynomial) {
      bytes.push(coeff);
    }
    return bytes.map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Modular inverse using extended Euclidean algorithm
   */
  private modInverse(a: number, m: number): number {
    let [oldR, r] = [a, m];
    let [oldS, s] = [1, 0];
    
    while (r !== 0) {
      const quotient = Math.floor(oldR / r);
      [oldR, r] = [r, oldR - quotient * r];
      [oldS, s] = [s, oldS - quotient * s];
    }
    
    return oldS < 0 ? oldS + m : oldS;
  }
}

/**
 * Phase 3: Watermark embedding in text documents
 */
export class DocumentWatermarker {
  /**
   * Embed watermark in text document
   */
  embedWatermark(text: string, watermarkData: WatermarkData): WatermarkEmbeddingResult {
    // Convert to ultra-compact format to minimize size
    const ultraCompactData: UltraCompactWatermarkData = {
      f: watermarkData.fingerprintHash,
      s: watermarkData.vault.secret,
      t: watermarkData.timestamp,
      c: watermarkData.contentHash
    };
    
    // Convert ultra-compact watermark data to binary
    const watermarkBinary = this.dataToBinary(ultraCompactData);
    const invisiblePayload = this.binaryToInvisibleText(watermarkBinary);
    
    // Embed using zero-width characters
    const watermarkedText = this.embedWithZeroWidth(text, invisiblePayload);
    
    return { watermarkedText, invisiblePayload };
  }

  /**
   * Extract watermark from text document
   */
  extractWatermark(text: string): WatermarkData | null {
    try {
      // Extract binary data from zero-width characters
      const watermarkBinary = this.extractFromZeroWidth(text);
      
      if (!watermarkBinary) {
        return null;
      }
      
      // Convert binary back to ultra-compact watermark data
      const ultraCompactData = this.binaryToData(watermarkBinary) as UltraCompactWatermarkData;
      
      // Convert ultra-compact data back to full format
      const watermarkData: WatermarkData = {
        fingerprintHash: ultraCompactData.f,
        vault: {
          vault: [], // Empty vault - we'll use simplified verification
          secret: ultraCompactData.s,
          polynomial: [] // Will be reconstructed during verification
        },
        timestamp: ultraCompactData.t,
        contentHash: ultraCompactData.c || '' // Backward compatibility for old watermarks
      };
      
      return watermarkData;
    } catch (error) {
      return null;
    }
  }

  /**
   * Convert watermark data to binary string
   */
  private dataToBinary(data: WatermarkData | CompactWatermarkData | UltraCompactWatermarkData): string {
    const jsonString = JSON.stringify(data);
    let binary = '';
    
    for (let i = 0; i < jsonString.length; i++) {
      const charCode = jsonString.charCodeAt(i);
      binary += charCode.toString(2).padStart(8, '0');
    }
    
    return binary;
  }

  /**
   * Convert binary string back to watermark data
   */
  private binaryToData(binary: string): WatermarkData | CompactWatermarkData | UltraCompactWatermarkData {
    let jsonString = '';
    
    for (let i = 0; i < binary.length; i += 8) {
      const byte = binary.substr(i, 8);
      const charCode = parseInt(byte, 2);
      jsonString += String.fromCharCode(charCode);
    }
    
    return JSON.parse(jsonString);
  }

  /**
   * Embed binary data using invisible Unicode characters distributed through the text
   */
  private embedWithZeroWidth(text: string, payload: string): string {
    return this.distributeInvisiblePayload(text, payload);
  }

  /**
   * Convert binary to invisible text using zero-width characters
   */
  private binaryToInvisibleText(binary: string): string {
    let invisibleText = '';
    const ZERO_BIT = '\u200B'; // Zero Width Space
    const ONE_BIT = '\u200C';  // Zero Width Non-Joiner
    const SEPARATOR = '\u200D'; // Zero Width Joiner as safe delimiter every 8 bits

    for (let i = 0; i < binary.length; i++) {
      invisibleText += binary[i] === '1' ? ONE_BIT : ZERO_BIT;
      if ((i + 1) % 8 === 0 && i !== binary.length - 1) {
        invisibleText += SEPARATOR;
      }
    }

    return invisibleText;
  }

  /**
   * Extract binary data from invisible characters
   */
  private extractFromZeroWidth(text: string): string | null {
    const ZERO_BIT = '\u200B';
    const ONE_BIT = '\u200C';
    const SEPARATOR = '\u200D';
    const collected: string[] = [];

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === ZERO_BIT) {
        collected.push('0');
      } else if (char === ONE_BIT) {
        collected.push('1');
      } else if (char === SEPARATOR) {
        continue;
      }
    }

    if (!collected.length) {
      return null;
    }

    return collected.join('');
  }

  /**
   * Convert invisible text back to binary
   */
  private invisibleTextToBinary(invisibleText: string): string {
    const ZERO_BIT = '\u200B';
    const ONE_BIT = '\u200C';
    const SEPARATOR = '\u200D';
    const bits: string[] = [];

    for (let i = 0; i < invisibleText.length; i++) {
      const char = invisibleText[i];
      if (char === ZERO_BIT) {
        bits.push('0');
      } else if (char === ONE_BIT) {
        bits.push('1');
      } else if (char === SEPARATOR) {
        continue;
      } else {
        // Unknown character - stop processing to avoid corruption
        break;
      }
    }

    return bits.join('');
  }

  /**
   * Distribute invisible payload across the document between words
   */
  private distributeInvisiblePayload(text: string, payload: string): string {
    if (!payload) {
      return text;
    }

    const tokens = text.split(/(\s+)/);
    if (tokens.length === 0) {
      return payload + text;
    }

    const wordIndexes: number[] = [];
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].trim().length > 0 && !/^\s+$/.test(tokens[i])) {
        wordIndexes.push(i);
      }
    }

    if (wordIndexes.length === 0) {
      return payload + text;
    }

    const maxSlots = Math.max(1, Math.floor(wordIndexes.length * 0.3));
    const minSlots = Math.max(1, Math.ceil(payload.length / 32));
    const slotsToUse = Math.min(wordIndexes.length, Math.max(1, Math.min(maxSlots, minSlots)));
    const selectedSlots = this.pickRandomWordSlots(wordIndexes, slotsToUse).sort((a, b) => a - b);

    const chunkSize = Math.max(8, Math.ceil(payload.length / selectedSlots.length));
    let payloadIndex = 0;

    for (const slot of selectedSlots) {
      if (payloadIndex >= payload.length) {
        break;
      }
      const chunk = payload.slice(payloadIndex, payloadIndex + chunkSize);
      payloadIndex += chunk.length;
      tokens[slot] = tokens[slot] + chunk;
    }

    if (payloadIndex < payload.length) {
      const lastSlot = selectedSlots[selectedSlots.length - 1];
      tokens[lastSlot] = tokens[lastSlot] + payload.slice(payloadIndex);
    }

    return tokens.join('');
  }

  private pickRandomWordSlots(wordIndexes: number[], count: number): number[] {
    if (count >= wordIndexes.length) {
      return [...wordIndexes];
    }

    const selected = new Set<number>();
    const total = wordIndexes.length;
    const randomBuffer = new Uint32Array(count * 2);

    let attempts = 0;
    while (selected.size < count && attempts < count * 5) {
      crypto.getRandomValues(randomBuffer);
      for (let i = 0; i < randomBuffer.length && selected.size < count; i++) {
        const randomIndex = randomBuffer[i] % total;
        selected.add(wordIndexes[randomIndex]);
      }
      attempts++;
    }

    return Array.from(selected);
  }
}

/**
 * Main encryption service that orchestrates all phases
 */
export class BiometricEncryptionService {
  private fingerprintProcessor: FingerprintProcessor;
  private fuzzyVaultGenerator: FuzzyVaultGenerator;
  private documentWatermarker: DocumentWatermarker;

  constructor() {
    this.fingerprintProcessor = new FingerprintProcessor();
    this.fuzzyVaultGenerator = new FuzzyVaultGenerator();
    this.documentWatermarker = new DocumentWatermarker();
  }

  /**
   * Encrypt document with fingerprint
   */
  async encryptDocument(
    fingerprintFile: File,
    documentFile: File
  ): Promise<EncryptionResult> {
    // Phase 1: Process fingerprint
    const minutiae = await this.fingerprintProcessor.processFingerprint(fingerprintFile);
    
    // Phase 2: Generate Fuzzy Vault
    const vault = this.fuzzyVaultGenerator.generateVault(minutiae);
    
    // Phase 3: Read document
    const { text: documentText, format } = await this.readDocument(documentFile);
    
    // Phase 4: Create watermark data with content hash
    const contentHash = this.hashContent(documentText);
    const watermarkData: WatermarkData = {
      fingerprintHash: this.hashMinutiae(minutiae),
      vault,
      timestamp: Date.now(),
      contentHash
    };
    
    // Phase 5: Embed watermark
    const embedding = this.documentWatermarker.embedWatermark(documentText, watermarkData);
    const encryptedDocument = embedding.watermarkedText;

    // Phase 6: Prepare download artifact (TXT or DOCX Blob)
    const isLegacyDoc = documentFile.name?.toLowerCase().endsWith(".doc");
    let downloadBlob: Blob;

    if (format === "docx" && !isLegacyDoc) {
      try {
        downloadBlob = await embedPayloadInDocx(documentFile, embedding.invisiblePayload);
      } catch (error) {
        console.warn("Failed to preserve DOCX formatting, falling back to regenerated file.", error);
        downloadBlob = await createDocxFromText(encryptedDocument);
      }
    } else if (format === "docx") {
      downloadBlob = await createDocxFromText(encryptedDocument);
    } else {
      downloadBlob = new Blob([encryptedDocument], { type: "text/plain" });
    }

    const downloadName = this.buildDownloadName(documentFile.name, format);
    const mimeType = format === "docx" ? DOCX_MIME : "text/plain";
    
    return {
      encryptedDocument,
      watermarkData,
      downloadBlob,
      downloadName,
      mimeType,
      format
    };
  }

  /**
   * Verify document ownership
   */
  async verifyDocument(
    fingerprintFile: File,
    encryptedDocument: string | File
  ): Promise<boolean> {
    try {
      const encryptedText =
        typeof encryptedDocument === "string"
          ? encryptedDocument
          : await this.readWatermarkedDocument(encryptedDocument);

      // Extract watermark
      const watermarkData = this.documentWatermarker.extractWatermark(encryptedText);
      
      if (!watermarkData) {
        return false;
      }
      
      // Extract visible content (without watermark) and verify integrity
      const visibleContent = this.getUserVisibleText(encryptedText);
      const currentContentHash = this.hashContent(visibleContent);
      
      // Check if content has been tampered with
      if (watermarkData.contentHash && currentContentHash !== watermarkData.contentHash) {
        console.warn('[BiometricEncryptionService] Content integrity check failed: document has been tampered with');
        return false;
      }
      
      // Process fingerprint
      const minutiae = await this.fingerprintProcessor.processFingerprint(fingerprintFile);
      
      // Verify fingerprint hash (simplified verification)
      const currentHash = this.hashMinutiae(minutiae);
      if (currentHash !== watermarkData.fingerprintHash) {
        return false;
      }
      
      // Both fingerprint and content integrity verified
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Read document file
   */
  private async readDocument(file: File): Promise<{ text: string; format: DocumentFormat }> {
    return readDocumentAsPlainText(file);
  }

  private async readWatermarkedDocument(file: File): Promise<string> {
    // Use the same extraction method as during encryption for consistency
    // This ensures content hashes match
    return (await this.readDocument(file)).text;
  }

  /**
   * Hash minutiae points for comparison
   */
  private hashMinutiae(minutiae: MinutiaePoint[]): string {
    const data = minutiae.map(m => `${m.x},${m.y},${m.angle},${m.type}`).join('|');
    return this.simpleHash(data);
  }

  /**
   * Hash document content for integrity verification
   */
  private hashContent(content: string): string {
    // Normalize the content by trimming and removing extra whitespace
    const normalizedContent = content.trim().replace(/\s+/g, ' ');
    return this.simpleHash(normalizedContent);
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Get user-visible text from watermarked document (removes watermark for display)
   */
  getUserVisibleText(watermarkedText: string): string {
    const zeroWidthPattern = /[\u200B\u200C\u200D]/g;
    return watermarkedText.replace(zeroWidthPattern, '');
  }

  /**
   * Convert full watermark data to compact format
   */
  private toCompactWatermarkData(watermarkData: WatermarkData): CompactWatermarkData {
    return {
      fh: watermarkData.fingerprintHash,
      s: watermarkData.vault.secret,
      v: watermarkData.vault.vault,
      t: watermarkData.timestamp,
      c: watermarkData.contentHash
    };
  }

  /**
   * Convert compact watermark data to full format
   */
  private fromCompactWatermarkData(compact: CompactWatermarkData): WatermarkData {
    return {
      fingerprintHash: compact.fh,
      vault: {
        vault: compact.v,
        secret: compact.s,
        polynomial: [] // Will be reconstructed during verification
      },
      timestamp: compact.t,
      contentHash: compact.c || '' // Backward compatibility
    };
  }

  /**
   * Test watermarking functionality
   */
  testWatermarking(): { original: string; watermarked: string; extracted: WatermarkData | null; userVisible: string; sizeInfo: { originalSize: number; watermarkSize: number; ultraCompactJsonSize: number; fullJsonSize: number; compressionRatio: string } } {
    const originalText = "This is a test document for watermarking.";
    const testWatermarkData: WatermarkData = {
      fingerprintHash: "test123",
      vault: {
        vault: [[1, 2], [3, 4], [5, 6], [7, 8]], // Small test vault
        secret: "testsecret",
        polynomial: [1, 2]
      },
      timestamp: Date.now(),
      contentHash: this.hashContent(originalText)
    };

    // Embed watermark
    const watermarkedResult = this.documentWatermarker.embedWatermark(originalText, testWatermarkData);
    const watermarkedText = watermarkedResult.watermarkedText;
    
    // Extract watermark
    const extractedData = this.documentWatermarker.extractWatermark(watermarkedText);

    // Get user-visible version
    const userVisible = this.getUserVisibleText(watermarkedText);

    // Calculate size information
    const ultraCompactData: UltraCompactWatermarkData = {
      f: testWatermarkData.fingerprintHash,
      s: testWatermarkData.vault.secret,
      t: testWatermarkData.timestamp,
      c: testWatermarkData.contentHash
    };

    const sizeInfo = {
      originalSize: originalText.length,
      watermarkSize: watermarkedText.length - originalText.length,
      ultraCompactJsonSize: JSON.stringify(ultraCompactData).length,
      fullJsonSize: JSON.stringify(testWatermarkData).length,
      compressionRatio: (JSON.stringify(testWatermarkData).length / JSON.stringify(ultraCompactData).length).toFixed(2)
    };

    return {
      original: originalText,
      watermarked: watermarkedText,
      extracted: extractedData,
      userVisible: userVisible,
      sizeInfo: sizeInfo
    };
  }

  /**
   * Builds a deterministic download name based on the original file and output format.
   */
  private buildDownloadName(originalName: string, format: DocumentFormat): string {
    const safeBase = originalName
      ? originalName.replace(/\.[^/.]+$/, "")
      : "document";
    const extension = format === "docx" ? ".docx" : ".txt";
    return `encrypted_${safeBase}${extension}`;
  }
}
