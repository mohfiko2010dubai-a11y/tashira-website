# Document Intelligence Provider Decision (Owner Gate)

Status: `DRAFT — NO PROVIDER ACTIVATED`  
Verified: 2026-08-27

## Recommendation

- Primary structured passport provider candidate: **Azure AI Document Intelligence `prebuilt-idDocument`**, subject to a UAE-region privacy review and a representative synthetic/approved-sample benchmark. Microsoft documents worldwide passport-book/card coverage and structured passport/MRZ fields.
- Primary low-cost OCR candidate: **Google Enterprise Document OCR**, because its published OCR supports more than 200 languages, including Arabic, Bangla, Persian, Hindi, Filipino and Urdu-adjacent scripts. Keep deterministic local MRZ parsing ahead of it.
- Secondary structured fallback candidate: **Google Custom Extractor** only after an evidence-backed training set and cost benchmark; its generic OCR alone is not a passport-profile authority.
- AWS Textract `AnalyzeID`: benchmark-only fallback. It returns normalized identity fields, but its official API response omits geometry, which weakens the visual-zone provenance contract.
- Multimodal AI escalation: **no provider selected**. It may assist only after deterministic/MRZ/OCR tiers and may never resolve identity conflicts or eligibility.

## Decision matrix

| Criterion | Azure Document Intelligence | Google Document AI | AWS Textract AnalyzeID |
|---|---|---|---|
| Passport support | Prebuilt worldwide passport book/card model | Generic multilingual OCR; public pretrained passport parser is US-specific | Identity-document normalized fields; sample verification required for target passports |
| MRZ | Structured `MachineReadableZone` field | OCR output can feed TASHIRA deterministic MRZ parser | Normalized fields; retain TASHIRA parser as authority |
| Structured extraction | Strong prebuilt identity schema; custom models available | Custom Extractor/Form Parser available | `IdentityDocumentFields` |
| Visual provenance | OCR/layout geometry available by model/API; verify exact ID response | Strong text/layout references | `AnalyzeID` documentation says geometry is not returned |
| Multilingual | Worldwide ID model; exact visual-script benchmark required | Enterprise OCR advertises 200+ languages | Benchmark required |
| Custom profiles | Custom extraction/classification models | Custom extractor/classifier | Use TASHIRA profile mapping after output |
| Data residency | Region selection available; UAE-region/service availability must be confirmed | Multiple supported regions; exact processor/version residency must be confirmed | AWS region availability and transfer path must be confirmed |
| Published base price per 1,000 pages | Confirm in Azure calculator at purchase time | Enterprise OCR: USD 1.50 (first 1,000 free under current published tier) | AnalyzeID example: USD 25 per 1,000 pages in US West |
| Published structured price per 1,000 pages | Confirm in Azure calculator at purchase time | Custom Extractor/Form Parser: USD 30 | AnalyzeID example: USD 25 |
| Lock-in | Medium: prebuilt field schema | Medium/high for custom processors | Medium |
| TASHIRA integration | Canonical adapter only | Canonical adapter only | Canonical adapter only |

Prices are planning evidence, not a commercial quote. Region, tier, taxes, storage, network, custom-model hosting and volume may change the actual cost.

## Mandatory benchmark before owner selection

1. Use only synthetic or lawfully approved redacted samples.
2. Test every priority script/layout separately; never aggregate away country/profile failures.
3. Score exact field accuracy, MRZ consistency, raw-label/value/bounding provenance, latency and cost.
4. Reject any provider path that cannot preserve applicant/document ownership or raw evidence references.
5. Keep `IDENTITY_DATA_CONFLICT`, unknown layout and low-confidence results routed to Human Review.
6. Complete privacy, DPA, region/data-transfer, retention and deletion review before uploading real passports.

## Sources

- [Microsoft: worldwide passport coverage and ID fields](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/concept-id-document?view=doc-intel-4.0.0)
- [Microsoft: custom document models](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/train/custom-model?view=doc-intel-4.0.0)
- [Google: Document AI processor list and language/region support](https://docs.cloud.google.com/document-ai/docs/processors-list)
- [Google: Document AI pricing](https://cloud.google.com/products/document-ai/pricing)
- [AWS: AnalyzeID API and geometry limitation](https://docs.aws.amazon.com/textract/latest/APIReference/API_AnalyzeID.html)
- [AWS: Textract pricing](https://aws.amazon.com/textract/pricing/)

## Owner gate

No subscription, credential, real-document upload or Production activation is authorized. Owner approval is required after benchmark and privacy review.
