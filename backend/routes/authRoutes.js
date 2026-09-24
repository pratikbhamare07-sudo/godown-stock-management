const express = require("express");
const crypto = require("crypto");
const User = require("../models/User");

const router = express.Router();

const hashPassword = (password) =>
  crypto.createHash("sha256").update(String(password)).digest("hex");

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  outlet: user.outlet || "",
  active: user.active,
});

async function ensureDefaultAdmin() {
  const email = "admin@godown.com";
  const passwordHash = hashPassword("admin123");
  const existing = await User.findOne({ email });

  if (!existing) {
    await User.create({
      name: "Godown Admin",
      email,
      passwordHash,
      role: "ADMIN",
      outlet: "Main Godown",
      active: true,
    });
    console.log("Default admin created: admin@godown.com / admin123");
    return;
  }

  // Keep the built-in admin account usable even if an older database
  // already contains this email with a different password/role/status.
  existing.name = "Godown Admin";
  existing.passwordHash = passwordHash;
  existing.role = "ADMIN";
  existing.outlet = "Main Godown";
  existing.active = true;
  await existing.save();
  console.log("Default admin ready: admin@godown.com / admin123");
}

router.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const user = await User.findOne({ email });

    if (!user || !user.active || user.passwordHash !== hashPassword(password)) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({ message: "Login successful", user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: error.message });
  }
});

router.get("/users", async (req, res) => {
  try {
    await ensureDefaultAdmin();
    const users = await User.find().select("-passwordHash").sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users", error: error.message });
  }
});

router.post("/users", async (req, res) => {
  try {
    const { name, email, password, role, outlet } = req.body;
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(400).json({ message: "Email already exists" });

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: hashPassword(password),
      role: role || "OUTLET_USER",
      outlet: outlet || "",
      active: true,
    });
    res.status(201).json({ message: "User added successfully", user: publicUser(user) });
  } catch (error) {
    res.status(400).json({ message: "Failed to add user", error: error.message });
  }
});

router.put("/users/:id", async (req, res) => {
  try {
    const { name, email, password, role, outlet, active } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (name !== undefined) user.name = String(name).trim();
    if (email !== undefined) user.email = String(email).trim().toLowerCase();
    if (role !== undefined) user.role = role;
    if (outlet !== undefined) user.outlet = outlet;
    if (active !== undefined) user.active = Boolean(active);
    if (password) {
      if (String(password).length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
      user.passwordHash = hashPassword(password);
    }
    await user.save();
    res.json({ message: "User updated successfully", user: publicUser(user) });
  } catch (error) {
    res.status(400).json({ message: "Failed to update user", error: error.message });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.email === "admin@godown.com") return res.status(400).json({ message: "Default admin cannot be deleted" });
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete user", error: error.message });
  }
});

module.exports = { router, ensureDefaultAdmin };
