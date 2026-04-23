# Firestore Security Specification - PrintPro Manager

## Data Invariants
1. **Multi-Tenancy Isolation**: All tenant data (`orders`, `expenses`, `customers`, `products`, `settings`) MUST be isolated by `tenantId`. A user can only access data where `resource.data.tenantId == request.auth.uid`.
2. **Identity Integrity**: For any creation, `request.resource.data.tenantId` MUST match `request.auth.uid`.
3. **Admin Privilege**: The email `freedomtech120@gmail.com` is the platform admin and has elevated read-only access to all tenants for support/monitoring.
4. **Subscription Integrity**: A user cannot approve their own registration or modify their trial/subscription expiry dates.
5. **System Immutability**: `createdAt` timestamps cannot be modified once set.

## The "Dirty Dozen" Payloads (Targeting Rejection)

1. **Identity Theft (Order Creation)**: Attempt to create an order with `tenantId` set to a different user's UID.
2. **Account Escalation (Tenant Update)**: Attempt to set `isAdmin: true` on your own tenant document.
3. **Privilege Escalation (Approval)**: Attempt to set `isApproved: true` on your own tenant document.
4. **Data Leak (Cross-Tenant List)**: Attempt to list orders without a tenantId filter (querying someone else's data).
5. **PII Scraping (Public Get)**: Attempt to `get()` a user's `tenants/{userId}` document as a different unauthenticated user.
6. **Bypassing Payment (Subscription Update)**: Attempt to set `subscriptionStatus: 'active'` without admin approval.
7. **Shadow Injection (Ghost Fields)**: Attempt to update an order with extra fields like `isVerifiedBySystem: true`.
8. **Malicious ID (Poisoning)**: Attempt to create a document with an ID that is 2KB in size.
9. **Resource Exhaustion (Denial of Wallet)**: Attempt to save a customer with a `name` string that is 500KB.
10. **Orphan Creation (Relational Sync)**: Attempt to create an order without a valid customer ID.
11. **Future Dating (Timestamp Fraud)**: Attempt to set `createdAt` to a date in the year 2099.
12. **Unauthorized Admin Access**: Attempt to write to `platform/settings` as a non-admin user.

## Test Runner (Logic Definitions)

```typescript
// firestore.rules.test.ts
// These tests verify that POSITIVE access is granted and DIRTY payloads are DENIED.

// 1. [DENY] Create order with mismatched tenantId
// 2. [DENY] Update tenant to self-approve
// 3. [DENY] Write platform settings as regular user
// 4. [ALLOW] Owner read/write their own orders
// 5. [ALLOW] Admin read all tenants
```
