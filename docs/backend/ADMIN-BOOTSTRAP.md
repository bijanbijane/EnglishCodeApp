# Controlled Admin Bootstrap

**No public API can grant or revoke roles.** This is deliberate: an authenticated user must never be able to self-promote.

## First administrator

1. The owner signs into the deployed application through Telegram.
2. Obtain the internal `users.id` for the owner-confirmed Telegram account from the authorized D1 console. Do not use the Telegram numeric ID as the internal user ID.
3. Review the exact target environment and database name before running any SQL.
4. Insert the initial admin grant and a minimal bootstrap audit event in one D1 batch.
5. Verify the role by calling a role-protected read endpoint. Never add the grant to source-controlled seed data.

Template only — replace the placeholder with the verified internal user ID and execute manually in the approved environment:

```sql
BEGIN;

INSERT INTO user_roles (id, user_id, role, granted_by)
VALUES (lower(hex(randomblob(16))), '<VERIFIED_INTERNAL_USER_ID>', 'admin', NULL);

INSERT INTO admin_audit_events
  (id, actor_user_id, action, resource_type, resource_id, request_id, metadata_json)
VALUES (
  lower(hex(randomblob(16))),
  NULL,
  'role.bootstrap.granted',
  'user_role',
  (SELECT id FROM user_roles
   WHERE user_id = '<VERIFIED_INTERNAL_USER_ID>'
     AND role = 'admin'
     AND revoked_at IS NULL),
  'bootstrap-initial-admin',
  '{"source":"owner_controlled_bootstrap","role":"admin"}'
);

COMMIT;
```

Run this as a single transaction using the platform's supported D1 batch/console workflow; do not paste the placeholder unchanged.

## Granting additional roles

- Role grants/revocations are owner-controlled D1 operations until a separately reviewed privileged administration workflow exists.
- Every grant/revocation must include an audit event in the same transaction.
- Active duplicate grants are rejected by the partial unique index.
- Revoke by setting `revoked_at`; do not delete role rows.
- Never expose bot tokens, session tokens, raw Telegram initData, private user content or free-text notes in audit metadata.

## Role responsibilities

- `admin`: publish approved content and read the admin audit feed.
- `content_author`: create lesson drafts and submit own drafts for review.
- `content_reviewer`: review other authors' submissions; cannot approve their own.
- `support`: reserved; no privileged support endpoints are enabled yet.

No role has been granted in production by this repository change. No production database is connected.
