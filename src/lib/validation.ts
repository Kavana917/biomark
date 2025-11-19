// Validation utilities for file uploads and biometric processing
import { readDocumentAsPlainText } from "./docx-handler";

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface FingerprintQualityMetrics {
  contrast: number;
  clarity: number;
  ridgeCoverage: number;
  ridgeFrequency: number;
  signalToNoise: number;
  qualityScore: number;
  width: number;
  height: number;
}

export interface FingerprintQualityResult extends ValidationResult {
  metrics?: FingerprintQualityMetrics;
}

const QUALITY_THRESHOLDS = {
  contrast: 20,
  clarity: 30,
  ridgeCoverageMin: 0.12,
  ridgeCoverageMax: 0.9,
  ridgeFrequencyMin: 2,
  ridgeFrequencyMax: 60,
  signalToNoise: 0.75,
};

const MAX_ALLOWED_FAILING_CHECKS = 1;

/**
 * Validate fingerprint image file
 */
export function validateFingerprintFile(file: File): ValidationResult {
  // Check file type
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: 'Fingerprint must be a PNG or JPG image'
    };
  }

  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: 'Fingerprint image is too large (max 10MB)'
    };
  }

  // Check minimum size (at least 100KB)
  const minSize = 100 * 1024; // 100KB
  if (file.size < minSize) {
    return {
      isValid: false,
      error: 'Fingerprint image is too small (min 100KB)'
    };
  }

  return { isValid: true };
}

/**
 * Validate document file
 */
export function validateDocumentFile(file: File): ValidationResult {
  // Check file type
  const allowedTypes = [
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ];
  
  const allowedExtensions = ['.txt', '.docx', '.doc'];
  const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  
  if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
    return {
      isValid: false,
      error: 'Document must be a TXT or DOCX file'
    };
  }

  // Check file size (max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: 'Document is too large (max 5MB)'
    };
  }

  // Check minimum size (at least 1KB)
  const minSize = 1024; // 1KB
  if (file.size < minSize) {
    return {
      isValid: false,
      error: 'Document is too small (min 1KB)'
    };
  }

  return { isValid: true };
}

/**
 * Validate image dimensions for fingerprint processing
 */
export async function validateImageDimensions(file: File): Promise<ValidationResult> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const minWidth = 200;
      const minHeight = 200;
      const maxWidth = 2000;
      const maxHeight = 2000;

      if (img.width < minWidth || img.height < minHeight) {
        resolve({
          isValid: false,
          error: `Image dimensions too small (min ${minWidth}x${minHeight}px)`
        });
        return;
      }

      if (img.width > maxWidth || img.height > maxHeight) {
        resolve({
          isValid: false,
          error: `Image dimensions too large (max ${maxWidth}x${maxHeight}px)`
        });
        return;
      }

      resolve({ isValid: true });
    };
    img.onerror = () => {
      resolve({
        isValid: false,
        error: 'Invalid image file'
      });
    };
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Validate fingerprint quality metrics to make sure the sample is usable.
 */
export async function validateFingerprintQuality(file: File): Promise<FingerprintQualityResult> {
  try {
    const img = await loadImageFromFile(file);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return {
        isValid: false,
        error: "Browser does not support fingerprint analysis canvas context",
      };
    }

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0, img.width, img.height);
    const imageData = ctx.getImageData(0, 0, img.width, img.height);

    const metrics = analyzeFingerprintQuality(imageData);
    const failingChecks: string[] = [];

    if (metrics.contrast < QUALITY_THRESHOLDS.contrast) {
      failingChecks.push("insufficient contrast");
    }
    if (metrics.clarity < QUALITY_THRESHOLDS.clarity) {
      failingChecks.push("blurry ridges");
    }
    if (
      metrics.ridgeCoverage < QUALITY_THRESHOLDS.ridgeCoverageMin ||
      metrics.ridgeCoverage > QUALITY_THRESHOLDS.ridgeCoverageMax
    ) {
      failingChecks.push("poor ridge coverage");
    }
    if (
      metrics.ridgeFrequency < QUALITY_THRESHOLDS.ridgeFrequencyMin ||
      metrics.ridgeFrequency > QUALITY_THRESHOLDS.ridgeFrequencyMax
    ) {
      failingChecks.push("ridge flow irregularities");
    }
    if (metrics.signalToNoise < QUALITY_THRESHOLDS.signalToNoise) {
      failingChecks.push("noisy background");
    }

    if (failingChecks.length > MAX_ALLOWED_FAILING_CHECKS) {
      return {
        isValid: false,
        error: `Fingerprint not identified (${failingChecks.join(", ")})`,
        metrics,
      };
    }

    return { isValid: true, metrics };
  } catch (error) {
    console.error("Failed to validate fingerprint quality", error);
    return {
      isValid: false,
      error: "Could not analyze fingerprint quality. Please try another image.",
    };
  }
}

