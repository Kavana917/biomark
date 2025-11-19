declare module "mammoth" {
  interface ExtractRawTextOptions {
    arrayBuffer: ArrayBuffer;
  }

  interface ExtractRawTextResult {
    value: string;
  }

  function extractRawText(
    options: ExtractRawTextOptions
  ): Promise<ExtractRawTextResult>;

  const mammoth: {
    extractRawText: typeof extractRawText;
  };

  export default mammoth;
}

