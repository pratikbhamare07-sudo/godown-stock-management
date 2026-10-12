# Stock In / Stock Out Fix

The stock operation APIs no longer require MongoDB replica-set transactions.
They work with the local standalone MongoDB used by this project and with MongoDB Atlas.

Endpoints:
- POST /api/products/stock-in-multiple
- POST /api/products/stock-out-multiple
- POST /api/products/return-multiple

Each operation validates all items first. If a later database write fails, already changed stock values and transaction records for that operation are rolled back.

Login is still required and role permissions are enforced by the backend.
