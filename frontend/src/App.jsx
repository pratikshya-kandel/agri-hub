import { useEffect, useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";

const API_URL = "http://localhost:5000";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1518843875459-f738682238a6?w=800&auto=format&fit=crop&q=80";

const PRODUCE_IMAGES = [
  "https://images.unsplash.com/photo-1595856728581-22961d7638d2?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1518806118471-f28b20a1d79d?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1608681290684-2a62ffb8b0e7?w=800&auto=format&fit=crop&q=80",
];

const emptyProduct = {
  name: "",
  category: "Vegetables",
  price: "",
  stock: "",
};

function formatRs(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "Rs. 0";
  }
  return `Rs. ${number.toLocaleString("en-IN")}`;
}

export default function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState("buyer");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [authError, setAuthError] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  const [products, setProducts] = useState([]);
  const [searchText, setSearchText] = useState("");

  const [newProduct, setNewProduct] = useState(emptyProduct);

  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [activeTab, setActiveTab] = useState("dashboard");

  const loadProducts = async () => {
    try {
      const response = await fetch(`${API_URL}/api/products`);
      if (!response.ok) {
        throw new Error("Failed to load products.");
      }
      const data = await response.json();
      const formatted = data.map((item) => ({
        id: item.product_id,
        name: item.product_name || item.name || "Unnamed Product",
        category: "Fresh Produce",
        price: Number(item.price_per_kg ?? item.price) || 0,
        stock: Number(item.available_quantity ?? item.quantity) || 0,
        farmer: item.farmer_name || "Verified Grower",
        status: item.status || "Active",
        organic: Boolean(item.organic),
        unit: item.unit || "kg",
        image: item.image || FALLBACK_IMAGE,
      }));
      setProducts(formatted);
    } catch (error) {
      console.error("LOAD PRODUCTS ERROR:", error);
      toast.error("Could not load products from database.");
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setAuthError("");

    const endpoint = isLogin ? "/api/login" : "/api/register";
    const payload = isLogin
      ? { email: email.trim(), password, role }
      : { name: name.trim(), email: email.trim(), password, role };

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Authentication failed.");
      }
      setCurrentUser(data.user);
      setIsAuthenticated(true);
      setActiveTab("dashboard");
      toast.success(`Welcome, ${data.user.full_name || "User"}!`);
      setPassword("");
      setAuthError("");
    } catch (error) {
      console.error("AUTH ERROR:", error);
      setAuthError(error.message);
      toast.error(error.message);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setCart([]);
    setEmail("");
    setPassword("");
    setName("");
    setAuthError("");
    setActiveTab("dashboard");
    toast("You have been logged out.", { icon: "👋" });
  };

  const handleAddProduct = async (event) => {
    event.preventDefault();
    const productName = newProduct.name.trim();
    const price = Number(newProduct.price);
    const stock = Number(newProduct.stock);

    if (!productName) {
      toast.error("Please enter crop name.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Please enter a valid price.");
      return;
    }
    if (!Number.isFinite(stock) || stock < 0) {
      toast.error("Please enter a valid stock amount.");
      return;
    }
    if (!currentUser?.email) {
      toast.error("Please logout and login again as Farmer.");
      return;
    }

    const randomImage =
      PRODUCE_IMAGES[Math.floor(Math.random() * PRODUCE_IMAGES.length)];

    const payload = {
      product_name: productName,
      name: productName,
      price: price,
      price_per_kg: price,
      quantity: stock,
      available_quantity: stock,
      farmer_email: currentUser.email,
      farmer_name: currentUser.full_name,
      category_name: newProduct.category || "Vegetables",
      description: `Fresh ${productName} from local farming network.`,
      image: randomImage,
      minimum_order: 1,
      unit: "kg",
      organic: false,
    };

    try {
      const response = await fetch(`${API_URL}/api/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to add product.");
      }

      const product = data.product || {};
      const formattedProduct = {
        id: product.product_id || product.id || Date.now(),
        name: product.product_name || product.name || productName,
        category: newProduct.category,
        price: Number(product.price_per_kg ?? product.price ?? price) || 0,
        stock:
          Number(product.available_quantity ?? product.quantity ?? stock) || 0,
        farmer: currentUser?.full_name || "Verified Grower",
        status: product.status || "Active",
        organic: Boolean(product.organic),
        unit: product.unit || "kg",
        image: product.image || FALLBACK_IMAGE,
      };

      setProducts((previous) => [formattedProduct, ...previous]);
      setNewProduct(emptyProduct);
      toast.success("Product successfully added to database!");
      loadProducts();
    } catch (error) {
      console.error("ADD PRODUCT ERROR:", error);
      toast.error(error.message || "Database connection failed.");
    }
  };

  const addToCart = (product) => {
    setCart((previous) => [...previous, product]);
    toast.success(`${product.name} added to cart!`);
  };

  const removeFromCart = (index) => {
    setCart((previous) =>
      previous.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => total + (Number(item.price) || 0), 0);
  }, [cart]);

  const handleCheckout = () => {
    if (cart.length === 0) return;
    toast.success(
      `Payment of Rs. ${cartTotal.toLocaleString("en-IN")} processed!`,
      { duration: 4000 },
    );
    setCart([]);
    setIsCartOpen(false);
  };

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchText.toLowerCase()),
  );

  if (isAuthenticated && role === "buyer") {
    return (
      <div className="min-h-screen bg-gray-100 font-sans">
        <Toaster position="top-center" />
        <header className="bg-white shadow-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-6">
            <h1 className="text-3xl font-black text-green-600">
              Market<span className="text-orange-500">Hub</span>
            </h1>
            <div className="flex-1 max-w-2xl hidden md:flex">
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search fresh vegetables..."
                className="w-full bg-gray-100 px-4 py-3 rounded-l-lg outline-none border border-transparent focus:bg-white focus:border-green-500"
              />
              <button
                type="button"
                className="bg-orange-500 text-white px-6 rounded-r-lg font-bold"
              >
                Search
              </button>
            </div>
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                className="relative"
              >
                <span className="text-xl">🛒</span>
                {cart.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs rounded-full px-1.5">
                    {cart.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="text-gray-600 hover:text-red-500 font-bold"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-6">
          <section className="relative rounded-2xl overflow-hidden text-white shadow-xl mb-8 min-h-[250px]">
            <img
              src="https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=1400&auto=format&fit=crop&q=80"
              alt="Agriculture"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-green-950/75" />
            <div className="relative z-10 p-10">
              <span className="inline-block bg-orange-500 px-3 py-1 rounded-full text-xs font-bold mb-4">
                KISANLINK MARKETPLACE
              </span>
              <h2 className="text-4xl md:text-5xl font-black mb-4">
                From Farmer to Your Table.
              </h2>
              <p className="max-w-2xl text-green-50">
                Buy fresh products directly from local farmers without
                unnecessary middlemen.
              </p>
            </div>
          </section>

          <div className="flex items-center justify-between mb-5">
            <h2 className="text-2xl font-black text-gray-800">
              Live Database Inventory
            </h2>
            <span className="text-sm text-gray-500">
              {filteredProducts.length} products
            </span>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-xl p-10 text-center shadow">
              <p className="text-gray-500">No products found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="bg-white rounded-xl shadow hover:shadow-xl overflow-hidden"
                >
                  <div className="h-48 bg-gray-100">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <p className="text-xs text-green-600 font-bold uppercase mb-1">
                      Fresh Produce
                    </p>
                    <h3 className="text-lg font-black text-gray-800 truncate">
                      {product.name}
                    </h3>
                    <p className="text-xl font-black text-green-600 mt-2">
                      {formatRs(product.price)}
                      <span className="text-xs text-gray-400 font-normal">
                        {" "}
                        / kg
                      </span>
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      👨‍🌾 {product.farmer}
                    </p>
                    <p className="text-sm text-gray-500">
                      📦 Stock: {product.stock} kg
                    </p>
                    <button
                      type="button"
                      onClick={() => addToCart(product)}
                      className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-bold"
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {isCartOpen && (
          <div className="fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setIsCartOpen(false)}
            />
            <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
              <div className="p-5 border-b flex justify-between">
                <h2 className="text-xl font-black">Your Cart</h2>
                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  className="text-2xl"
                >
                  ×
                </button>
              </div>
              <div className="flex-1 overflow-auto p-5">
                {cart.length === 0 ? (
                  <p className="text-center text-gray-500 mt-10">
                    Cart is empty.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {cart.map((item, index) => (
                      <div
                        key={`${item.id}-${index}`}
                        className="flex justify-between items-center border-b pb-4"
                      >
                        <div>
                          <p className="font-bold">{item.name}</p>
                          <p className="text-green-600 font-bold">
                            {formatRs(item.price)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(index)}
                          className="text-red-500 font-bold"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t p-5">
                <div className="flex justify-between mb-4">
                  <span className="font-bold">Total</span>
                  <span className="text-2xl font-black text-green-600">
                    {formatRs(cartTotal)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={cart.length === 0}
                  className="w-full bg-orange-500 disabled:bg-gray-300 text-white py-3 rounded-xl font-bold"
                >
                  Proceed to Checkout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (isAuthenticated && role === "farmer") {
    return (
      <div className="min-h-screen bg-gray-50 flex font-sans">
        <Toaster position="top-center" />
        <aside className="w-64 bg-green-950 text-white hidden md:flex flex-col fixed h-full">
          <div className="p-6 border-b border-green-800">
            <h1 className="text-2xl font-black text-green-300">KisanLink</h1>
            <p className="text-xs text-green-200 mt-1">FARMER PORTAL</p>
          </div>
          <nav className="p-4 space-y-2">
            <button
              type="button"
              onClick={() => setActiveTab("dashboard")}
              className={`w-full text-left px-4 py-3 rounded-lg ${activeTab === "dashboard" ? "bg-green-800" : "hover:bg-green-900"}`}
            >
              🏠 Dashboard
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("products")}
              className={`w-full text-left px-4 py-3 rounded-lg ${activeTab === "products" ? "bg-green-800" : "hover:bg-green-900"}`}
            >
              🥕 Manage Products
            </button>
          </nav>
          <div className="mt-auto p-4">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white py-2 rounded-lg font-bold"
            >
              Logout
            </button>
          </div>
        </aside>

        <main className="flex-1 md:ml-64 p-6 md:p-10">
          {activeTab === "dashboard" && (
            <>
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h1 className="text-3xl font-black">Farm Dashboard</h1>
                  <p className="text-gray-500 mt-1">
                    Welcome, {currentUser?.full_name || "Farmer"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("products")}
                  className="bg-green-600 text-white px-5 py-3 rounded-lg font-bold"
                >
                  + Add New Yield
                </button>
              </div>
              <div className="grid md:grid-cols-3 gap-5">
                <div className="bg-white rounded-xl p-6 shadow">
                  <p className="text-gray-500">Total Products</p>
                  <p className="text-3xl font-black mt-2">{products.length}</p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow">
                  <p className="text-gray-500">Inventory Items</p>
                  <p className="text-3xl font-black mt-2">
                    {products.reduce((sum, item) => sum + item.stock, 0)}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow">
                  <p className="text-gray-500">Status</p>
                  <p className="text-3xl font-black text-green-600 mt-2">
                    Active
                  </p>
                </div>
              </div>
            </>
          )}

          {activeTab === "products" && (
            <div>
              <div className="mb-8">
                <h1 className="text-3xl font-black">Inventory Management</h1>
                <p className="text-gray-500 mt-1">
                  Add your produce to the marketplace.
                </p>
              </div>
              <div className="grid lg:grid-cols-3 gap-8">
                <div className="bg-white rounded-xl p-6 shadow">
                  <h2 className="text-xl font-black mb-5">Publish New Yield</h2>
                  <form onSubmit={handleAddProduct} className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">
                        Crop Name
                      </label>
                      <input
                        type="text"
                        required
                        value={newProduct.name}
                        onChange={(e) =>
                          setNewProduct({ ...newProduct, name: e.target.value })
                        }
                        placeholder="e.g. Tomato"
                        className="w-full border rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">
                        Category
                      </label>
                      <select
                        value={newProduct.category}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            category: e.target.value,
                          })
                        }
                        className="w-full border rounded-lg px-4 py-3 outline-none"
                      >
                        <option value="Vegetables">Vegetables</option>
                        <option value="Fruits">Fruits</option>
                        <option value="Grains">Grains</option>
                        <option value="Spices">Spices</option>
                        <option value="Dairy">Dairy</option>
                        <option value="Honey">Honey</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">
                        Price (Rs. / kg)
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={newProduct.price}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            price: e.target.value,
                          })
                        }
                        placeholder="80"
                        className="w-full border rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">
                        Stock (kg)
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={newProduct.stock}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            stock: e.target.value,
                          })
                        }
                        placeholder="50"
                        className="w-full border rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold"
                    >
                      Register Asset to Network
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-2 bg-white rounded-xl shadow overflow-hidden">
                  <div className="p-5 border-b bg-gray-50">
                    <h2 className="font-black">Live Database Items</h2>
                  </div>
                  {products.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      No products in database yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                          <tr>
                            <th className="px-5 py-4">Product</th>
                            <th className="px-5 py-4">Price</th>
                            <th className="px-5 py-4">Stock</th>
                          </tr>
                        </thead>
                        <tbody>
                          {products.map((product) => (
                            <tr key={product.id} className="border-t">
                              <td className="px-5 py-4 font-bold">
                                {product.name}
                              </td>
                              <td className="px-5 py-4 text-green-600 font-bold">
                                {formatRs(product.price)}
                              </td>
                              <td className="px-5 py-4">{product.stock} kg</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <Toaster position="top-center" />
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden md:flex">
        <div className="md:w-1/2 relative min-h-[320px] md:min-h-[650px] text-white p-10 flex flex-col justify-between overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1589923188900-85dae523342b?w=1200&auto=format&fit=crop&q=80"
            alt="Farm"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-green-950/80" />
          <div className="relative z-10">
            <h1 className="text-5xl font-black">
              Kisan<span className="text-orange-400">Link</span>
            </h1>
            <p className="text-green-200 font-bold mt-2">
              THE DIGITAL AGRI-MARKETPLACE
            </p>
          </div>
          <div className="relative z-10">
            <h2 className="text-4xl font-black mb-4">
              {isLogin
                ? "Welcome back to the farm."
                : "Join the digital harvest."}
            </h2>
            <p className="text-green-50 max-w-md">
              Fair trade, transparent pricing and direct connection between
              local farmers and customers.
            </p>
          </div>
          <div className="relative z-10 text-green-200 text-sm font-bold">
            Secure • Transparent • Local
          </div>
        </div>

        <div className="md:w-1/2 p-8 md:p-12 flex items-center">
          <div className="w-full max-w-md mx-auto">
            <div className="text-right text-sm mb-8 text-gray-500">
              {isLogin ? "New to KisanLink?" : "Already have an account?"}
              <button
                type="button"
                onClick={() => setIsLogin((value) => !value)}
                className="ml-2 text-green-600 font-bold"
              >
                {isLogin ? "Create an account" : "Sign in"}
              </button>
            </div>

            <h2 className="text-3xl font-black mb-7">
              {isLogin ? "Sign In" : "Create Account"}
            </h2>

            <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => setRole("buyer")}
                className={`flex-1 py-3 rounded-lg font-bold ${role === "buyer" ? "bg-white text-green-700 shadow" : "text-gray-500"}`}
              >
                Customer
              </button>
              <button
                type="button"
                onClick={() => setRole("farmer")}
                className={`flex-1 py-3 rounded-lg font-bold ${role === "farmer" ? "bg-white text-green-700 shadow" : "text-gray-500"}`}
              >
                Farmer
              </button>
            </div>

            {authError && (
              <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg mb-5 text-sm font-bold">
                {authError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div>
                  <label className="block font-bold text-sm mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ram Bahadur"
                    className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              )}
              <div>
                <label className="block font-bold text-sm mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block font-bold text-sm mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold shadow-lg"
              >
                {isLogin ? "Access Dashboard" : "Register Account"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
