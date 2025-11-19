import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Shield, Fingerprint, Lock } from "lucide-react";

const Hero = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,0,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,black,transparent)]" />
      
      {/* Glow effects */}
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[100px] animate-pulse delay-1000" />

      <div className="relative z-10 container mx-auto px-4 py-20 flex flex-col items-center justify-center min-h-screen">
        {/* Logo/Icon */}
        <div className="mb-8 relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-glow-pulse" />
          <div className="relative bg-card/50 backdrop-blur-sm border border-primary/30 rounded-full p-6 shadow-glow">
            <Fingerprint className="w-16 h-16 text-primary" strokeWidth={1.5} />
          </div>
        </div>

        {/* Main heading */}
        <h1 className="font-orbitron text-5xl md:text-7xl font-bold text-center mb-6 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-fade-in">
          BioMark
        </h1>

        <h2 className="font-orbitron text-xl md:text-2xl text-primary/80 text-center mb-8 animate-fade-in">
          Biometric-Driven Digital Watermarking System
        </h2>

        {/* Subtitle */}
        <p className="font-mono text-lg md:text-xl text-foreground/80 text-center max-w-3xl mb-12 leading-relaxed animate-slide-up">
          Secure your documents with fingerprint-driven watermarking technology. 
          BioMark uses fingerprint-based biometric encryption to securely watermark text documents, 
          ensuring originality and ownership verification for digital content.
        </p>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 w-full max-w-4xl">
          <div className="group bg-card/30 backdrop-blur-md border border-primary/20 rounded-lg p-6 hover:border-primary/50 hover:shadow-glow transition-all duration-300">
            <Shield className="w-10 h-10 text-primary mb-4 group-hover:scale-110 transition-transform" />
            <h3 className="font-orbitron text-lg font-semibold mb-2 text-foreground">Secure Encryption</h3>
            <p className="font-mono text-sm text-muted-foreground">Advanced biometric-based encryption ensures document security</p>
          </div>

          <div className="group bg-card/30 backdrop-blur-md border border-primary/20 rounded-lg p-6 hover:border-primary/50 hover:shadow-glow transition-all duration-300">
            <Fingerprint className="w-10 h-10 text-primary mb-4 group-hover:scale-110 transition-transform" />
            <h3 className="font-orbitron text-lg font-semibold mb-2 text-foreground">Biometric Auth</h3>
            <p className="font-mono text-sm text-muted-foreground">Fingerprint-based authentication for ownership verification</p>
          </div>

          <div className="group bg-card/30 backdrop-blur-md border border-primary/20 rounded-lg p-6 hover:border-primary/50 hover:shadow-glow transition-all duration-300">
            <Lock className="w-10 h-10 text-primary mb-4 group-hover:scale-110 transition-transform" />
            <h3 className="font-orbitron text-lg font-semibold mb-2 text-foreground">Integrity Check</h3>
            <p className="font-mono text-sm text-muted-foreground">Verify document authenticity and detect tampering</p>
          </div>
        </div>

        {/* CTA Button */}
        <Button
          onClick={() => navigate("/app")}
          size="lg"
          className="font-orbitron text-lg px-8 py-6 bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow hover:shadow-glow-lg transition-all duration-300 hover:scale-105"
        >
          Get Started
        </Button>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-primary/50 rounded-full p-1">
            <div className="w-1 h-3 bg-primary rounded-full mx-auto animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
