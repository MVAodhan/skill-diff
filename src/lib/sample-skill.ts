export const SAMPLE_SKILL = `---
name: pdf-document-reader
description: Reads and extracts structured content from PDF documents. Use when the user asks to parse, summarize, or extract data from PDF files.
---

# PDF Document Reader

This skill provides very reliable helpers for reading PDF files and extracting their text, tables, and metadata into a structured format that is really easy to work with downstream.

## When to use this skill

- The user asks to read, parse, or extract content from a PDF file
- The user provides a PDF path or upload and wants its contents summarized
- The user needs text, tables, or metadata pulled out of a PDF document

## How to use it

1. Locate the PDF file path from the user's request
2. Run the extraction script against the file
3. Review the JSON output and summarize the findings for the user

## Extraction script

\`\`\`bash
python scripts/extract_pdf.py --input document.pdf --output content.json
\`\`\`

## Output format

The script writes a JSON file with the following structure:

\`\`\`json
{
  "pages": [
    { "number": 1, "text": "...", "tables": [] }
  ],
  "metadata": { "title": "...", "author": "..." }
}
\`\`\`

## Edge cases

- If the PDF is password protected, just ask the user for the password before proceeding
- Scanned PDFs without a text layer basically require OCR; fall back to the \`ocr\` mode
- For very large documents, process page ranges instead of the whole file
`

/**
 * Static example revision paired with `SAMPLE_SKILL` so the diff UI can be
 * previewed immediately — no AI logic involved. `handleGenerate` in
 * `src/routes/index.tsx` remains the integration point for the real
 * implementation.
 */
export const SAMPLE_REVISED_SKILL = `---
name: pdf-document-reader
description: Reads and extracts structured content from PDF documents. Use when the user asks to parse, summarize, or extract data from PDF files.
---

# PDF Document Reader

This skill reads PDF files and extracts their text, tables, and metadata into a structured JSON format.

## When to use this skill

- The user asks to read, parse, or extract content from a PDF file
- The user provides a PDF path or upload and wants its contents summarized
- The user needs text, tables, or metadata pulled out of a PDF document
- The user asks about a document's page count, title, or author metadata

## How to use it

1. Locate the PDF file path from the user's request
2. Run the extraction script against the file
3. Review the JSON output and summarize the findings for the user

## Tips

- Always check \`content.json\` for empty pages before summarizing
- Use \`--pages 1-5\` to process a range instead of the whole file

## Extraction script

\`\`\`bash
python scripts/extract_pdf.py --input document.pdf --output content.json
python scripts/extract_pdf.py --help   # see all options
\`\`\`

## Output format

The script writes a JSON file with the following structure:

\`\`\`json
{
  "pages": [
    { "number": 1, "content": "...", "tables": [] }
  ],
  "metadata": { "title": "...", "author": "..." }
}
\`\`\`

## Edge cases

- If the PDF is password protected, ask the user for the password before proceeding
- Scanned PDFs without a text layer require OCR; fall back to the \`ocr\` mode
`
