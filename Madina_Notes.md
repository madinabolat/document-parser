## V0 Scope

- Extract values from a PDF.
- Assume the PDF contains machine-readable text.
  - Scanned/image-based PDFs are out of scope.
- Assume the requested value is explicitly stated in the document.
  - Example: `Policy Number: ABC123`
- No reasoning or deduction is required.
  - Questions such as "Does Business Income coverage apply if XYZ happens?" are out of scope.

## Future Versions

- Support scanned/image-based PDFs.
- Answer questions about document content.
- Deduce answers that are not explicitly stated.
- Reason across multiple parts of a document.