/**
 * Validate document content
 */
export async function validateDocumentContent(file: File, isWatermarked: boolean = false): Promise<ValidationResult> {
  try {
    const { text } = await readDocumentAsPlainText(file);

    if (!text.trim()) {
      return {
        isValid: false,
        error: 'Document is empty'
      };
    }

    const minLength = 10;
    if (text.trim().length < minLength) {
      return {
        isValid: false,
        error: 'Document content is too short (min 10 characters)'
      };
    }

    const maxLength = isWatermarked ? 500000 : 100000; // 500KB for watermarked, 100KB for original
    if (text.length > maxLength) {
      return {
        isValid: false,
        error: `Document content is too long (max ${isWatermarked ? '500KB' : '100KB'})`
      };
    }

    return { isValid: true };
  } catch (error) {
    console.error("Failed to validate document content", error);
    return {
      isValid: false,
      error: 'Failed to read document content'
    };
  }
}

/**
 * Comprehensive file validation
 */
export async function validateFiles(fingerprintFile: File, documentFile: File, isWatermarked: boolean = false): Promise<ValidationResult> {
  // Validate fingerprint file
  const fingerprintValidation = validateFingerprintFile(fingerprintFile);
  if (!fingerprintValidation.isValid) {
    return fingerprintValidation;
  }

  // Validate document file
  const documentValidation = validateDocumentFile(documentFile);
  if (!documentValidation.isValid) {
    return documentValidation;
  }

  // Validate fingerprint image dimensions
  const dimensionValidation = await validateImageDimensions(fingerprintFile);
  if (!dimensionValidation.isValid) {
    return dimensionValidation;
  }

  // Validate fingerprint sample quality
  const qualityValidation = await validateFingerprintQuality(fingerprintFile);
  if (!qualityValidation.isValid) {
    return qualityValidation;
  }

  // Validate document content (with watermark consideration)
  const contentValidation = await validateDocumentContent(documentFile, isWatermarked);
  if (!contentValidation.isValid) {
    return contentValidation;
  }

  return { isValid: true };
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load fingerprint image"));
    };
    img.src = objectUrl;
  });
}

