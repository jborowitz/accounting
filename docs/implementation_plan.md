# Implementation Plan

## Current status
- Local Python environment scaffolded with `.venv` and `.gitignore`.
- Synthetic data generator in place.
- API is running with health and demo summary endpoints.
- Matching engine baseline implemented with API + CLI + unittest coverage.
- Remote deployment pipeline uses Docker and performs API smoke tests.

## Phase 1: Complete core demo workflow
1. Add ingestion job endpoint for uploaded CSV/PDF files.
2. Persist match results to a local SQLite DB.
3. Build exception queue endpoints:
   - list exceptions
   - resolve exception
   - save reusable mapping hint
4. Add attribution endpoint with split-rule version selection.

## Phase 2: Build demo UI flows
1. Ingestion screen with parse confidence and row stats.
2. Match results screen with score explanations.
3. Exception queue screen with manual resolve actions.
4. Output screen for accrual and GL CSV download.

## Phase 3: Hardening and deploy readiness
1. Add integration tests for API endpoints.
2. Add remote smoke test script for post-deploy verification.
3. Add sample redacted PDF pack folder and parser fixtures.
4. Record a scripted demo path with exact API/UI sequence.

## Immediate next steps
1. Implement `POST /api/v1/demo/exceptions/resolve`.
2. Add SQLite models for match results and saved rules.
3. Add `GET /api/v1/demo/exports/accrual.csv`.
