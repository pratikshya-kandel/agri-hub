const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_kisanlink_key_2026";

app.use(cors());
app.use(express.json());

async function ensureFarmer({ fullName, email }) {
  if (!email) {
    throw new Error("Farmer email missing. Please logout and login again.");
  }

  const byEmail = await pool.query(
    "SELECT farmer_id, full_name FROM farmers WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))",
    [email],
  );
  if (byEmail.rows[0]) {
    return byEmail.rows[0];
  }

  const suffix = String(Date.now()).slice(-8);

  const created = await pool.query(
    `INSERT INTO farmers (
      full_name, email, password, phone_number, gender,
      date_of_birth, citizenship_number, province, district,
      municipality, ward_no
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING farmer_id, full_name`,
    [
      fullName || "New Farmer",
      email,
      "temppass",
      `98${suffix}`,
      "Male",
      "1990-01-01",
      `CN${suffix}`,
      "Gandaki",
      "Kaski",
      "Pokhara",
      5,
    ],
  );

  return created.rows[0];
}

async function ensureCategory(categoryName) {
  const name = categoryName || "Vegetables";

  const byName = await pool.query(
    "SELECT category_id, category_name FROM product_categories WHERE LOWER(category_name) = LOWER($1)",
    [name],
  );
  if (byName.rows[0]) return byName.rows[0];

  const anyCat = await pool.query(
    "SELECT category_id, category_name FROM product_categories LIMIT 1",
  );
  if (anyCat.rows[0]) return anyCat.rows[0];

  const created = await pool.query(
    `INSERT INTO product_categories (category_name)
     VALUES ($1)
     RETURNING category_id, category_name`,
    [name],
  );
  return created.rows[0];
}

app.get("/", (req, res) => {
  res.send("KisanLink Backend Server is running successfully!");
});

app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        error: "Name, email, password and role are required.",
      });
    }

    const userCheck = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (userCheck.rows.length > 0) {
      return res.status(409).json({
        error: "User with this email already exists!",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const bcryptPassword = await bcrypt.hash(password, salt);

    const newUser = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email, role`,
      [name, email, bcryptPassword, role],
    );

    if (role === "farmer") {
      try {
        await ensureFarmer({ fullName: name, email });
      } catch (farmerErr) {
        console.error("FARMER PROFILE CREATE:", farmerErr.message);
      }
    }

    const token = jwt.sign({ user_id: newUser.rows[0].id }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res.status(201).json({
      message: "Registration successful",
      token,
      user: newUser.rows[0],
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({
        error: "Email, password and role are required.",
      });
    }

    const user = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (user.rows.length === 0) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }

    if (user.rows[0].role !== role) {
      return res.status(401).json({
        error: `Account exists, but not as a ${role}. Please switch roles.`,
      });
    }

    const validPassword = await bcrypt.compare(
      password,
      user.rows[0].password_hash,
    );
    if (!validPassword) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }

    if (role === "farmer") {
      try {
        await ensureFarmer({
          fullName: user.rows[0].full_name,
          email: user.rows[0].email,
        });
      } catch (farmerErr) {
        console.error("FARMER PROFILE ENSURE:", farmerErr.message);
      }
    }

    const token = jwt.sign({ user_id: user.rows[0].id }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.rows[0].id,
        full_name: user.rows[0].full_name,
        email: user.rows[0].email,
        role: user.rows[0].role,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/products", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        p.product_id,
        p.product_name,
        p.description,
        p.image,
        p.price_per_kg,
        p.available_quantity,
        p.minimum_order,
        p.unit,
        p.organic,
        p.harvest_date,
        p.expiry_date,
        p.status,
        p.created_at,
        f.full_name AS farmer_name
      FROM products p
      LEFT JOIN farmers f ON p.farmer_id = f.farmer_id
      ORDER BY p.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("GET PRODUCTS ERROR:", err);
    res.status(500).json({ error: "Server error while fetching products." });
  }
});

app.post("/api/products", async (req, res) => {
  try {
    const {
      product_name,
      name,
      description,
      image,
      price_per_kg,
      price,
      available_quantity,
      quantity,
      minimum_order,
      unit,
      organic,
      farmer_email,
      farmer_name,
      category_name,
      harvest_date,
      expiry_date,
    } = req.body;

    const finalName = product_name || name;
    const parsedPrice = Number(price_per_kg ?? price);
    const parsedQty = Number(available_quantity ?? quantity);

    if (!finalName || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({
        error: "Valid product name and price are required.",
      });
    }
    if (!Number.isFinite(parsedQty) || parsedQty < 0) {
      return res.status(400).json({ error: "Valid quantity is required." });
    }

    const farmer = await ensureFarmer({
      fullName: farmer_name,
      email: farmer_email,
    });
    const category = await ensureCategory(category_name);

    const newProduct = await pool.query(
      `INSERT INTO products (
          farmer_id, category_id, product_name, description, image,
          price_per_kg, available_quantity, minimum_order, unit, organic,
          harvest_date, expiry_date
        )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        farmer.farmer_id,
        category.category_id,
        finalName,
        description || `Fresh ${finalName} from local farming network.`,
        image || null,
        parsedPrice,
        parsedQty,
        minimum_order ?? 1,
        unit || "kg",
        organic ?? false,
        harvest_date || null,
        expiry_date || null,
      ],
    );

    res.status(201).json({
      message: "Product added successfully.",
      product: newProduct.rows[0],
    });
  } catch (err) {
    console.error("ADD PRODUCT ERROR:", err);
    res.status(500).json({
      error: err.message || "Server error while adding product.",
    });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Route not found", path: req.originalUrl });
});

app.listen(PORT, () => {
  console.log(`Backend Server is running on http://localhost:${PORT}`);
});
