# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning in spirit during public preview.

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
