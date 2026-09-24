# Godown Stock Management – Final Changes

## Product Master
Product Add/Update now uses:
1. Product Name *
2. Product Code *
3. Category
4. Packing Size
5. Packing Type
6. Unit
7. Selling Price
8. Opening Stock
9. Minimum Stock
10. Description

Packing Size: 100 GM, 250 GM, 500 GM, 1 KG, 2 KG, 5 KG, 10 KG.
Packing Type: Pouch, Packet, Bag, Box, Bottle, Jar, Carton, Tin, Other.
Unit: PCS, GM, KG, BOX, PACK, POUCH, BOTTLE, LTR.

## Staff → Customer Tracking
Stock Out/Sale now requires selecting an active non-admin staff member. The transaction stores:
- Staff Member
- Staff User ID
- Issued By (logged-in user)
- Customer Name and Mobile
- Product, packing size/type, unit
- Quantity, rate, total amount
- Invoice, DC number and transaction date

## Reports
Reports includes filters for date, staff and customer, plus:
- Staff Member → Customer Summary
- Staff Member → Customer → Product transaction table

## Stock History
History now shows packing size, packing type, unit, staff, customer, quantity, rate and amount.

## Stock Flow
Product Master → Opening Stock → Stock In → Stock Out/Sale by Staff → Customer → Return → Low Stock → Stock History → Reports/Analytics.

## API
The frontend uses localhost automatically during local development and the configured Render backend when deployed. You can override it with `VITE_API_URL`.
