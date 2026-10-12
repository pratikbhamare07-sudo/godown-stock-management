# Final Fixes Applied

## 1. Stock History
- Removed the old hard limit of 1000 records.
- History now loads the complete transaction history sorted by transaction date and creation time.
- Existing frontend filters for transaction type, from date, to date and customer continue to work.

## 2. Backend Authentication & Roles
- Added signed authentication tokens with 7-day expiry.
- All product/stock/history/customer APIs require authentication.
- ADMIN: full system access.
- WAREHOUSE_USER: product create/edit and Stock In/Out/Return operations.
- OUTLET_USER: Stock Out/Sale and Return operations plus read-only inventory/report access.
- User management is ADMIN-only.
- Product deletion and customer deletion are ADMIN-only.
- Frontend menus/actions now match these permissions.

## 3. Atomic Stock Transactions
- Multiple Stock In, Stock Out/Sale and Return operations now use MongoDB transactions.
- Product stock changes and their transaction-history records are committed together.
- If the transaction fails, the database transaction is not committed.

MongoDB transactions require a replica set/Atlas deployment. The recommended production setup is MongoDB Atlas.

## 4. Frontend Authentication Persistence
- Login now stores the signed auth token.
- Every API request sends the token automatically.
- Logout clears the token.
- A stale old login flag without a token no longer opens the application.

## Deployment note
Set a strong `AUTH_SECRET` environment variable on Render/backend. Do not use the placeholder value for production.
