# Security Specification — Verbena Nutrição

## 1. Data Invariants
1. **Strict Multi-Tenant Isolation (PII Protection):** Every `Patient`, `Recipe`, and `MealPlan` document belongs to a single verified nutritionist (`nutritionistId == request.auth.uid`). No authenticated user can read, list, create, update, or delete another nutritionist's documents.
2. **Referential Integrity on Meal Plans:** A `MealPlan` cannot be created or updated unless `patientId` references an existing document in `/patients/{patientId}` whose `nutritionistId` strictly equals `request.auth.uid`.
3. **Immutability of Identity & Audit Fields:** `nutritionistId`, `createdAt`, and `MealPlan.patientId` are strictly immutable after creation.
4. **Server Temporal Integrity:** `createdAt` must equal `request.time` on creation; `updatedAt` must equal `request.time` on creation and every update.
5. **Terminal State Locking:** Once a `MealPlan` reaches `status == 'concluido'`, no further updates are permitted (historical clinical prescriptions are immutable; revisions must be created as new plans).
6. **Verified Email Enforcement:** All write operations (`create`, `update`, `delete`) require `request.auth.token.email_verified == true`.
7. **Strict Key & Size Boundaries:** Every document write rejects unknown/shadow fields via `keys().hasAll(...) && keys().hasOnly(...)` and enforces explicit `.size()` limits on all strings and arrays to prevent Denial-of-Wallet resource exhaustion.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Identity Spoofing on Patient Create:** Authenticated user A creates `/patients/p1` with `nutritionistId: "userB"`. Expected: `PERMISSION_DENIED`.
2. **Shadow Field Injection on Patient Create:** Valid patient payload plus `"isAdmin": true` ghost field. Expected: `PERMISSION_DENIED`.
3. **PII Cross-Tenant Read:** Authenticated user B attempts `get` on `/patients/p1` owned by user A. Expected: `PERMISSION_DENIED`.
4. **Unscoped List Query Scraping:** Authenticated user B attempts `list` on `/patients` without filtering `nutritionistId == userB`. Expected: `PERMISSION_DENIED`.
5. **Orphaned MealPlan Creation:** Authenticated user A creates `/mealPlans/m1` referencing nonexistent `patientId: "nonexistent_999"`. Expected: `PERMISSION_DENIED`.
6. **Cross-Tenant MealPlan Hijack:** Authenticated user B creates `/mealPlans/m2` with `nutritionistId: "userB"` but `patientId` pointing to a patient owned by user A. Expected: `PERMISSION_DENIED`.
7. **Terminal State Mutation:** Authenticated user A attempts to update `/mealPlans/m_done` where `existing().status == "concluido"`. Expected: `PERMISSION_DENIED`.
8. **Immutable Field Tampering:** Authenticated user A updates `/mealPlans/m1` attempting to change `patientId` or `createdAt`. Expected: `PERMISSION_DENIED`.
9. **Client-Spoofed Timestamp:** Authenticated user A creates a `/recipes/r1` with a backdated `createdAt` instead of `serverTimestamp()`. Expected: `PERMISSION_DENIED`.
10. **ID Poisoning Attack:** Authenticated user A creates `/recipes/<200-char-or-invalid-chars>` violating `isValidId()`. Expected: `PERMISSION_DENIED`.
11. **Unverified Email Write:** Authenticated user with `email_verified: false` attempts to create a patient. Expected: `PERMISSION_DENIED`.
12. **Array Overflow / Value Poisoning:** Authenticated user A updates `/recipes/r1` with 35 `ingredients` (exceeding max 30) or `calories: "500"` (wrong type). Expected: `PERMISSION_DENIED`.
13. **Cross-Tenant Consultation Message Injection:** Authenticated user B attempts to create a message under `/consultations/{c1}/messages/{m1}` owned by user A (blocked by Master Gate `get()` on parent consultation). Expected: `PERMISSION_DENIED`.
14. **Closed Consultation Mutation:** Authenticated user A attempts to add a message or update a consultation whose `status == 'encerrada'`. Expected: `PERMISSION_DENIED`.
15. **Issued Compounding Prescription Tampering:** Authenticated user A attempts to mutate dosage/actives on a `/compoundingPrescriptions/{id}` once `status == 'emitida'` (terminal immutable clinical document). Expected: `PERMISSION_DENIED`.
16. **Invalid 12-Month Subscription Duration:** Authenticated user attempts to create `/subscriptions/{id}` with `planDurationMonths != 12` or spoofed `userId`. Expected: `PERMISSION_DENIED`.
17. **Non-Admin Privilege Escalation (`/admins`):** Standard authenticated user attempts to create `/admins/{myEmailKey}` or list `/admins`. Expected: `PERMISSION_DENIED`.
18. **Email Spoofing Attack on Admin Check:** Unverified user (`email_verified: false`) with email matching `demybratu@gmail.com` attempts to read `/admins` or write `/siteSettings/main`. Expected: `PERMISSION_DENIED`.
19. **Unauthorized Site Content / Photo Defacement:** Non-admin user attempts to modify `/siteSettings/main` or `/siteMedia/hero`. Expected: `PERMISSION_DENIED`.
20. **Unauthorized Cross-User Subscription Listing:** Non-admin user attempts to list all `/subscriptions` across users. Expected: `PERMISSION_DENIED`.

