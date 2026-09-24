const express = require("express");
const crypto = require("crypto");
const Product = require("../models/Product");
const StockTransaction = require("../models/StockTransaction");

const router = express.Router();
const makeGroupId = () => crypto.randomUUID();
const makeInvoiceNumber = () => `INV-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
const n = (value) => Number(value || 0);

router.get("/test", (req, res) => res.json({ message: "Product route is working" }));

router.get("/", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch products", error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = { ...req.body };
    body.openingStock = n(body.openingStock);
    body.currentStock = body.openingStock;
    body.minimumStock = n(body.minimumStock);
    body.sellingPrice = n(body.sellingPrice);
    const product = await Product.create(body);
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ message: "Failed to add product", error: error.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.sellingPrice !== undefined) body.sellingPrice = n(body.sellingPrice);
    if (body.minimumStock !== undefined) body.minimumStock = n(body.minimumStock);
    const product = await Product.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (error) {
    res.status(400).json({ message: "Failed to update product", error: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete product", error: error.message });
  }
});

async function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw new Error("At least one product is required");
  const merged = new Map();
  for (const item of items) {
    const productId = item.productId;
    const quantity = n(item.quantity);
    if (!productId || quantity <= 0) throw new Error("Product and valid quantity are required");
    merged.set(productId, (merged.get(productId) || 0) + quantity);
  }
  const rows = [];
  for (const [productId, quantity] of merged) {
    const product = await Product.findById(productId);
    if (!product) throw new Error(`Product not found: ${productId}`);
    rows.push({ product, quantity });
  }
  return rows;
}

router.post("/stock-in-multiple", async (req, res) => {
  try {
    const dcNumber = String(req.body.dcNumber || "").trim();
    const transactionDate = String(req.body.transactionDate || "").trim();
    if (!dcNumber) return res.status(400).json({ message: "DC No. is required for Stock In" });
    if (!transactionDate) return res.status(400).json({ message: "Stock In Date is required" });
    const parsedDate = new Date(transactionDate);
    if (Number.isNaN(parsedDate.getTime())) return res.status(400).json({ message: "Invalid Stock In Date" });
    const rows = await validateItems(req.body.items);
    const groupId = makeGroupId();
    const results = [];
    for (const { product, quantity } of rows) {
      const previousStock = n(product.currentStock);
      const newStock = previousStock + quantity;
      product.currentStock = newStock;
      await product.save();
      const tx = await StockTransaction.create({
        transactionGroupId: groupId,
        product: product._id,
        productName: product.productName,
        productCode: product.productCode,
        transactionType: "STOCK_IN",
        quantity,
        previousStock,
        newStock,
        remarks: req.body.remarks || "",
        dcNumber,
        transactionDate: parsedDate,
        quality: req.body.quality || "",
        packing: product.packing || "",
        packingType: product.packingType || "",
        unit: product.unit || "PCS",
        staffMember: req.body.staffMember || "",
        staffUserId: req.body.staffUserId || null,
        issuedBy: req.body.issuedBy || "",
      });
      results.push({ productId: product._id, productName: product.productName, quantity, previousStock, newStock, transactionId: tx._id });
    }
    res.status(201).json({ message: "Multiple Stock In successful", transactionGroupId: groupId, totalProducts: results.length, items: results });
  } catch (error) {
    res.status(400).json({ message: "Multiple Stock In failed", error: error.message });
  }
});

router.post("/stock-out-multiple", async (req, res) => {
  try {
    const { customerName, customerMobile, remarks, staffMember, staffUserId, issuedBy, dcNumber, transactionDate } = req.body;
    if (!customerName || !customerName.trim()) return res.status(400).json({ message: "Customer Name is required" });
    const rows = await validateItems(req.body.items);
    for (const { product, quantity } of rows) {
      if (quantity > n(product.currentStock)) {
        return res.status(400).json({ message: `Insufficient stock for ${product.productName}`, availableStock: n(product.currentStock) });
      }
    }
    const groupId = makeGroupId();
    const invoiceNumber = makeInvoiceNumber();
    const results = [];
    let grandTotal = 0;
    for (const { product, quantity } of rows) {
      const previousStock = n(product.currentStock);
      const newStock = previousStock - quantity;
      const itemInput = (req.body.items || []).find((it) => String(it.productId) === String(product._id)) || {};
      const unitPrice = itemInput.rate !== undefined && itemInput.rate !== "" ? n(itemInput.rate) : n(product.sellingPrice);
      const totalAmount = quantity * unitPrice;
      grandTotal += totalAmount;
      product.currentStock = newStock;
      await product.save();
      await StockTransaction.create({
        transactionGroupId: groupId,
        invoiceNumber,
        product: product._id,
        productName: product.productName,
        productCode: product.productCode,
        transactionType: "STOCK_OUT",
        quantity,
        previousStock,
        newStock,
        unitPrice,
        totalAmount,
        customerName: customerName.trim(),
        customerMobile: customerMobile ? customerMobile.trim() : "",
        staffMember: staffMember ? staffMember.trim() : "",
        staffUserId: staffUserId || null,
        issuedBy: issuedBy ? issuedBy.trim() : "",
        packing: product.packing || "",
        packingType: product.packingType || "",
        unit: product.unit || "PCS",
        dcNumber: dcNumber || "",
        transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
        remarks: remarks || "",
      });
      results.push({ productId: product._id, productName: product.productName, productCode: product.productCode, packing: product.packing, unit: product.unit, quantity, unitPrice, totalAmount, previousStock, newStock });
    }
    res.status(201).json({ message: "Sale successful", transactionGroupId: groupId, invoiceNumber, customerName: customerName.trim(), customerMobile: customerMobile || "", items: results, grandTotal });
  } catch (error) {
    res.status(400).json({ message: "Stock Out failed", error: error.message });
  }
});

router.post("/return-multiple", async (req, res) => {
  try {
    const { customerName, customerMobile, invoiceNumber, remarks } = req.body;
    if (!customerName || !customerName.trim()) return res.status(400).json({ message: "Customer Name is required" });
    const rows = await validateItems(req.body.items);
    const groupId = makeGroupId();
    const results = [];
    let totalAmount = 0;
    for (const { product, quantity } of rows) {
      const previousStock = n(product.currentStock);
      const unitPrice = n(product.sellingPrice);
      const amount = quantity * unitPrice;
      const newStock = previousStock + quantity;
      totalAmount += amount;
      product.currentStock = newStock;
      await product.save();
      await StockTransaction.create({ transactionGroupId: groupId, invoiceNumber: invoiceNumber || "", product: product._id, productName: product.productName, productCode: product.productCode, transactionType: "RETURN", quantity, previousStock, newStock, unitPrice, totalAmount: amount, customerName: customerName.trim(), customerMobile: customerMobile || "", packing: product.packing || "", packingType: product.packingType || "", unit: product.unit || "PCS", remarks: remarks || "Product Return" });
      results.push({ productId: product._id, productName: product.productName, quantity, unitPrice, totalAmount: amount, newStock });
    }
    res.status(201).json({ message: "Product return successful", transactionGroupId: groupId, items: results, totalAmount });
  } catch (error) {
    res.status(400).json({ message: "Return failed", error: error.message });
  }
});

router.post("/stock-in", async (req, res) => {
  req.body.items = [{ productId: req.body.productId, quantity: req.body.quantity }];
  return router.handle({ ...req, url: "/stock-in-multiple", method: "POST" }, res, () => {});
});

router.post("/stock-out", async (req, res) => {
  req.body.items = [{ productId: req.body.productId, quantity: req.body.quantity }];
  return router.handle({ ...req, url: "/stock-out-multiple", method: "POST" }, res, () => {});
});

router.get("/history", async (req, res) => {
  try {
    const history = await StockTransaction.find().sort({ createdAt: -1 }).limit(1000);
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch stock history", error: error.message });
  }
});

router.get("/customers", async (req, res) => {
  try {
    const rows = await StockTransaction.find({ transactionType: "STOCK_OUT", customerName: { $ne: "" } }).sort({ createdAt: -1 });
    const map = new Map();
    rows.forEach((r) => {
      const key = `${r.customerName}|${r.customerMobile || ""}`;
      if (!map.has(key)) map.set(key, { customerName: r.customerName, customerMobile: r.customerMobile || "", totalQuantity: 0, totalPurchase: 0, orders: 0, lastPurchase: r.createdAt });
      const c = map.get(key);
      c.totalQuantity += n(r.quantity);
      c.totalPurchase += n(r.totalAmount);
      c.orders += 1;
    });
    res.json([...map.values()].sort((a, b) => b.totalPurchase - a.totalPurchase));
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch customers", error: error.message });
  }
});

router.delete("/customers", async (req, res) => {
  try {
    const { customerName, customerMobile } = req.body;
    if (!customerName || !customerName.trim()) return res.status(400).json({ message: "Customer name is required" });
    const filter = { transactionType: "STOCK_OUT", customerName: customerName.trim() };
    if (customerMobile) filter.customerMobile = customerMobile.trim();
    const result = await StockTransaction.deleteMany(filter);
    res.json({ message: "Customer deleted", deletedTransactions: result.deletedCount });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete customer", error: error.message });
  }
});

router.get("/staff-customer-report", async (req, res) => {
  try {
    const rows = await StockTransaction.find({
      transactionType: "STOCK_OUT",
      staffMember: { $ne: "" },
      customerName: { $ne: "" },
    }).sort({ transactionDate: -1, createdAt: -1 });

    const staffMap = new Map();
    rows.forEach((x) => {
      const staff = x.staffMember || "Unknown Staff";
      const key = `${staff}|${x.customerName}|${x.customerMobile || ""}`;
      if (!staffMap.has(staff)) staffMap.set(staff, {
        staffMember: staff,
        customers: new Map(),
        totalQuantity: 0,
        totalSales: 0,
        transactions: 0,
      });
      const s = staffMap.get(staff);
      const customerKey = `${x.customerName}|${x.customerMobile || ""}`;
      if (!s.customers.has(customerKey)) {
        s.customers.set(customerKey, {
          customerName: x.customerName,
          customerMobile: x.customerMobile || "",
          totalQuantity: 0,
          totalSales: 0,
          transactions: 0,
          products: [],
        });
      }
      const c = s.customers.get(customerKey);
      c.totalQuantity += n(x.quantity);
      c.totalSales += n(x.totalAmount);
      c.transactions += 1;
      c.products.push({
        date: x.transactionDate || x.createdAt,
        invoiceNumber: x.invoiceNumber || "",
        productName: x.productName,
        productCode: x.productCode || "",
        packing: x.packing || "",
        packingType: x.packingType || "",
        unit: x.unit || "PCS",
        quantity: n(x.quantity),
        unitPrice: n(x.unitPrice),
        totalAmount: n(x.totalAmount),
      });
      s.totalQuantity += n(x.quantity);
      s.totalSales += n(x.totalAmount);
      s.transactions += 1;
    });

    const result = [...staffMap.values()].map((s) => ({
      staffMember: s.staffMember,
      totalQuantity: s.totalQuantity,
      totalSales: s.totalSales,
      transactions: s.transactions,
      customers: [...s.customers.values()],
    }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch staff-customer report", error: error.message });
  }
});

router.get("/dashboard-summary", async (req, res) => {
  try {
    const products = await Product.find();
    const history = await StockTransaction.find();
    const sales = history.filter((x) => x.transactionType === "STOCK_OUT");
    const returns = history.filter((x) => x.transactionType === "RETURN");
    const stockIn = history.filter((x) => x.transactionType === "STOCK_IN");
    const byProduct = {};
    sales.forEach((x) => {
      const key = String(x.product);
      if (!byProduct[key]) byProduct[key] = { productId: key, productName: x.productName, quantity: 0, sales: 0 };
      byProduct[key].quantity += n(x.quantity);
      byProduct[key].sales += n(x.totalAmount);
    });
    const topProducts = Object.values(byProduct).sort((a, b) => b.quantity - a.quantity).slice(0, 8);
    const totalSales = sales.reduce((s, x) => s + n(x.totalAmount), 0);
    const totalStockOutQty = sales.reduce((s, x) => s + n(x.quantity), 0);
    const totalStockInQty = stockIn.reduce((s, x) => s + n(x.quantity), 0);
    const totalReturnQty = returns.reduce((s, x) => s + n(x.quantity), 0);
    const customerMap = {};
    sales.forEach((x) => {
      const key = x.customerName || "Unknown";
      if (!customerMap[key]) customerMap[key] = { customerName: key, customerMobile: x.customerMobile || "", quantity: 0, purchase: 0 };
      customerMap[key].quantity += n(x.quantity);
      customerMap[key].purchase += n(x.totalAmount);
    });
    const topCustomers = Object.values(customerMap).sort((a, b) => b.purchase - a.purchase).slice(0, 10);
    res.json({ totalProducts: products.length, totalStock: products.reduce((s, p) => s + n(p.currentStock), 0), lowStock: products.filter((p) => n(p.currentStock) <= n(p.minimumStock)).length, totalSales, totalStockOutQty, totalStockInQty, totalReturnQty, topProducts, topCustomers });
  } catch (error) {
    res.status(500).json({ message: "Failed to build dashboard", error: error.message });
  }
});

router.get("/notifications", async (req, res) => {
  try {
    const products = await Product.find().sort({ currentStock: 1 });
    const low = products.filter((p) => n(p.currentStock) <= n(p.minimumStock)).map((p) => ({ productId: p._id, productName: p.productName, productCode: p.productCode, currentStock: n(p.currentStock), minimumStock: n(p.minimumStock), unit: p.unit }));
    res.json({ count: low.length, notifications: low });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch notifications", error: error.message });
  }
});

module.exports = router;
