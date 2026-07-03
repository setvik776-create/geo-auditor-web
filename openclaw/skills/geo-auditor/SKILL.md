---
name: geo-auditor
description: Use this skill for Generative Engine Optimization (GEO) audits and semantic search analysis. Triggers include "GEO audit", "Generative Engine Optimization", "semantic search audit", "AI search visibility", "Perplexity / Gemini / SearchGPT optimization", "LLM citation analysis", or requests to evaluate brand content for AI-first search engines.
---

# GEO Auditor — Generative Engine Optimization & Semantic Search Auditor

Optimize brand assets for AI-powered generative search engines (Perplexity, Gemini AI Overviews, SearchGPT, etc.).

## When to Use

- User wants to audit web pages, whitepapers, API docs, or brand messaging for AI search visibility.
- Requests to improve citation probability in RAG/LLM-based answers.
- Competitive analysis against other brands in intent-driven queries.
- Preparation for "AI-first" web presence.

## Core Principles

- Focus exclusively on **semantic density**, **entity clarity**, **vector similarity**, and **LLM citation probability**.
- Never give classic SEO advice (keywords, backlinks, H1 tags, etc.).
- Prioritize structured data, factual assertions, numerical values, and clear entity-attribute relationships that LLMs can reliably extract.

## Evaluation Protocol

1. **Semantic Density & Vector Mapping**
2. **Entity-Relation Graph Strength** (resistance to hallucination)
3. **Engine-Specific Citation Assessment** (Perplexity, Gemini, SearchGPT)
4. **Competitor Overlap Analysis**

## Input Variables

- `{{BRAND_DOCUMENTATION_OR_TEXT}}` — main content to audit
- `{{TARGET_AI_SEARCH_QUERIES}}` — key commercial/intent queries
- `{{COMPETITOR_ASSETS}}` — optional competitor summaries
- `{{AI_SEARCH_ENGINE_FOCUS}}` — primary target engine

## Output Requirements

**Always respond with a valid JSON report** inside a markdown code block using the schema defined in `references/output-format.md`.

## References

- [references/output-format.md](references/output-format.md)
- [references/demo-example.md](references/demo-example.md)
