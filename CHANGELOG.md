# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning in spirit during public preview.

## [0.2.0] - 2026-06-20

### Added

- **OpenRouter integration** — dynamic model discovery for 345+ models via the OpenRouter API. No API key required.
- Async API: `getModelCapabilityAsync()` and `listModelsAsync()` check the local registry first, then fall back to OpenRouter.
- `openRouterToCapability()` converts OpenRouter model metadata to Safety Dance capabilities.
- `fetchOpenRouterModels()`, `getOpenRouterCapability()`, `listOpenRouterModels()`, `clearOpenRouterCache()` for direct OpenRouter access.
- CLI: `safety-dance models --openrouter` lists all OpenRouter models.
- CLI: `safety-dance check` now auto-falls back to OpenRouter for unknown models.
- MCP: `get_model` tool supports `include_openrouter` parameter.
- MCP: `check_compatibility` and `get_model` tools now use async lookups with OpenRouter fallback.
- 18 new tests for OpenRouter integration.

### Changed

- `listModels()` now returns sorted results.
- CLI `check` command uses async model lookup.

## [0.1.0] - 2026-03-23

Initial public preview release.

### Added

- Public CLI via `safety-dance` for `models`, `validate`, and `check`.
- MCP server surface for agent workflows.
- Shared taxonomy, compatibility checker, report builder, model registry, and adapter modules.
- Adapters for Panopticon, MACHIAVELLI, HarmBench, and Inspect AI.
- Example manifests for CLI demos and CI smoke tests.
- Test coverage for CLI, compatibility, adapters, reports, and MCP tools.

### Changed

- Compatibility classification and `breakdown` statuses now derive from the same rule logic.
- Validation now enforces more protocol invariants across manifests, capabilities, and reports.
- Registry lookup and registration are stricter and safer for publication.
- Panopticon adapter handling is more robust for real upstream scenario layouts.

### Notes

- The bundled model registry is curated metadata, not a claim of permanent provider capabilities.
- `0.1.0` should be treated as a public preview rather than a finalized standard.
