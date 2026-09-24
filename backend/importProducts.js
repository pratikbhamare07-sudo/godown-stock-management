const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config();
const Product = require("./models/Product");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const file = path.join(__dirname, "data", "godown_products_import.json");
  const products = JSON.parse(fs.readFileSync(file, "utf8"));
  let added = 0;
  let skipped = 0;
  for (const item of products) {
    const exists = await Product.findOne({ productCode: item.productCode });
    if (exists) { skipped++; continue; }
    await Product.create({ ...item, sellingPrice: Number(item.sellingPrice || 0), openingStock: Number(item.openingStock || 0), currentStock: Number(item.currentStock || item.openingStock || 0), minimumStock: Number(item.minimumStock || 10) });
    added++;
  }
  console.log(`Import complete. Added: ${added}, Skipped existing: ${skipped}, Total file products: ${products.length}`);
  await mongoose.disconnect();
}
run().catch((err) => { console.error("Import failed:", err.message); process.exit(1); });
