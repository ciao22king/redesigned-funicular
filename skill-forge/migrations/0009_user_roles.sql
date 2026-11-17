-- Role on a registered user.
--
-- The role decides what the person is entitled to: the owner operates the
-- service and sees the operator dashboard, a founding tester gets no daily
-- quota as a thank-you for trying the product early. It is stored per user so
-- the badge shown in the UI and the entitlement checked on the server come from
-- the same value, instead of the UI guessing from a hard-coded list.
--
-- 'member' is the default: a normal account with the standard quota.

ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member';

-- The operator dashboard and the badge lookups filter by role.
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
