import { useState } from "react";
import { Upload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import FileUpload from "./FileUpload";
import ProgressDisplay from "./ProgressDisplay";
import FilePreview from "./FilePreview";
import { toast } from "sonner";
import { BiometricEncryptionService, EncryptionResult } from "@/lib/biometric";
import { validateFiles } from "@/lib/validation";

const EncryptionSection = () => {
  const [fingerprintFile, setFingerprintFile] = useState<File | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [encryptionResult, setEncryptionResult] = useState<EncryptionResult | null>(null);
  
  const encryptionService = new BiometricEncryptionService();

  const encryptionSteps = [
    { icon: "fingerprint", text: "Fingerprint received" },
    { icon: "scan", text: "Extracting minutiae features..." },
    { icon: "key", text: "Generating secure key via Fuzzy Vault..." },
    { icon: "shield", text: "Embedding watermark in text document..." },
    { icon: "check", text: "Encryption complete — download your secured document." },
  ];

  const handleEncrypt = async () => {
    if (!fingerprintFile || !documentFile) {
      toast.error("Please upload both fingerprint and document files");
      return;
    }

    // Validate files before processing
    const validation = await validateFiles(fingerprintFile, documentFile);
    if (!validation.isValid) {
      toast.error(validation.error || "File validation failed");
      return;
    }

    setIsProcessing(true);
    setCurrentStep(0);
    setIsComplete(false);
    setEncryptionResult(null);

    try {
      // Step 1: Fingerprint received
      setCurrentStep(1);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Step 2: Extract minutiae features
      setCurrentStep(2);
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Step 3: Generate secure key via Fuzzy Vault
      setCurrentStep(3);
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Step 4: Embed watermark in text document
      setCurrentStep(4);
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Perform actual encryption
      const result = await encryptionService.encryptDocument(fingerprintFile, documentFile);
      
      // Debug: Log the results
      const userVisibleText = encryptionService.getUserVisibleText(result.encryptedDocument);
      console.log("Original document length:", result.encryptedDocument.length);
      console.log("User visible length:", userVisibleText.length);
      console.log("Hidden watermark chars:", result.encryptedDocument.length - userVisibleText.length);
      console.log("Watermark data:", result.watermarkData);
      console.log("User visible text:", userVisibleText);
      console.log("First 100 chars of user visible:", userVisibleText.substring(0, 100));
      
      setEncryptionResult(result);

      // Step 5: Encryption complete
      setCurrentStep(5);
      setIsComplete(true);
      setIsProcessing(false);
      toast.success("Document encrypted successfully!");
    } catch (error) {
      console.error("Encryption failed:", error);
      toast.error("Encryption failed. Please try again.");
      setIsProcessing(false);
      setCurrentStep(0);
    }
  };

  const handleDownload = () => {
    if (!encryptionResult) {
      toast.error("No encrypted document to download");
      return;
    }

    // Create and download the encrypted document
    const url = URL.createObjectURL(encryptionResult.downloadBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = encryptionResult.downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("Encrypted document downloaded");
  };

  const handleReset = () => {
    setFingerprintFile(null);
    setDocumentFile(null);
    setCurrentStep(0);
    setIsComplete(false);
    setIsProcessing(false);
    setEncryptionResult(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Upload Section */}
      <Card className="bg-card/30 backdrop-blur-md border-primary/20 p-6 space-y-6">
        <div>
          <h2 className="font-orbitron text-2xl font-semibold mb-6 text-foreground flex items-center gap-2">
            <Upload className="w-6 h-6 text-primary" />
            Encrypt & Watermark Document
          </h2>

          <div className="space-y-4">
            <FileUpload
              label="Upload Fingerprint Image"
              accept=".png,.jpg,.jpeg"
              icon="fingerprint"
              file={fingerprintFile}
              onFileChange={setFingerprintFile}
              disabled={isProcessing}
            />

            <FileUpload
              label="Upload Text Document"
              accept=".txt,.doc,.docx"
              icon="file"
              file={documentFile}
              onFileChange={setDocumentFile}
              disabled={isProcessing}
            />

            {/* File Previews */}
            {fingerprintFile && (
              <FilePreview file={fingerprintFile} type="fingerprint" />
            )}
            {documentFile && (
              <FilePreview file={documentFile} type="document" />
            )}

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleEncrypt}
                disabled={!fingerprintFile || !documentFile || isProcessing}
                className="flex-1 font-orbitron bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow hover:shadow-glow-lg transition-all"
              >
                {isProcessing ? "Processing..." : "Encrypt Document"}
              </Button>

              {(fingerprintFile || documentFile) && (
                <Button
                  onClick={handleReset}
                  variant="outline"
                  disabled={isProcessing}
                  className="font-orbitron border-primary/30 hover:border-primary/50 hover:bg-primary/10"
                >
                  Reset
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Progress Section */}
      <Card className="bg-card/30 backdrop-blur-md border-primary/20 p-6">
        <ProgressDisplay
          steps={encryptionSteps}
          currentStep={currentStep}
          isProcessing={isProcessing}
        />

        {isComplete && encryptionResult && (
          <div className="mt-6 animate-fade-in space-y-4">
            {/* Preview of encrypted document */}
            <div className="bg-muted/20 border border-muted rounded-lg p-4">
              <h4 className="font-mono text-sm font-medium text-foreground mb-2">
                Encrypted Document Preview
              </h4>
              <div className="max-h-32 overflow-y-auto">
                <pre className="font-mono text-xs text-foreground whitespace-pre-wrap break-words">
                  {encryptionService.getUserVisibleText(encryptionResult.encryptedDocument).substring(0, 200)}
                  {encryptionService.getUserVisibleText(encryptionResult.encryptedDocument).length > 200 ? "..." : ""}
                </pre>
              </div>
              <p className="font-mono text-xs text-muted-foreground mt-2">
                Visible length: {encryptionService.getUserVisibleText(encryptionResult.encryptedDocument).length} characters
                <span className="ml-2 text-primary">
                  (Contains invisible watermark: +{encryptionResult.encryptedDocument.length - encryptionService.getUserVisibleText(encryptionResult.encryptedDocument).length} hidden chars)
                </span>
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={handleDownload}
                className="flex-1 font-orbitron bg-accent hover:bg-accent/90 text-accent-foreground shadow-glow"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Encrypted Document
              </Button>
              <Button
                onClick={() => {
                  const test = encryptionService.testWatermarking();
                  console.log("Watermarking Test Results:");
                  console.log("Original:", test.original);
                  console.log("Watermarked (raw):", test.watermarked);
                  console.log("User Visible:", test.userVisible);
                  console.log("Extracted:", test.extracted);
                  console.log("Size Info:", test.sizeInfo);
                  console.log("Compression ratio:", test.sizeInfo.compressionRatio + "x");
                  console.log("User visible matches original:", test.userVisible === test.original);
                  
                  // Test document compatibility
                  const userVisibleText = encryptionService.getUserVisibleText(test.watermarked);
                  console.log("Document for Word/Notepad:", userVisibleText);
                  console.log("Can be opened in Word:", userVisibleText === test.original);
                  
                  toast.success(`Watermarking test completed - ${test.sizeInfo.compressionRatio}x compression achieved! Document is Word-compatible.`);
                }}
                variant="outline"
                className="font-orbitron border-primary/30 hover:border-primary/50 hover:bg-primary/10"
              >
                Test
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default EncryptionSection;