function analyzeFingerprintQuality(imageData: ImageData): FingerprintQualityMetrics {
  const { data, width, height } = imageData;
  const pixelCount = width * height;
  const grayscale = new Float32Array(pixelCount);
  let sum = 0;

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    grayscale[p] = gray;
    sum += gray;
  }

  const mean = sum / pixelCount;
  let varianceAccumulator = 0;
  for (let i = 0; i < grayscale.length; i++) {
    const diff = grayscale[i] - mean;
    varianceAccumulator += diff * diff;
  }
  const contrast = Math.sqrt(varianceAccumulator / pixelCount);

  const clarity = computeLaplacianVariance(grayscale, width, height);
  const { ridgeCoverage, ridgeFrequency } = analyzeRidgePattern(grayscale, width, height);
  const signalToNoise = analyzeSignalToNoise(grayscale, width, height);

  const normalizedContrast = Math.min(contrast / QUALITY_THRESHOLDS.contrast, 1.4);
  const normalizedClarity = Math.min(clarity / QUALITY_THRESHOLDS.clarity, 1.4);
  const normalizedCoverage =
    ridgeCoverage < QUALITY_THRESHOLDS.ridgeCoverageMin || ridgeCoverage > QUALITY_THRESHOLDS.ridgeCoverageMax
      ? 0
      : 1;
  const normalizedFrequency =
    ridgeFrequency < QUALITY_THRESHOLDS.ridgeFrequencyMin || ridgeFrequency > QUALITY_THRESHOLDS.ridgeFrequencyMax
      ? 0
      : 1;
  const normalizedSnr = Math.min(signalToNoise / QUALITY_THRESHOLDS.signalToNoise, 1.4);
  const qualityScore =
    (normalizedContrast + normalizedClarity + normalizedCoverage + normalizedFrequency + normalizedSnr) / 5;

  return {
    contrast,
    clarity,
    ridgeCoverage,
    ridgeFrequency,
    signalToNoise,
    qualityScore,
    width,
    height,
  };
}

function computeLaplacianVariance(grayscale: Float32Array, width: number, height: number): number {
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const laplacian =
        -4 * grayscale[idx] +
        grayscale[idx - width] +
        grayscale[idx + width] +
        grayscale[idx - 1] +
        grayscale[idx + 1];

      sum += laplacian;
      sumSq += laplacian * laplacian;
      count++;
    }
  }

  const mean = sum / Math.max(count, 1);
  const variance = sumSq / Math.max(count, 1) - mean * mean;
  return Math.max(variance, 0);
}

function analyzeSignalToNoise(grayscale: Float32Array, width: number, height: number): number {
  let sumMagnitude = 0;
  let sumSquaredMagnitude = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;

      const gx =
        ((grayscale[idx - width + 1] + 2 * grayscale[idx + 1] + grayscale[idx + width + 1]) -
          (grayscale[idx - width - 1] + 2 * grayscale[idx - 1] + grayscale[idx + width - 1])) /
        4;

      const gy =
        ((grayscale[idx + width - 1] + 2 * grayscale[idx + width] + grayscale[idx + width + 1]) -
          (grayscale[idx - width - 1] + 2 * grayscale[idx - width] + grayscale[idx - width + 1])) /
        4;

      const magnitude = Math.sqrt(gx * gx + gy * gy);
      sumMagnitude += magnitude;
      sumSquaredMagnitude += magnitude * magnitude;
      count++;
    }
  }

  if (count === 0) return 0;
  const mean = sumMagnitude / count;
  const variance = sumSquaredMagnitude / count - mean * mean;
  const stdDev = Math.sqrt(Math.max(variance, 1e-6));
  return mean / stdDev;
}

function analyzeRidgePattern(grayscale: Float32Array, width: number, height: number): {
  ridgeCoverage: number;
  ridgeFrequency: number;
} {
  let darkPixelCount = 0;
  const totalPixels = grayscale.length;
  const threshold = 140;

  const binary = new Uint8Array(totalPixels);
  for (let i = 0; i < grayscale.length; i++) {
    if (grayscale[i] < threshold) {
      darkPixelCount++;
      binary[i] = 1;
    }
  }

  const ridgeCoverage = darkPixelCount / Math.max(totalPixels, 1);
  let rowsWithInk = 0;
  let transitionSum = 0;

  for (let y = 0; y < height; y++) {
    let rowHasInk = false;
    let transitions = 0;
    let prev = binary[y * width];

    for (let x = 1; x < width; x++) {
      const current = binary[y * width + x];
      if (current) {
        rowHasInk = true;
      }
      if (current !== prev) {
        transitions++;
        prev = current;
      }
    }

    if (rowHasInk) {
      rowsWithInk++;
      transitionSum += transitions;
    }
  }

  const ridgeFrequency = rowsWithInk ? transitionSum / rowsWithInk : 0;

  return {
    ridgeCoverage,
    ridgeFrequency,
  };
}
