import JSZip from "jszip";
import mammoth from "mammoth";

export type DocumentFormat = "txt" | "docx";

export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const WORD_NAMESPACE =
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

/**
 * Determines whether the provided file should be treated as a Word document.
 */
export function isDocLikeFile(file: Pick<File, "name" | "type">): boolean {
  const lowerName = file.name?.toLowerCase() || "";
  return (
    file.type === DOCX_MIME ||
    file.type === "application/msword" ||
    lowerName.endsWith(".docx") ||
    lowerName.endsWith(".doc")
  );
}

/**
 * Reads a document file and returns its plain-text content along with format info.
 * DOC/DOCX files are converted to text via mammoth, TXT files use the native text reader.
 */
export async function readDocumentAsPlainText(
  file: File
): Promise<{ text: string; format: DocumentFormat }> {
  if (isDocLikeFile(file)) {
    try {
      const text = await extractTextFromDocx(file);
      return { text, format: "docx" };
    } catch (error) {
      console.warn("[docx-handler] Failed to parse DOCX via mammoth. Falling back to raw text.", error);
      const fallbackText = await file.text();
      return { text: fallbackText, format: "docx" };
    }
  }

  const text = await file.text();
  return { text, format: "txt" };
}

/**
 * Extracts raw text content from a DOCX/DOC file using mammoth.
 */
export async function extractTextFromDocx(file: Blob | ArrayBuffer): Promise<string> {
  const arrayBuffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer });
  return value;
}

/**
 * Creates a minimal DOCX Blob that contains the provided text payload.
 * The resulting file opens cleanly in Microsoft Word and preserves plaintext content.
 */
export async function createDocxFromText(text: string): Promise<Blob> {
  const zip = new JSZip();

  zip.file("[Content_Types].xml", getContentTypesXml());

  const relsFolder = zip.folder("_rels");
  relsFolder?.file(".rels", getRootRelsXml());

  const wordFolder = zip.folder("word");
  wordFolder?.file("document.xml", buildDocumentXml(text));
  wordFolder?.file("styles.xml", getStylesXml());

  const wordRelsFolder = wordFolder?.folder("_rels");
  wordRelsFolder?.file("document.xml.rels", getDocumentRelsXml());

  return zip.generateAsync({ type: "blob", mimeType: DOCX_MIME });
}

export async function embedPayloadInDocx(
  originalFile: File,
  payload: string
): Promise<Blob> {
  if (!payload) {
    return originalFile;
  }

  const arrayBuffer = await originalFile.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const documentFile = zip.file("word/document.xml");

  if (!documentFile) {
    throw new Error("Invalid DOCX file: missing word/document.xml");
  }

  const xmlString = await documentFile.async("string");
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "application/xml");
  const textNodes = Array.from(xmlDoc.getElementsByTagNameNS(WORD_NAMESPACE, "t"));
  const candidateNodes = textNodes.filter((node) => {
    const textContent = node.textContent || "";
    return textContent.trim().length > 0 && /[\w\d]/.test(textContent);
  });

  if (candidateNodes.length === 0) {
    const placeholder = appendInvisibleParagraph(xmlDoc);
    candidateNodes.push(placeholder);
  }

  const slotsToUse = determineSlotCount(candidateNodes.length, payload.length);
  const selectedIndexes = pickRandomIndexes(candidateNodes.length, slotsToUse).sort(
    (a, b) => a - b
  );
  const chunkSize = Math.max(8, Math.ceil(payload.length / selectedIndexes.length));

  let cursor = 0;
  for (const index of selectedIndexes) {
    const node = candidateNodes[index];
    if (cursor >= payload.length) {
      break;
    }
    const chunk = payload.slice(cursor, cursor + chunkSize);
    cursor += chunk.length;
    node.textContent = (node.textContent || "") + chunk;
  }

  if (cursor < payload.length && selectedIndexes.length > 0) {
    const lastNode = candidateNodes[selectedIndexes[selectedIndexes.length - 1]];
    lastNode.textContent = (lastNode.textContent || "") + payload.slice(cursor);
  }

  const serializer = new XMLSerializer();
  const updatedXml = serializer.serializeToString(xmlDoc);
  zip.file("word/document.xml", updatedXml);
  return zip.generateAsync({ type: "blob", mimeType: DOCX_MIME });
}

function determineSlotCount(totalNodes: number, payloadLength: number): number {
  const maxSlots = Math.max(1, Math.floor(totalNodes * 0.3));
  const minSlots = Math.max(1, Math.ceil(payloadLength / 32));
  return Math.min(totalNodes, Math.max(minSlots, Math.min(maxSlots, totalNodes)));
}

function pickRandomIndexes(length: number, count: number): number[] {
  if (count >= length) {
    return Array.from({ length }, (_, i) => i);
  }

  const selected = new Set<number>();
  const buffer = new Uint32Array(count * 2);

  while (selected.size < count) {
    crypto.getRandomValues(buffer);
    for (let i = 0; i < buffer.length && selected.size < count; i++) {
      const index = buffer[i] % length;
      selected.add(index);
    }
  }

  return Array.from(selected);
}

function appendInvisibleParagraph(doc: Document): Element {
  const body = doc.getElementsByTagNameNS(WORD_NAMESPACE, "body")[0];
  const paragraph = doc.createElementNS(WORD_NAMESPACE, "w:p");
  const run = doc.createElementNS(WORD_NAMESPACE, "w:r");
  const textNode = doc.createElementNS(WORD_NAMESPACE, "w:t");
  textNode.setAttribute("xml:space", "preserve");
  run.appendChild(textNode);
  paragraph.appendChild(run);
  body?.appendChild(paragraph);
  return textNode;
}

export async function readDocxXmlText(file: File): Promise<string | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const documentFile = zip.file("word/document.xml");
    if (!documentFile) {
      return null;
    }

    const xmlString = await documentFile.async("string");
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "application/xml");
    const textNodes = Array.from(xmlDoc.getElementsByTagNameNS(WORD_NAMESPACE, "t"));

    return textNodes.map((node) => node.textContent || "").join("");
  } catch (error) {
    console.warn("Failed to read DOCX XML text", error);
    return null;
  }
}

function buildDocumentXml(text: string): string {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => createParagraphXml(line))
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function createParagraphXml(line: string): string {
  // Preserve whitespace to avoid Word collapsing intentional spacing.
  const escaped = escapeXml(line);
  return `<w:p><w:r><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getContentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
}

function getRootRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

function getDocumentRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function getStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:rsid w:val="00000000"/>
    <w:pPr>
      <w:spacing w:after="160"/>
    </w:pPr>
    <w:rPr>
      <w:sz w:val="24"/>
    </w:rPr>
  </w:style>
</w:styles>`;
}

