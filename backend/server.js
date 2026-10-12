const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
const productRoutes = require("./routes/productRoutes");
const { router: authRoutes, ensureDefaultAdmin } = require("./routes/authRoutes");

app.use("/api/products", productRoutes);
app.use("/api/auth", authRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "Godown Stock Management API is running",
  });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected Successfully");
    ensureDefaultAdmin().catch((err) => console.error("Admin seed error:", err.message));

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log(`Godown Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB Connection Error:", error.message);
  });