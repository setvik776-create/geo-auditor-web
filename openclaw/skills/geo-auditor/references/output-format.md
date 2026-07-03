# GEO Auditor — Output Formats

## Standard Audit Output Schema (JSON)
All audit responses must follow this strict structure:

```json
{
  "audit_metadata": {
    "target_brand": "string",
    "primary_query_set": ["string"],
    "generative_engine_focus": "string",
    "audit_date": "YYYY-MM-DD"
  },
  "scorecard": {
    "semantic_density_score": 0.0,
    "factual_extraction_score": 0.0,
    "citation_probability_score": 0.0,
    "competitor_overlap_percentage": 0.0
  },
  "key_vulnerabilities": [
    {
      "vulnerability": "string",
      "impact": "High | Medium | Low",
      "technical_cause": "string",
      "recommendation_summary": "string"
    }
  ],
  "semantic_modifications": [
    {
      "original_text_snippet": "string",
      "optimized_text_snippet": "string",
      "geo_rationale": "string"
    }
  ],
  "schema_and_structured_data_payload": "string (YAML or JSON-LD recommendation)",
  "strategic_recommendations": [
    "string"
  ]
}
```
