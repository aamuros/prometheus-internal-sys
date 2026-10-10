# Domain Docs

This repository uses **one root domain glossary** and **repository-level architecture decision records (ADRs)**. No `GLOSSARY-MAP.md` or per-feature glossaries are needed.

## Before exploring a business feature

- Read `GLOSSARY.md` if it exists, using its canonical terminology in issues, code, and tests.
- Read relevant decisions in `docs/adr/` if the directory exists.
- Continue to follow `docs/architecture.md`, `docs/conventions.md`, `docs/security.md`, and `docs/verification.md`. ADRs supplement these sources; they do not replace them.

Missing glossary or ADR files are normal at project setup. Proceed without creating empty placeholders.

## Glossary

`GLOSSARY.md` contains business concepts and concise definitions, not implementation details. When a term or rule is clarified during planning, use the `domain-modeling` skill to create or update it. Prefer one canonical name and explicitly identify misleading synonyms.

## Architecture decisions

Write consequential decisions in `docs/adr/` as numbered Markdown files, for example `0001-persistence-strategy.md`. Use the `domain-modeling` skill's ADR format. Record an ADR only when a decision is hard to reverse, would be surprising without context, and involves a genuine trade-off.

Before changing an earlier decision, identify the existing ADR and record the reason for revisiting it.
