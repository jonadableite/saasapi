UPDATE "Payment" p
SET "dueDate" = u."createdAt" + INTERVAL '30 days'
FROM "whatlead_users" u
WHERE p."userId" = u.id;