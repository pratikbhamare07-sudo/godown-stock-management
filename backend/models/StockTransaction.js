const mongoose = require("mongoose");

const stockTransactionSchema = new mongoose.Schema(
  {
    transactionGroupId: { type: String, required: true, index: true },
    invoiceNumber: { type: String, default: "" },
    dcNumber: { type: String, default: "", trim: true },
    transactionDate: { type: Date, default: Date.now },
    quality: { type: String, default: "", trim: true },
    packing: { type: String, default: "", trim: true },
    packingType: { type: String, default: "", trim: true },
    unit: { type: String, default: "PCS", trim: true },

    // Staff member responsible for giving/selling the product to the customer.
    staffMember: { type: String, default: "", trim: true },
    staffUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    issuedBy: { type: String, default: "", trim: true },

    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    productCode: { type: String, default: "" },
    transactionType: {
      type: String,
      enum: ["STOCK_IN", "STOCK_OUT", "RETURN", "ADJUSTMENT"],
      required: true,
    },
    quantity: { type: Number, required: true, min: 1 },
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },
    unitPrice: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, default: 0, min: 0 },
    customerName: { type: String, default: "", trim: true },
    customerMobile: { type: String, default: "", trim: true },
    remarks: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StockTransaction", stockTransactionSchema);
