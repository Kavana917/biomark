import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import FileUpload from "./FileUpload";
import ProgressDisplay from "./ProgressDisplay";
import FilePreview from "./FilePreview";
import { toast } from "sonner";
import { BiometricEncryptionService } from "@/lib/biometric";
import { validateFiles } from "@/lib/validation";

const VerificationSection = () => {
  const [fingerprintFile, setFingerprintFile] = useState<File | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [verificationResult, setVerificationResult] = useState<boolean | null>(null);
  
  const encryptionService = new BiometricEncryptionService();

  const verificationSteps = [
    { icon: "fingerprint", text: "Fingerprint received" },
    { icon: "scan", text: "Extracting minutiae features..." },
    { icon: "shield", text: "Checking watermark integrity..." },
    { icon: "key", text: "Comparing ownership keys..." },
    { icon: "check", text: "Verification complete" },
  ];

  const handleVerify = async () => {
    if (!fingerprintFile || !documentFile) {
      toast.error("Please upload both fingerprint and document files");
      return;
    }

    // Validate files before processing (document is watermarked)
    const validation = await validateFiles(fingerprintFile, documentFile, true);
    if (!validation.isValid) {
      toast.error(validation.error || "File validation failed");
      return;
    }

    setIsProcessing(true);
    setCurrentStep(0);
    setVerificationResult(null);

    try {
      // Step 1: Fingerprint received
      setCurrentStep(1);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Step 2: Extract minutiae features
      setCurrentStep(2);
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Step 3: Check watermark integrity
      setCurrentStep(3);
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Step 4: Compare ownership keys
      setCurrentStep(4);
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Perform actual verification directly with the uploaded file
      const isVerified = await encryptionService.verifyDocument(fingerprintFile, documentFile);
      
      setVerificationResult(isVerified);
      setIsProcessing(false);

      if (isVerified) {
        toast.success("Document verified successfully!");
      } else {
        toast.error("Document verification failed");
      }
    } catch (error) {
      console.error("Verification failed:", error);
      toast.error("Verification failed. Please try again.");
      setIsProcessing(false);
      setCurrentStep(0);
      setVerificationResult(false);
    }
  };

  const handleReset = () => {
    setFingerprintFile(null);
    setDocumentFile(null);
    setCurrentStep(0);
    setVerificationResult(null);
    setIsProcessing(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Upload Section */}
      <Card className="bg-card/30 backdrop-blur-md border-primary/20 p-6 space-y-6">
        <div>
          <h2 className="font-orbitron text-2xl font-semibold mb-6 text-foreground flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-primary" />
            Verify Document Ownership
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
              label="Upload Encrypted Document"
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
                onClick={handleVerify}
                disabled={!fingerprintFile || !documentFile || isProcessing}
                className="flex-1 font-orbitron bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow hover:shadow-glow-lg transition-all"
              >
                {isProcessing ? "Verifying..." : "Verify Document"}
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
          steps={verificationSteps}
          currentStep={currentStep}
          isProcessing={isProcessing}
        />

        {verificationResult !== null && (
          <div className="mt-6 animate-fade-in">
            {verificationResult ? (
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-primary flex-shrink-0" />
                <div>
                  <p className="font-orbitron font-semibold text-primary">Document Verified ✓</p>
                  <p className="font-mono text-sm text-muted-foreground">
                    Ownership and integrity confirmed
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-center gap-3">
                <XCircle className="w-8 h-8 text-destructive flex-shrink-0" />
                <div>
                  <p className="font-orbitron font-semibold text-destructive">Verification Failed ✗</p>
                  <p className="font-mono text-sm text-muted-foreground">
                    Document corrupted or not verified
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default VerificationSection;
