# AGENTS.md — ddiary

Guidance and architectural conventions for AI agents and contributors working on **ddiary**, a personal Type 1 Diabetes (T1D) diary and retrospective analytics application. See [README.md](README.md) for product overview and features.

---

## Global Instructions

Follow these four principles on every task:

### 1. Think Before Coding
- State your assumptions explicitly before writing code.
- If a requirement is ambiguous or has meaningful trade-offs, surface the options and ask rather than guessing silently.
- Push back when a simpler approach achieves the same goal.
- Never silently invent product requirements, clinical formulas, or unrequested infrastructure.

### 2. Simplicity First
- Write the minimum code that cleanly solves the current requirement.
- Avoid speculative features, premature abstractions, and unnecessary configurability.
- Only introduce interfaces/seams where the architecture explicitly calls for them (e.g., pluggable data sources, platform adapters, LLM providers, future remote sync).
- Prefer clear, readable code over clever indirection.

### 3. Surgical Changes
- Touch only the files and lines directly relevant to the task.
- Match existing naming, formatting, and architectural patterns.
- Do not refactor, reformat, or "clean up" unrelated code while implementing a change.
- Clean up only unused imports, dead code, or temporary files introduced by your own edits.

### 4. Goal-Driven Execution
- Define clear, verifiable success criteria before starting implementation.
- Prefer fast, deterministic verification (unit tests in the shared Kotlin core, build checks, schema/parsing tests) that proves the goal is met.
- Iterate until all checks pass; never report a task complete based on assumption alone.

---

## Project Architecture

### Platform & Technology Strategy
- **Shared Core (`shared/`) — Kotlin Multiplatform (KMP)**:
  - Owns all domain models, unit conversions, macro/calorie calculations, local persistence, deduplication, retrospective analytics, and network clients.
  - Written in platform-independent Kotlin so the core is shared directly when extending to iOS later.
- **Android MVP (`androidApp/`) — Kotlin + Jetpack Compose**:
  - First target platform. Implements the UI and Android-specific platform adapters (Google Health Connect, Android NFC smart pen reading, camera/photo picker, Android Keystore).
- **Future iOS Client (`iosApp/`)**:
  - Reuses `shared/` unchanged and supplies iOS platform adapters (Apple HealthKit, CoreNFC, Keychain).

### Module & Layer Boundaries

Keep platform APIs (Android SDK, Health Connect, NFC, Keystore) out of `shared/` domain and analytics logic.

```text
ddiary/
├── shared/                     # Kotlin Multiplatform core
│   ├── domain/                 # Pure models, units, validation, retrospective analytics
│   ├── data/                   # Local-first SQLite storage, repositories, sync metadata
│   └── integrations/           # Pluggable connectors & provider-agnostic HTTP clients
├── androidApp/                 # Android MVP (Jetpack Compose UI + platform adapters)
│   ├── ui/                     # Screens, glucose/timeline charts, ViewModels
│   └── platform/               # Health Connect, Android NFC pen reader, Keystore, Camera
└── iosApp/                     # (Planned) iOS UI + HealthKit / CoreNFC / Keychain adapters
```

### Data Storage & Future Streaming
- **Local-First on Device**: On-device SQLite (via Room KMP or SQLDelight) is the single source of truth. All core diary, charting, and retrospective analytics must work fully offline.
- **Stream-Ready Schema**: Every persisted record must include:
  - Stable client-generated UUID (`id`)
  - Event timestamp in UTC (`Instant`) **plus** local UTC offset at recording time
  - Data provenance (`source`, optional `externalId`) for multi-source deduplication
  - Sync metadata (`updatedAt`, soft-delete `deletedAt` / outbox cursor) so a future external web streaming/sync service can be added without breaking the local schema.

### Pluggable Integration Seams
1. **Glucose Sources (`GlucoseSource`)**: Manual glucometer input, Google Health Connect, Nightscout, and extensible CGM connectors. New sources should plug in without modifying chart or analytics code.
2. **Insulin Sources (`InsulinSource`)**: Manual entry and phone NFC smart pen reads (behind a platform adapter interface).
3. **Activity & Biometrics (`ActivitySource`)**: Google Health Connect adapter (heart rate, steps, workouts, and other available physical metrics).
4. **Meal Photo LLM Analysis (`MealVisionAnalyzer`)**:
   - **MVP**: Called directly from the device via a provider-agnostic interface (e.g., Gemini, OpenAI, Claude) using a user-supplied (BYO) API key stored in platform secure storage.
   - Designed so a lightweight backend proxy can later implement the same interface without changing UI or domain code.
5. **External Streaming / Sync (`RemoteSyncSink`, planned)**: Consumes local changes/outbox to stream data to an external web service.

---

## Domain & Safety Conventions (T1D)

- **Not a Medical Device**: `ddiary` is strictly for personal logging and retrospective analysis. Never implement automated insulin dosing, bolus calculators, or clinical recommendations.
- **Explicit Units & Types**: Represent glucose (`mg/dL` vs `mmol/L`), insulin (`units`), macros (`grams`), and energy (`kcal`) with explicit domain types — never raw ambiguous floats.
- **Deterministic Calorie Math**: Derive meal calories deterministically from macronutrients (`kcal = carbs * 4 + protein * 4 + fat * 9`) in `shared/domain`.
- **Timezones Matter**: Always preserve both UTC timestamp and local offset; retrospective analyses (e.g., time-of-day ISS/ISF, pre-bolus timing, post-meal curves) depend on local time of day even across travel and DST changes.
- **Deduplication by Provenance**: Users may connect overlapping sources (e.g., CGM + Health Connect + Nightscout). Store `source` and `externalId` and deduplicate cleanly at ingestion/query boundaries.
- **Human-in-the-Loop for AI Estimates**: Meal photo analysis from an external LLM must always be presented as an editable draft for the user to review and confirm before saving.
- **Privacy & Secrets**:
  - Health data remains local-first by default; only transmit data explicitly requested by the user (e.g., meal photo to the configured LLM, or configured sync target).
  - Never log sensitive health data, API keys, or tokens.
  - Store BYO LLM API keys and third-party credentials exclusively in platform secure storage (Android Keystore / iOS Keychain). Never commit `.env` files or secrets.

---

## Testing & Maintenance

- **English-Only Repository Artifacts**: Regardless of the language used in chat, all git commit messages, pull requests, code comments, identifiers, and project documentation (`README.md`, `AGENTS.md`, ADRs, etc.) must be written in English. The only exception is application UI localization resources (e.g., translated string tables).
- Put business logic, unit conversions, deduplication, and retrospective analytics in `shared/domain` and cover them with fast JVM unit tests.
- Keep [README.md](README.md) and [AGENTS.md](AGENTS.md) updated when architecture decisions, modules, or supported integrations evolve.
