# Godown Stock Management System

## Features
- Admin/User login and role-based menus
- Stylish responsive dashboard
- Product Master with Add/Edit/Delete
- Product fields: Product Name, Product Code, Category, Packing, Price, Opening Stock, Minimum Stock, Description
- Opening Stock automatically becomes Current Stock
- Multiple Stock In
- Multiple Stock Out / Sale
- Customer management and sales history
- Product returns
- Low-stock alerts and notifications
- Reports and admin analytics
- Printable sales invoice

## Run Backend
```powershell
cd backend
npm install
npm start
```
Backend runs on `http://localhost:5000`.
Make sure MongoDB is running and `.env` contains the correct `MONGO_URI`.

## Run Frontend
Open another terminal:
```powershell
cd frontend
npm install
npm run dev
```
Open the URL shown by Vite, normally `http://localhost:5173`.

## Default Admin
- Email: `admin@godown.com`
- Password: `admin123`

Change the default password/user after first login for a real deployment.
