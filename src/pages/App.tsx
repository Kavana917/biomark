import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, CheckCircle2 } from "lucide-react";
import EncryptionSection from "@/components/EncryptionSection";
import VerificationSection from "@/components/VerificationSection";
import AboutSection from "@/components/AboutSection";

const AppPage = () => {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,0,0.02)_1px,transparent_1px)] bg-[size:50px_50px]" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[100px]" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-[100px]" />

      <div className="relative z-10 container mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <div className="text-center mb-8 md:mb-12">
          <h1 className="font-orbitron text-3xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            BioMark
          </h1>
          <p className="font-mono text-sm md:text-base text-muted-foreground">
            Biometric-Driven Digital Watermarking System
          </p>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="encryption" className="w-full max-w-7xl mx-auto">
          <TabsList className="grid w-full max-w-lg mx-auto grid-cols-2 mb-8 bg-card/30 backdrop-blur-md border border-primary/20 p-1">
            <TabsTrigger
              value="encryption"
              className="font-orbitron data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow transition-all"
            >
              <Shield className="w-4 h-4 mr-2" />
              Encryption
            </TabsTrigger>
            <TabsTrigger
              value="verification"
              className="font-orbitron data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow transition-all"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Verification
            </TabsTrigger>
          </TabsList>

          <TabsContent value="encryption" className="animate-fade-in">
            <EncryptionSection />
          </TabsContent>

          <TabsContent value="verification" className="animate-fade-in">
            <VerificationSection />
          </TabsContent>
        </Tabs>

        {/* About Section */}
        <AboutSection />
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-primary/20 mt-20 py-6 bg-card/20 backdrop-blur-sm">
        <div className="container mx-auto px-4 text-center">
          <p className="font-mono text-sm text-muted-foreground">
            © 2025 BioMark | Developed for Academic Research
          </p>
        </div>
      </footer>
    </div>
  );
};

export default AppPage;
