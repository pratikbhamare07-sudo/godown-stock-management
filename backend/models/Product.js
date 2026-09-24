const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    productName: { type: String, required: true, trim: true },
    productCode: { type: String, required: true, unique: true, trim: true },
    category: { type: String, default: "Other", trim: true },
    // Packing Size: 100 GM, 250 GM, 500 GM, 1 KG, 2 KG, 5 KG, 10 KG
    packing: { type: String, default: "", trim: true },
    // Packing Type: Pouch, Packet, Bag, Box, Bottle, Jar, Carton, Tin, Other
    packingType: { type: String, default: "Pouch", trim: true },
    // Stock counting unit
    unit: { type: String, required: true, default: "PCS", trim: true },
    sellingPrice: { type: Number, default: 0, min: 0 },
    openingStock: { type: Number, default: 0, min: 0 },
    currentStock: { type: Number, default: 0, min: 0 },
    minimumStock: { type: Number, default: 10, min: 0 },
    description: { type: String, default: "", trim: true, maxlength: 500 },
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
