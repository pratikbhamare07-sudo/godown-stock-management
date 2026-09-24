import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API = import.meta.env.VITE_API_URL || (
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000/api/products"
    : "https://godown-stock-management-2.onrender.com/api/products"
);
const AUTH_API = API.replace("/api/products", "/api/auth");
const PACKING_OPTIONS = ["100 GM", "250 GM", "500 GM", "1 KG", "2 KG", "5 KG", "10 KG"];
const PACKING_TYPE_OPTIONS = ["Pouch", "Packet", "Bag", "Box", "Bottle", "Jar", "Carton", "Tin", "Other"];
const UNIT_OPTIONS = ["PCS", "GM", "KG", "BOX", "PACK", "POUCH", "BOTTLE", "LTR"];
const emptyItem = () => ({ productId: "", quantity: "", rate: "" });

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem("godown_logged_in") === "true");
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("godown_user") || "null"); } catch { return null; }
  });
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [summary, setSummary] = useState(null);
  const [activeMenu, setActiveMenu] = useState("Dashboard");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [bill, setBill] = useState(null);
  const [productForm, setProductForm] = useState({
    productName: "", productCode: "", category: "", packing: "", packingType: "Pouch",
    unit: "PCS", sellingPrice: "", openingStock: "", minimumStock: "10", description: ""
  });
  const [stockInMeta, setStockInMeta] = useState({ dcNumber: "", transactionDate: new Date().toISOString().slice(0,10) });
  const [dashboardFilters, setDashboardFilters] = useState({ from: "", to: "", staff: "", customer: "" });
  const [editingProductId, setEditingProductId] = useState(null);
  const [stockIn, setStockIn] = useState({ items: [emptyItem()], remarks: "" });
  const [sale, setSale] = useState({ customerName: "", customerMobile: "", staffMember: "", staffUserId: "", dcNumber: "", transactionDate: new Date().toISOString().slice(0,10), items: [emptyItem()], remarks: "" });
  const [ret, setRet] = useState({ customerName: "", customerMobile: "", invoiceNumber: "", items: [emptyItem()], remarks: "Product Return" });

  const request = async (url, options = {}) => {
    const res = await fetch(url, { headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Request failed");
    return data;
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      const [p, h, c, no, s] = await Promise.all([
        request(API), request(`${API}/history`), request(`${API}/customers`), request(`${API}/notifications`), request(`${API}/dashboard-summary`),
      ]);
      setProducts(p); setHistory(h); setCustomers(c); setNotifications(no.notifications || []); setSummary(s);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const loadUsers = async () => {
    try { const data = await request(`${AUTH_API}/users`); setUsers(data); }
    catch (e) { console.error(e); }
  };

  const handleLogin = async (email, password) => {
    const data = await request(`${AUTH_API}/login`, {
      method: "POST", body: JSON.stringify({ email, password })
    });
    localStorage.setItem("godown_logged_in", "true");
    localStorage.setItem("godown_user", JSON.stringify(data.user));
    setCurrentUser(data.user);
    setIsLoggedIn(true);
  };

  useEffect(() => { if (isLoggedIn) { loadAll(); loadUsers(); } }, [isLoggedIn]);

  const addUser = async (payload) => {
    await request(`${AUTH_API}/users`, { method: "POST", body: JSON.stringify(payload) });
    await loadUsers();
  };
  const updateUser = async (id, payload) => {
    await request(`${AUTH_API}/users/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    await loadUsers();
  };
  const deleteUser = async (id) => {
    await request(`${AUTH_API}/users/${id}`, { method: "DELETE" });
    await loadUsers();
  };

  const totalStock = summary?.totalStock ?? products.reduce((a, p) => a + Number(p.currentStock || 0), 0);
  const lowStock = notifications.length;
  const filteredProducts = products.filter((p) => `${p.productName} ${p.productCode} ${p.category} ${p.packing}`.toLowerCase().includes(search.toLowerCase()));
  const today = new Date().toDateString();
  const todayIn = history.filter((x) => x.transactionType === "STOCK_IN" && new Date(x.createdAt).toDateString() === today).reduce((a, x) => a + Number(x.quantity || 0), 0);
  const todaySales = history.filter((x) => x.transactionType === "STOCK_OUT" && new Date(x.createdAt).toDateString() === today).reduce((a, x) => a + Number(x.totalAmount || 0), 0);

  const setItem = (setter, index, field, value) => setter((old) => ({ ...old, items: old.items.map((it, i) => i === index ? { ...it, [field]: value } : it) }));
  const addItem = (setter) => setter((old) => ({ ...old, items: [...old.items, emptyItem()] }));
  const removeItem = (setter, index) => setter((old) => ({ ...old, items: old.items.filter((_, i) => i !== index).length ? old.items.filter((_, i) => i !== index) : [emptyItem()] }));

  const resetProductForm = () => {
    setProductForm({
      productName: "", productCode: "", category: "", packing: "", packingType: "Pouch",
      unit: "PCS", sellingPrice: "", openingStock: "", minimumStock: "10", description: ""
    });
    setEditingProductId(null);
  };

  const openAddProduct = () => { resetProductForm(); setModal("product"); };

  const openEditProduct = (product) => {
    setEditingProductId(product._id);
    setProductForm({
      productName: product.productName || "", productCode: product.productCode || "", category: product.category || "",
      packing: product.packing || "", packingType: product.packingType || "Pouch",
      unit: product.unit || "PCS", sellingPrice: product.sellingPrice ?? "",
      openingStock: product.openingStock ?? 0, minimumStock: product.minimumStock ?? 10, description: product.description || "",
    });
    setModal("product");
  };

  const deleteProduct = async (id) => {
    if (!window.confirm("Delete this product? This action cannot be undone.")) return;
    try {
      await request(`${API}/${id}`, { method: "DELETE" });
      alert("Product deleted successfully");
      loadAll();
    } catch (e) { alert(e.message); }
  };


  const deleteCustomer = async (customer) => {
    if (!window.confirm(`Delete customer ${customer.customerName}? Their saved sales history will also be removed.`)) return;
    try { await request(`${API}/customers`, { method: "DELETE", body: JSON.stringify({ customerName: customer.customerName, customerMobile: customer.customerMobile || "" }) }); alert("Customer deleted successfully"); loadAll(); } catch (e) { alert(e.message); }
  };

  const submitProduct = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...productForm, packing: productForm.packing, packingType: productForm.packingType, unit: productForm.unit, sellingPrice: Number(productForm.sellingPrice || 0), openingStock: Number(productForm.openingStock || 0), minimumStock: Number(productForm.minimumStock || 0) };
      if (editingProductId) {
        await request(`${API}/${editingProductId}`, { method: "PUT", body: JSON.stringify(payload) });
        alert("Product updated successfully");
      } else {
        await request(API, { method: "POST", body: JSON.stringify(payload) });
        alert("Product added successfully");
      }
      resetProductForm(); setModal(null); loadAll();
    } catch (e) { alert(e.message); }
  };

  const submitStockIn = async (e) => {
    e.preventDefault();
    try { await request(`${API}/stock-in-multiple`, { method: "POST", body: JSON.stringify({ ...stockIn, ...stockInMeta, items: stockIn.items.map((x) => ({ ...x, quantity: Number(x.quantity) })) }) }); alert("Multiple Stock In successful"); setStockIn({ items: [emptyItem()], remarks: "" }); setStockInMeta({ dcNumber: "", transactionDate: new Date().toISOString().slice(0,10) }); loadAll(); }
    catch (e) { alert(e.message); }
  };

  const submitSale = async (e) => {
    e.preventDefault();
    if (!sale.customerName.trim()) return alert("Customer Name is required");
    try {
      const data = await request(`${API}/stock-out-multiple`, { method: "POST", body: JSON.stringify({
        ...sale,
        staffUserId: sale.staffUserId || null,
        issuedBy: currentUser?.name || "",
        items: sale.items.map((x) => ({ ...x, quantity: Number(x.quantity) }))
      }) });
      setBill(data); setSale({ customerName: "", customerMobile: "", staffMember: "", staffUserId: "", dcNumber: "", transactionDate: new Date().toISOString().slice(0,10), items: [emptyItem()], remarks: "" }); loadAll();
    } catch (e) { alert(e.message); }
  };

  const submitReturn = async (e) => {
    e.preventDefault();
    if (!ret.customerName.trim()) return alert("Customer Name is required");
    try { await request(`${API}/return-multiple`, { method: "POST", body: JSON.stringify({ ...ret, items: ret.items.map((x) => ({ ...x, quantity: Number(x.quantity) })) }) }); alert("Product return successful"); setRet({ customerName: "", customerMobile: "", invoiceNumber: "", items: [emptyItem()], remarks: "Product Return" }); loadAll(); }
    catch (e) { alert(e.message); }
  };

  const logout = () => {
    localStorage.removeItem("godown_logged_in");
    localStorage.removeItem("godown_user");
    setCurrentUser(null);
    setIsLoggedIn(false);
    setActiveMenu("Dashboard");
  };

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const nav = [
    ["Dashboard", "▦"], ["Products", "▣"], ["Stock In", "↑"], ["Stock Out / Sale", "↓"], ["Customers", "♙"], ["Stock History", "☷"], ["Returns", "↩"], ["Low Stock", "!"], ["Reports", "◫"], ...(currentUser?.role === "ADMIN" ? [["Analytics", "◈"], ["Users", "♙"]] : []), ["Notifications", "♢"],
  ];

  const title = activeMenu === "Stock Out / Sale" ? "Stock Out & Sales" : activeMenu;

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">G</div><div><b>GODOWN</b><span>Stock Management</span></div></div>
      <div className="menu-label">MAIN MENU</div>
      {nav.map(([name, icon]) => <button key={name} className={`nav-btn ${activeMenu === name ? "active" : ""}`} onClick={() => setActiveMenu(name)}><i>{icon}</i>{name}{name === "Notifications" && notifications.length > 0 ? <em>{notifications.length}</em> : null}</button>)}
      <div className="sidebar-footer"><span className="online"></span><div><b>Godown Online</b><small>System Active</small></div></div>
    </aside>

    <main className="main">
      <header className="header"><div><small>Good Morning 👋</small><h1>{title}</h1></div><div className="header-actions"><button className="bell" onClick={() => setActiveMenu("Notifications")}>♢{notifications.length > 0 && <span>{notifications.length}</span>}</button><div className="admin"><div className="avatar">{(currentUser?.name || "U").slice(0,1).toUpperCase()}</div><div><b>{currentUser?.name || "Godown User"}</b><small>{currentUser?.role === "ADMIN" ? "Administrator" : currentUser?.role === "WAREHOUSE_USER" ? "Warehouse User" : "Outlet User"}{currentUser?.outlet ? ` · ${currentUser.outlet}` : ""}</small></div><button className="logout-btn" onClick={logout}>Logout</button></div></div></header>

      {loading ? <div className="loading">Loading godown data...</div> : <>
        {activeMenu === "Dashboard" && <Dashboard summary={summary} products={products} notifications={notifications} history={history} filters={dashboardFilters} setFilters={setDashboardFilters} todayIn={todayIn} todaySales={todaySales} totalStock={totalStock} lowStock={lowStock} setActiveMenu={setActiveMenu} onAddProduct={openAddProduct} isAdmin={currentUser?.role === "ADMIN"} userCount={users.length} />}
        {activeMenu === "Products" && <Products products={filteredProducts} search={search} setSearch={setSearch} onAdd={openAddProduct} onEdit={openEditProduct} onDelete={deleteProduct} />}
        {activeMenu === "Stock In" && <Operation title="Multiple Stock In" subtitle="Receive many products in one transaction" items={stockIn.items} setItem={(i,f,v)=>setItem(setStockIn,i,f,v)} add={()=>addItem(setStockIn)} remove={(i)=>removeItem(setStockIn,i)} remarks={stockIn.remarks} setRemarks={(v)=>setStockIn(s=>({...s,remarks:v}))} meta={stockInMeta} setMeta={setStockInMeta} onSubmit={submitStockIn} products={products} />}
        {activeMenu === "Stock Out / Sale" && <SalePage sale={sale} setSale={setSale} products={products} customers={customers} users={users} setItem={(i,f,v)=>setItem(setSale,i,f,v)} add={()=>addItem(setSale)} remove={(i)=>removeItem(setSale,i)} onSubmit={submitSale} />}
        {activeMenu === "Customers" && <Customers customers={customers} onDelete={deleteCustomer} />}
        {activeMenu === "Stock History" && <History history={history} />}
        {activeMenu === "Returns" && <ReturnPage ret={ret} setRet={setRet} products={products} setItem={(i,f,v)=>setItem(setRet,i,f,v)} add={()=>addItem(setRet)} remove={(i)=>removeItem(setRet,i)} onSubmit={submitReturn} />}
        {activeMenu === "Low Stock" && <LowStock notifications={notifications} />}
        {activeMenu === "Notifications" && <Notifications notifications={notifications} />}
        {activeMenu === "Reports" && <Reports summary={summary} history={history} products={products} customers={customers} />}{activeMenu === "Analytics" && currentUser?.role === "ADMIN" && <Analytics history={history} products={products} />}{activeMenu === "Users" && currentUser?.role === "ADMIN" && <Users users={users} onAdd={addUser} onUpdate={updateUser} onDelete={deleteUser} />}
      </>}
    </main>

    {modal === "product" && <div className="modal-bg"><div className="modal"><div className="modal-head"><div><h2>{editingProductId ? "Edit Product" : "Add Product"}</h2><p>Store complete product master data</p></div><button onClick={()=>setModal(null)}>×</button></div><form onSubmit={submitProduct} className="form-grid">
      <div className="product-form-intro full"><div className="product-form-icon">＋</div><div><b>Product Master</b><span>Add complete product details. Fields marked * are required.</span></div></div><Field label="Product Name *" name="productName" value={productForm.productName} set={setProductForm} required placeholder="e.g. Raisins Baswant" /><Field label="Product Code *" name="productCode" value={productForm.productCode} set={setProductForm} required placeholder="e.g. RAI001" /><label className="field"><span>Category</span><select value={productForm.category} onChange={e=>setProductForm(s=>({...s,category:e.target.value}))}><option value="">Select Category</option><option>Honey</option><option>Raisins</option><option>Processed Food</option><option>Dry Fruits</option><option>Drinks</option><option>Chocolate</option><option>Other</option></select></label><label className="field"><span>Packing Size</span><select value={productForm.packing} onChange={e=>setProductForm(s=>({...s,packing:e.target.value}))}><option value="">Select Packing Size</option>{PACKING_OPTIONS.map(x=><option key={x}>{x}</option>)}</select></label><label className="field"><span>Packing Type</span><select value={productForm.packingType} onChange={e=>setProductForm(s=>({...s,packingType:e.target.value}))}>{PACKING_TYPE_OPTIONS.map(x=><option key={x}>{x}</option>)}</select></label><label className="field"><span>Unit</span><select value={productForm.unit} onChange={e=>setProductForm(s=>({...s,unit:e.target.value}))}>{UNIT_OPTIONS.map(x=><option key={x}>{x}</option>)}</select></label><Field label="Selling Price (₹)" name="sellingPrice" type="number" value={productForm.sellingPrice} set={setProductForm} placeholder="0.00" /><Field label="Opening Stock" name="openingStock" type="number" value={productForm.openingStock} set={setProductForm} placeholder="0" /><Field label="Minimum Stock" name="minimumStock" type="number" value={productForm.minimumStock} set={setProductForm} placeholder="10" /><label className="field full"><span>Description</span><textarea name="description" value={productForm.description} onChange={e=>setProductForm(s=>({...s,description:e.target.value}))} placeholder="Add product details, quality, brand or notes..."></textarea></label><div className="category-note full"><b>Smart inventory:</b> Opening Stock becomes current stock automatically. Low-stock alerts use Minimum Stock.</div>
      <div className="modal-actions"><button type="button" className="secondary" onClick={()=>{setModal(null);resetProductForm();}}>Cancel</button><button className="primary">{editingProductId ? "Update Product" : "Save Product"}</button></div>
    </form></div></div>}
    {bill && <Bill bill={bill} close={()=>setBill(null)} />}
  </div>;
}

function Field({label,name,value,set,type="text",required,placeholder}) { return <label className="field"><span>{label}</span><input type={type} name={name} value={value} required={required} placeholder={placeholder} min={type === "number" ? 0 : undefined} onChange={e=>set(s=>({...s,[name]:e.target.value}))} /></label>; }

function Dashboard({summary, products, notifications, history, filters, setFilters, todayIn, todaySales, totalStock, lowStock, setActiveMenu, onAddProduct, isAdmin, userCount}) {
  const filteredSales = history.filter(x => {
    if (x.transactionType !== "STOCK_OUT") return false;
    const d = new Date(x.createdAt);
    const day = d.toISOString().slice(0,10);
    if (filters.from && day < filters.from) return false;
    if (filters.to && day > filters.to) return false;
    if (filters.staff && (x.staffMember || "").toLowerCase() !== filters.staff.toLowerCase()) return false;
    if (filters.customer && !(x.customerName || "").toLowerCase().includes(filters.customer.toLowerCase())) return false;
    return true;
  });
  const byProduct = {};
  filteredSales.forEach(x => {
    const key = String(x.product);
    if (!byProduct[key]) byProduct[key] = { productId:key, productName:x.productName, packing:x.packing||"", quantity:0, sales:0 };
    byProduct[key].quantity += Number(x.quantity||0);
    byProduct[key].sales += Number(x.totalAmount||0);
  });
  const top = Object.values(byProduct).sort((a,b)=>b.quantity-a.quantity).slice(0,10);
  const max = Math.max(...top.map(x=>x.quantity),1);
  const totalQty = filteredSales.reduce((a,x)=>a+Number(x.quantity||0),0);
  const totalAmount = filteredSales.reduce((a,x)=>a+Number(x.totalAmount||0),0);
  const staffOptions=[...new Set(history.filter(x=>x.staffMember).map(x=>x.staffMember))];
  const customerOptions=[...new Set(history.filter(x=>x.transactionType==="STOCK_OUT" && x.customerName).map(x=>x.customerName))];
  return <>
    <div className="page-head"><div><h2>Godown Stock Overview</h2><p>Highest product sales with date, staff and customer filters.</p></div><button className="primary" onClick={onAddProduct}>+ Add Product</button></div>
    <div className="card filter-card"><div className="filter-title"><b>Sales Filters</b><button className="link" onClick={()=>setFilters({from:"",to:"",staff:"",customer:""})}>Clear</button></div>
      <div className="filter-grid"><label className="field"><span>From Date</span><input type="date" value={filters.from} onChange={e=>setFilters({...filters,from:e.target.value})}/></label><label className="field"><span>To Date</span><input type="date" value={filters.to} onChange={e=>setFilters({...filters,to:e.target.value})}/></label>
      <label className="field"><span>Staff / Godown Member</span><select value={filters.staff} onChange={e=>setFilters({...filters,staff:e.target.value})}><option value="">All Staff</option>{staffOptions.map(x=><option key={x}>{x}</option>)}</select></label>
      <label className="field"><span>Customer</span><input list="dashboard-customers" placeholder="Search customer" value={filters.customer} onChange={e=>setFilters({...filters,customer:e.target.value})}/><datalist id="dashboard-customers">{customerOptions.map(x=><option key={x} value={x}/>)}</datalist></label></div>
    </div>
    <section className="stats"><Stat icon="▣" label="Total Products" value={summary?.totalProducts ?? products.length} note="Product master"/><Stat icon="◈" label="Current Stock" value={totalStock} note="Available quantity"/><Stat icon="↓" label="Filtered Qty" value={totalQty} note="Customer sales"/><Stat icon="₹" label="Filtered Sales" value={`₹${totalAmount.toLocaleString("en-IN")}`} note="Selected period"/><Stat icon="!" label="Low Stock" value={lowStock} note="Needs attention" danger/></section>
    {isAdmin && <section className="card" style={{marginBottom:16}}><div className="card-title"><div><h3>Admin Control Center</h3><p>Quick access to system management.</p></div><span className="status active">Administrator</span></div><div className="stats"><Stat icon="♙" label="System Users" value={userCount} note="Active user records"/><Stat icon="▣" label="Product Master" value={products.length} note="Manage products"/><Stat icon="!" label="Alerts" value={notifications.length} note="Low-stock alerts" danger/></div><div className="row-actions" style={{marginTop:12}}><button className="primary" onClick={()=>setActiveMenu("Users")}>Manage Users</button><button className="secondary" onClick={()=>setActiveMenu("Analytics")}>Open Analytics</button><button className="secondary" onClick={onAddProduct}>Add Product</button></div></section>}
    <section className="dash-grid">
      <div className="card"><div className="card-title"><div><h3>Highest Product List</h3><p>{filteredSales.length} sale entries · sorted by quantity</p></div><button className="link" onClick={()=>setActiveMenu("Reports")}>View Reports →</button></div>{top.length ? <div className="bars">{top.map(x=><div className="bar-row" key={x.productId}><span title={x.productName}>{x.productName} {x.packing ? `(${x.packing})` : ""}</span><div><b style={{width:`${Math.max(4,(x.quantity/max)*100)}%`}}></b></div><strong>{x.quantity}</strong></div>)}</div> : <Empty text="No matching sales found."/>}</div>
      <div className="card"><div className="card-title"><div><h3>Staff / Customer Result</h3><p>Who gave how much to customers</p></div></div>{filteredSales.slice(0,10).map(x=><div className="alert-row" key={x._id}><span>↓</span><div><b>{x.staffMember||"Not set"} → {x.customerName}</b><small>{new Date(x.createdAt).toLocaleDateString("en-IN")} · {x.productName}</small></div><strong>{x.quantity}</strong></div>)}{!filteredSales.length&&<Empty text="Apply filters after Stock Out/Sale entries."/>}</div>
    </section>
    <section className="dash-grid lower"><div className="card"><div className="card-title"><div><h3>Current Stock</h3><p>Latest inventory status</p></div><button className="link" onClick={()=>setActiveMenu("Products")}>View All →</button></div><StockTable products={products.slice(0,8)}/></div><div className="card"><div className="card-title"><div><h3>Low Stock Alerts</h3><p>Products at or below minimum</p></div><button className="link" onClick={()=>setActiveMenu("Low Stock")}>View →</button></div>{notifications.slice(0,6).map(x=><div className="alert-row" key={x.productId}><span>!</span><div><b>{x.productName}</b><small>{x.productCode}</small></div><strong>{x.currentStock} / min {x.minimumStock}</strong></div>)}{!notifications.length&&<Empty text="All products are above minimum stock."/>}</div></section>
  </>;
}
function Stat({icon,label,value,note,danger}) { return <div className={`stat ${danger?"danger":""}`}><div className="stat-icon">{icon}</div><div><span>{label}</span><h3>{value}</h3><small>{note}</small></div></div>; }
function Empty({text}) { return <div className="empty"><div>▦</div><p>{text}</p></div>; }
function StockTable({products}) { return <div className="table-wrap"><table><thead><tr><th>Product</th><th>Code</th><th>Packing</th><th>Stock</th><th>Status</th></tr></thead><tbody>{products.map(p=><tr key={p._id}><td><b>{p.productName}</b></td><td>{p.productCode}</td><td>{p.packing||"-"}</td><td><b>{p.currentStock}</b> {p.unit}</td><td><span className={`status ${Number(p.currentStock)<=Number(p.minimumStock)?"low":"ok"}`}>{Number(p.currentStock)<=Number(p.minimumStock)?"Low":"Available"}</span></td></tr>)}</tbody></table></div>; }

function Products({products,search,setSearch,onAdd,onEdit,onDelete}) {
  const filtered=products.filter(p=>`${p.productName} ${p.productCode} ${p.category} ${p.packing}`.toLowerCase().includes(search.toLowerCase()));
  const groups=filtered.reduce((a,p)=>{const c=p.category||"Other";(a[c]||(a[c]=[])).push(p);return a;},{});
  return <div><div className="page-head"><div><h2>Product Master</h2><p>Category-wise product lists — Honey, Raisins and other categories stay separate.</p></div><button className="primary" onClick={onAdd}>+ Add Product</button></div><div className="card"><div className="toolbar"><input placeholder="Search product, code, category..." value={search} onChange={e=>setSearch(e.target.value)}/><span>{filtered.length} products</span></div>{Object.keys(groups).sort().map(cat=><div className="category-section" key={cat}><div className="category-heading"><h3>{cat}</h3><span>{groups[cat].length} product(s)</span></div><div className="table-wrap"><table><thead><tr><th>Product</th><th>Code</th><th>Category</th><th>Packing Size</th><th>Packing Type</th><th>Unit</th><th>Description</th><th>Price</th><th>Stock</th><th>Min</th><th>Status</th><th>Actions</th></tr></thead><tbody>{groups[cat].map(p=><tr key={p._id}><td><b>{p.productName}</b></td><td>{p.productCode}</td><td>{p.category||"-"}</td><td>{p.packing||"-"}</td><td>{p.packingType||"-"}</td><td>{p.unit||"PCS"}</td><td className="description-cell" title={p.description||""}>{p.description||"-"}</td><td>₹{Number(p.sellingPrice||0).toLocaleString("en-IN")}</td><td>{p.currentStock} {p.unit}</td><td>{p.minimumStock}</td><td><span className={Number(p.currentStock)<=Number(p.minimumStock)?"status low":"status active"}>{Number(p.currentStock)<=Number(p.minimumStock)?"Low":"Active"}</span></td><td><div className="row-actions"><button className="secondary small-btn" onClick={()=>onEdit(p)}>Edit</button><button className="danger small-btn" onClick={()=>onDelete(p._id)}>Delete</button></div></td></tr>)}</tbody></table></div></div>)}{!filtered.length&&<Empty text="No products found."/>}</div></div>;
}
function Operation({title,subtitle,items,setItem,add,remove,remarks,setRemarks,onSubmit,products,meta,setMeta}) {
 const total=items.reduce((a,x)=>a+Number(x.quantity||0),0);
 const grouped=products.reduce((a,p)=>{const c=p.category||"Other";(a[c]||(a[c]=[])).push(p);return a;},{});
 return <div><div className="page-head"><div><h2>{title}</h2><p>{subtitle}</p></div></div><form onSubmit={onSubmit} className="card operation">
 {meta && <div className="customer-grid stock-in-meta"><label className="field"><span>DC No. *</span><input value={meta.dcNumber || ""} onChange={e=>setMeta(s=>({...s,dcNumber:e.target.value}))} placeholder="e.g. DC-00125" required/></label><label className="field"><span>Stock In Date *</span><input type="date" value={meta.transactionDate} onChange={e=>setMeta(s=>({...s,transactionDate:e.target.value}))} required/></label></div>}
 <div className="section-title"><h3>Products</h3><span>{items.length} line(s) · {total} total qty</span></div>
 {items.map((item,i)=><div className="item-row" key={i}><select value={item.productId} onChange={e=>setItem(i,"productId",e.target.value)} required><option value="">Select product</option>{Object.keys(grouped).sort().map(cat=><optgroup label={cat} key={cat}>{grouped[cat].map(p=><option value={p._id} key={p._id}>{p.productName} — {p.packing||"-"} ({p.currentStock} {p.unit})</option>)}</optgroup>)}</select><input type="number" min="1" placeholder="Quantity" value={item.quantity} onChange={e=>setItem(i,"quantity",e.target.value)} required/><button type="button" className="remove" onClick={()=>remove(i)}>×</button></div>)}
 <button type="button" className="add-line" onClick={add}>+ Add another product</button><label className="field full"><span>Remarks</span><textarea value={remarks} onChange={e=>setRemarks(e.target.value)} placeholder="Supplier / purchase / note"></textarea></label><div className="submit-row"><button className="primary">Save Multiple Stock In</button></div></form></div>;
}
function SalePage({sale,setSale,products,customers,users,setItem,add,remove,onSubmit}) {
 const total=sale.items.reduce((a,x)=>{const p=products.find(y=>y._id===x.productId);return a+Number(x.quantity||0)*(x.rate!==""?Number(x.rate||0):Number(p?.sellingPrice||0))},0);
 const grouped=products.reduce((a,p)=>{const c=p.category||"Other";(a[c]||(a[c]=[])).push(p);return a;},{});
 const customerOptions=[...new Set(customers.map(c=>c.customerName).filter(Boolean))];
 return <div><div className="page-head"><div><h2>Stock Out / Sale</h2><p>Select staff member, search customer, choose packing and enter manual rate.</p></div></div><form onSubmit={onSubmit} className="card operation">
 <div className="customer-grid"><label className="field"><span>Godown Staff Member *</span><select value={sale.staffUserId} onChange={e=>{const u=users.find(x=>x._id===e.target.value || x.id===e.target.value);setSale(s=>({...s,staffUserId:e.target.value,staffMember:u?.name||""}))}} required><option value="">Select Staff Member</option>{users.filter(u=>u.active && u.role !== "ADMIN").map(u=><option value={u._id || u.id} key={u._id || u.id}>{u.name} — {u.role==="WAREHOUSE_USER"?"Godown Staff":"Staff"}{u.outlet?` · ${u.outlet}`:""}</option>)}</select></label><label className="field"><span>DC No.</span><input value={sale.dcNumber} onChange={e=>setSale(s=>({...s,dcNumber:e.target.value}))} placeholder="Enter DC number"/></label><label className="field"><span>Stock Out Date *</span><input type="date" value={sale.transactionDate} onChange={e=>setSale(s=>({...s,transactionDate:e.target.value}))} required/></label><label className="field"><span>Customer Search / Name *</span><input list="sale-customers" name="customerName" value={sale.customerName} onChange={e=>setSale(s=>({...s,customerName:e.target.value}))} placeholder="Search customer name" required/><datalist id="sale-customers">{customerOptions.map(x=><option key={x} value={x}/>)}</datalist></label><Field label="Customer Mobile" name="customerMobile" value={sale.customerMobile} set={setSale}/></div>
 <div className="section-title"><h3>Sale Products</h3><span>Estimated Total: <b>₹{total.toLocaleString("en-IN")}</b></span></div>
 {sale.items.map((item,i)=>{const p=products.find(x=>x._id===item.productId);return <div className="item-row sale-row" key={i}><select value={item.productId} onChange={e=>setItem(i,"productId",e.target.value)} required><option value="">Select product</option>{Object.keys(grouped).sort().map(cat=><optgroup label={cat} key={cat}>{grouped[cat].map(p=><option value={p._id} key={p._id}>{p.productName} — {p.packing||"-"} ({p.currentStock} {p.unit})</option>)}</optgroup>)}</select><span className="stock-pill">Stock: {p?.currentStock ?? 0}</span><input type="number" min="1" max={p?.currentStock||undefined} placeholder="Qty" value={item.quantity} onChange={e=>setItem(i,"quantity",e.target.value)} required/><input className="rate-input" type="number" min="0" placeholder={`Rate (default ₹${p?.sellingPrice||0})`} value={item.rate} onChange={e=>setItem(i,"rate",e.target.value)}/><span className="price">₹{(Number(item.quantity||0)*(item.rate!==""?Number(item.rate||0):Number(p?.sellingPrice||0))).toLocaleString("en-IN")}</span><button type="button" className="remove" onClick={()=>remove(i)}>×</button></div>})}
 <button type="button" className="add-line" onClick={add}>+ Add another product</button><label className="field full"><span>Remarks</span><textarea value={sale.remarks} onChange={e=>setSale(s=>({...s,remarks:e.target.value}))} placeholder="Sale note"></textarea></label><div className="sale-total"><span>Grand Total</span><strong>₹{total.toLocaleString("en-IN")}</strong></div><div className="submit-row"><button className="primary">Complete Sale & Generate Bill</button></div></form></div>;
}
function ReturnPage({ret,setRet,products,setItem,add,remove,onSubmit}) { return <div><div className="page-head"><div><h2>Product Return</h2><p>Return one or multiple products and automatically add them back to stock.</p></div></div><form onSubmit={onSubmit} className="card operation"><div className="customer-grid"><Field label="Customer Name *" name="customerName" value={ret.customerName} set={setRet} required/><Field label="Customer Mobile" name="customerMobile" value={ret.customerMobile} set={setRet}/><Field label="Original Invoice No." name="invoiceNumber" value={ret.invoiceNumber} set={setRet}/></div>{ret.items.map((item,i)=><div className="item-row" key={i}><select value={item.productId} onChange={e=>setItem(i,"productId",e.target.value)} required><option value="">Select returned product</option>{products.map(p=><option value={p._id} key={p._id}>{p.productName} — {p.productCode}</option>)}</select><input type="number" min="1" placeholder="Return Qty" value={item.quantity} onChange={e=>setItem(i,"quantity",e.target.value)} required/><button type="button" className="remove" onClick={()=>remove(i)}>×</button></div>)}<button type="button" className="add-line" onClick={add}>+ Add another returned product</button><label className="field full"><span>Reason / Remarks</span><textarea value={ret.remarks} onChange={e=>setRet(s=>({...s,remarks:e.target.value}))}></textarea></label><div className="submit-row"><button className="primary">Save Product Return</button></div></form></div>; }

function Customers({customers,onDelete}) { return <div><div className="page-head"><div><h2>Customer Details</h2><p>Customer-wise purchase history from all sales.</p></div></div><div className="card"><div className="table-wrap"><table><thead><tr><th>Customer</th><th>Mobile</th><th>Orders</th><th>Total Qty</th><th>Total Purchase</th><th>Last Purchase</th><th>Actions</th></tr></thead><tbody>{customers.map((c,i)=><tr key={i}><td><b>{c.customerName}</b></td><td>{c.customerMobile||"-"}</td><td>{c.orders}</td><td>{c.totalQuantity}</td><td><b>₹{Number(c.totalPurchase).toLocaleString("en-IN")}</b></td><td>{new Date(c.lastPurchase).toLocaleString("en-IN")}</td><td><button className="danger small-btn" onClick={()=>onDelete(c)}>Delete</button></td></tr>)}</tbody></table></div>{!customers.length&&<Empty text="No customer sales recorded yet."/>}</div></div>; }
function History({history}) {
  const [type, setType] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [customer, setCustomer] = useState("");

  const customerOptions = useMemo(() => {
    return [...new Set(history.map(x => (x.customerName || "").trim()).filter(Boolean))]
      .sort((a,b) => a.localeCompare(b));
  }, [history]);

  const filtered = useMemo(() => history.filter(x => {
    const transactionType = x.transactionType || "";
    if (type !== "ALL" && transactionType !== type) return false;

    const dateValue = new Date(x.transactionDate || x.createdAt);
    const date = Number.isNaN(dateValue.getTime()) ? "" : dateValue.toISOString().slice(0,10);
    if (from && (!date || date < from)) return false;
    if (to && (!date || date > to)) return false;

    if (customer && (x.customerName || "") !== customer) return false;
    return true;
  }), [history, type, from, to, customer]);

  const clearFilters = () => {
    setType("ALL");
    setFrom("");
    setTo("");
    setCustomer("");
  };

  const typeCount = (transactionType) =>
    history.filter(x => x.transactionType === transactionType).length;

  return <div>
    <div className="page-head">
      <div>
        <h2>Stock History</h2>
        <p>View Stock In, Stock Out and Return Stock transactions.</p>
      </div>
    </div>

    <div className="card filter-card">
      <div className="filter-title">
        <div>
          <h3>History Filters</h3>
          <p>Filter transactions by date and customer.</p>
        </div>
        <button className="ghost-btn" type="button" onClick={clearFilters}>Clear Filter</button>
      </div>

      <div className="history-type-tabs">
        <button className={type === "ALL" ? "active" : ""} onClick={() => setType("ALL")}>
          All Stock <span>{history.length}</span>
        </button>
        <button className={type === "STOCK_IN" ? "active" : ""} onClick={() => setType("STOCK_IN")}>
          Stock In <span>{typeCount("STOCK_IN")}</span>
        </button>
        <button className={type === "STOCK_OUT" ? "active" : ""} onClick={() => setType("STOCK_OUT")}>
          Stock Out <span>{typeCount("STOCK_OUT")}</span>
        </button>
        <button className={type === "RETURN" ? "active" : ""} onClick={() => setType("RETURN")}>
          Return Stock <span>{typeCount("RETURN")}</span>
        </button>
      </div>

      <div className="filter-grid history-filter-grid">
        <label>From Date<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label>To Date<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
        <label>Customer
          <select value={customer} onChange={e => setCustomer(e.target.value)}>
            <option value="">All Customers</option>
            {customerOptions.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <div className="history-result"><b>{filtered.length}</b><span>Transactions found</span></div>
      </div>
    </div>

    <div className="card">
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>DC No.</th><th>Packing</th><th>Packing Type</th><th>Unit</th><th>Type</th><th>Product</th><th>Staff</th><th>Qty</th><th>Customer</th><th>Rate</th><th>Amount</th></tr></thead>
          <tbody>
            {filtered.map(x => <tr key={x._id}>
              <td>{new Date(x.transactionDate || x.createdAt).toLocaleDateString("en-IN")}</td>
              <td>{x.dcNumber || "-"}</td>
              <td>{x.packing || "-"}</td>
              <td>{x.packingType || "-"}</td>
              <td>{x.unit || "PCS"}</td>
              <td><span className={`type ${(x.transactionType || "").toLowerCase()}`}>{x.transactionType === "RETURN" ? "RETURN STOCK" : x.transactionType}</span></td>
              <td><b>{x.productName}</b><small className="block">{x.productCode}</small></td>
              <td>{x.staffMember || "-"}</td>
              <td>{x.quantity}</td>
              <td>{x.customerName || "Godown"}<small className="block">{x.customerMobile}</small></td>
              <td>₹{Number(x.unitPrice || 0).toLocaleString("en-IN")}</td>
              <td>₹{Number(x.totalAmount || 0).toLocaleString("en-IN")}</td>
            </tr>)}
            {!filtered.length && <tr><td colSpan="12"><Empty text="No stock history found for the selected filters." /></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  </div>;
}
function LowStock({notifications}) { return <div><div className="page-head"><div><h2>Low Stock</h2><p>Automatic alerts based on each product's minimum stock.</p></div></div><div className="alert-grid">{notifications.map(x=><div className="low-card" key={x.productId}><div className="low-icon">!</div><div><h3>{x.productName}</h3><p>{x.productCode} · {x.unit}</p><strong>{x.currentStock}</strong><span>Current / Minimum {x.minimumStock}</span></div></div>)}{!notifications.length&&<div className="card"><Empty text="No low-stock products."/></div>}</div></div>; }
function Notifications({notifications}) { return <div><div className="page-head"><div><h2>Notifications</h2><p>Inventory notifications requiring attention.</p></div></div><div className="card notification-list">{notifications.map(x=><div className="notification-row" key={x.productId}><div className="nicon">!</div><div><b>Low stock: {x.productName}</b><p>{x.currentStock} {x.unit} available, minimum is {x.minimumStock}.</p></div><span>Action needed</span></div>)}{!notifications.length&&<Empty text="No new notifications."/>}</div></div>; }

function Analytics({history,products}) {
  const sales=history.filter(x=>x.transactionType==="STOCK_OUT");
  const totalSales=sales.reduce((a,x)=>a+Number(x.totalAmount||0),0);
  const totalQty=sales.reduce((a,x)=>a+Number(x.quantity||0),0);
  const customers=new Set(sales.map(x=>x.customerName).filter(Boolean)).size;
  const by={}; sales.forEach(x=>{const k=x.productName||"Unknown"; if(!by[k]) by[k]={qty:0,amount:0}; by[k].qty+=Number(x.quantity||0); by[k].amount+=Number(x.totalAmount||0);});
  const top=Object.entries(by).sort((a,b)=>b[1].qty-a[1].qty).slice(0,10);
  const max=Math.max(...top.map(x=>x[1].qty),1);
  const category={}; products.forEach(p=>{const c=p.category||"Other"; category[c]=(category[c]||0)+Number(p.currentStock||0);});
  return <div><div className="page-head"><div><h2>Admin Analytics</h2><p>Business overview of stock, sales and product demand.</p></div></div>
    <section className="stats"><Stat icon="₹" label="Total Sales" value={`₹${totalSales.toLocaleString("en-IN")}`} note="All recorded sales"/><Stat icon="↓" label="Quantity Sold" value={totalQty} note="All sales entries"/><Stat icon="♙" label="Customers" value={customers} note="Unique customers"/><Stat icon="▣" label="Products" value={products.length} note="Product master"/></section>
    <div className="dash-grid"><div className="card"><div className="card-title"><div><h3>Top Products by Quantity</h3><p>Highest-demand products</p></div></div>{top.length?<div className="bars">{top.map(([name,v])=><div className="bar-row" key={name}><span title={name}>{name}</span><div><b style={{width:`${Math.max(4,(v.qty/max)*100)}%`}}></b></div><strong>{v.qty}</strong></div>)}</div>:<Empty text="No sales data yet."/>}</div>
    <div className="card"><div className="card-title"><div><h3>Category Stock</h3><p>Current stock grouped by category</p></div></div><div className="simple-list">{Object.entries(category).sort((a,b)=>b[1]-a[1]).map(([name,qty])=><div key={name}><span>{name}</span><b>{qty.toLocaleString("en-IN")} units</b></div>)}</div>{!Object.keys(category).length&&<Empty text="No products available."/>}</div></div>
  </div>;
}

function Reports({summary,history,products,customers}) {
 const [filters,setFilters]=useState({from:"",to:"",staff:"",customer:""});
 const sales=history.filter(x=>{if(x.transactionType!=="STOCK_OUT")return false;const d=new Date(x.createdAt).toISOString().slice(0,10);if(filters.from&&d<filters.from)return false;if(filters.to&&d>filters.to)return false;if(filters.staff&&x.staffMember!==filters.staff)return false;if(filters.customer&&!(x.customerName||"").toLowerCase().includes(filters.customer.toLowerCase()))return false;return true;});
 const by={};sales.forEach(x=>{const k=String(x.product);if(!by[k])by[k]={productName:x.productName,packing:x.packing||"",quantity:0,sales:0};by[k].quantity+=Number(x.quantity||0);by[k].sales+=Number(x.totalAmount||0);});
 const top=Object.values(by).sort((a,b)=>b.quantity-a.quantity);
 const staff=[...new Set(history.filter(x=>x.staffMember).map(x=>x.staffMember))];
 const cust=[...new Set(history.filter(x=>x.transactionType==="STOCK_OUT"&&x.customerName).map(x=>x.customerName))];
 return <div><div className="page-head"><div><h2>Sales & Staff Reports</h2><p>Filter by date, staff member and customer to see quantity given.</p></div></div>
 <div className="card filter-card"><div className="filter-title"><b>Report Filters</b><button className="link" onClick={()=>setFilters({from:"",to:"",staff:"",customer:""})}>Clear</button></div><div className="filter-grid"><label className="field"><span>From Date</span><input type="date" value={filters.from} onChange={e=>setFilters({...filters,from:e.target.value})}/></label><label className="field"><span>To Date</span><input type="date" value={filters.to} onChange={e=>setFilters({...filters,to:e.target.value})}/></label><label className="field"><span>Staff Member</span><select value={filters.staff} onChange={e=>setFilters({...filters,staff:e.target.value})}><option value="">All Staff</option>{staff.map(x=><option key={x}>{x}</option>)}</select></label><label className="field"><span>Customer</span><input list="report-customers" placeholder="Search customer" value={filters.customer} onChange={e=>setFilters({...filters,customer:e.target.value})}/><datalist id="report-customers">{cust.map(x=><option key={x} value={x}/>)}</datalist></label></div></div>
 <div className="stats"><Stat icon="↓" label="Products Given" value={sales.reduce((a,x)=>a+Number(x.quantity||0),0)} note="Filtered quantity"/><Stat icon="₹" label="Sales Value" value={`₹${sales.reduce((a,x)=>a+Number(x.totalAmount||0),0).toLocaleString("en-IN")}`} note="Filtered sales"/><Stat icon="♙" label="Customers" value={new Set(sales.map(x=>x.customerName)).size} note="Filtered customers"/><Stat icon="G" label="Staff" value={new Set(sales.map(x=>x.staffMember).filter(Boolean)).size} note="Staff members"/></div>
 <div className="card staff-summary-card"><h3>Staff Member → Customer Summary</h3><div className="simple-list">{Object.values(sales.reduce((acc,x)=>{const k=`${x.staffMember||"Unknown Staff"}|${x.customerName}`;if(!acc[k])acc[k]={staff:x.staffMember||"Unknown Staff",customer:x.customerName,qty:0,amount:0};acc[k].qty+=Number(x.quantity||0);acc[k].amount+=Number(x.totalAmount||0);return acc;},{})).sort((a,b)=>b.amount-a.amount).map((x,i)=><div key={i}><span><b>{x.staff}</b> → {x.customer}</span><b>{x.qty} qty · ₹{x.amount.toLocaleString("en-IN")}</b></div>)}{!sales.length&&<Empty text="No staff/customer sales recorded yet."/>}</div></div>
 <div className="card"><h3>Highest Product List</h3><div className="simple-list">{top.slice(0,15).map((x,i)=><div key={i}><span>#{i+1} {x.productName} {x.packing&&`(${x.packing})`}</span><b>{x.quantity} qty · ₹{x.sales.toLocaleString("en-IN")}</b></div>)}</div>{!top.length&&<Empty text="No matching sales."/>}</div>
 <div className="card"><h3>Staff Member → Customer → Product</h3><div className="table-wrap"><table><thead><tr><th>Date</th><th>Staff</th><th>Customer</th><th>Product</th><th>Packing</th><th>Type</th><th>Unit</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>{sales.map(x=><tr key={x._id}><td>{new Date(x.createdAt).toLocaleDateString("en-IN")}</td><td><b>{x.staffMember||"-"}</b></td><td>{x.customerName}</td><td>{x.productName}</td><td>{x.packing||"-"}</td><td>{x.packingType||"-"}</td><td>{x.unit||"PCS"}</td><td>{x.quantity}</td><td>₹{Number(x.unitPrice||0).toLocaleString("en-IN")}</td><td>₹{Number(x.totalAmount||0).toLocaleString("en-IN")}</td></tr>)}</tbody></table></div></div></div>;
}
function Bill({bill,close}) { const print=()=>window.print(); return <div className="modal-bg"><div className="bill"><div className="bill-actions"><button className="secondary" onClick={close}>Close</button><button className="primary" onClick={print}>Print Bill</button></div><div className="print-area"><div className="bill-head"><div><h1>GODOWN STOCK MANAGEMENT</h1><p>Sales Invoice</p></div><div><b>{bill.invoiceNumber}</b><small>{new Date().toLocaleString("en-IN")}</small></div></div><div className="customer-box"><b>Customer</b><span>{bill.customerName}</span><span>{bill.customerMobile||"-"}</span></div><table><thead><tr><th>Product</th><th>Code</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>{bill.items.map((x,i)=><tr key={i}><td>{x.productName}</td><td>{x.productCode}</td><td>{x.quantity} {x.unit}</td><td>₹{Number(x.unitPrice).toLocaleString("en-IN")}</td><td>₹{Number(x.totalAmount).toLocaleString("en-IN")}</td></tr>)}</tbody></table><div className="bill-total"><span>Grand Total</span><strong>₹{Number(bill.grandTotal).toLocaleString("en-IN")}</strong></div><p className="thanks">Thank you for your business.</p></div></div></div>; }

function LoginPage({onLogin}) {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [show,setShow]=useState(false);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const submit=async(e)=>{
    e.preventDefault(); setError(""); setBusy(true);
    try { await onLogin(email,password); }
    catch(e) { setError(e.message || "Invalid email or password"); }
    finally { setBusy(false); }
  };
  return <div className="login-page"><div className="login-card"><div className="login-logo">GZ</div><h1>Godown Stock Management</h1><p>Secure User Login</p><form onSubmit={submit}><label className="login-field"><span>Email</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@godown.com" required/></label><label className="login-field"><span>Password</span><div className="password-wrap"><input type={show?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter password" required/><button type="button" onClick={()=>setShow(!show)}>{show?"Hide":"Show"}</button></div></label>{error&&<div className="login-error">{error}</div>}<button className="login-btn" disabled={busy}>{busy?"Signing in...":"Login"}</button></form><div className="demo-login"><b>Default Admin</b><span>admin@godown.com</span><span>admin123</span></div></div></div>;
}

function Users({users,onAdd,onUpdate,onDelete}) {
  const empty={name:"",email:"",password:"",role:"OUTLET_USER",outlet:"",active:true};
  const [form,setForm]=useState(empty);
  const [editing,setEditing]=useState(null);
  const [showForm,setShowForm]=useState(false);
  const reset=()=>{setForm(empty);setEditing(null);setShowForm(false);};
  const submit=async(e)=>{
    e.preventDefault();
    try {
      if(editing) await onUpdate(editing, form);
      else await onAdd(form);
      alert(editing?"User updated successfully":"User added successfully");
      reset();
    } catch(e) { alert(e.message); }
  };
  const edit=(u)=>{setEditing(u._id);setForm({name:u.name,email:u.email,password:"",role:u.role,outlet:u.outlet||"",active:u.active});setShowForm(true);};
  const roleLabel=(r)=>r==="ADMIN"?"Admin":r==="WAREHOUSE_USER"?"Warehouse User":"Outlet User";
  return <div>
    <div className="page-head"><div><h2>User Management</h2><p>GZ-style admin user creation and access management.</p></div><button className="primary" onClick={()=>{setForm(empty);setEditing(null);setShowForm(true)}}>+ Add User</button></div>
    {showForm&&<div className="card user-form-card"><div className="section-title"><h3>{editing?"Edit User":"Add New User"}</h3><button className="secondary" onClick={reset}>Cancel</button></div>
      <form className="form-grid" onSubmit={submit}>
        <label className="field"><span>Full Name *</span><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></label>
        <label className="field"><span>Email *</span><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/></label>
        <label className="field"><span>{editing?"New Password (optional)":"Password *"}</span><input type="password" minLength="6" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required={!editing}/></label>
        <label className="field"><span>Role *</span><select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="OUTLET_USER">Outlet User</option><option value="WAREHOUSE_USER">Warehouse User</option><option value="ADMIN">Admin</option></select></label>
        <label className="field"><span>Outlet / Location</span><input value={form.outlet} onChange={e=>setForm({...form,outlet:e.target.value})} placeholder="e.g. Nashik Main Outlet"/></label>
        {editing&&<label className="field"><span>Status</span><select value={String(form.active)} onChange={e=>setForm({...form,active:e.target.value==="true"})}><option value="true">Active</option><option value="false">Inactive</option></select></label>}
        <div className="modal-actions"><button type="button" className="secondary" onClick={reset}>Cancel</button><button className="primary">{editing?"Update User":"Create User"}</button></div>
      </form>
    </div>}
    <div className="card"><div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Outlet / Location</th><th>Status</th><th>Action</th></tr></thead><tbody>
      {users.map(u=><tr key={u._id}><td><b>{u.name}</b></td><td>{u.email}</td><td><span className="role-pill">{roleLabel(u.role)}</span></td><td>{u.outlet||"-"}</td><td><span className={`status ${u.active?"ok":"low"}`}>{u.active?"Active":"Inactive"}</span></td><td><button className="link" onClick={()=>edit(u)}>Edit</button>{u.email!=="admin@godown.com"&&<button className="danger-link" onClick={async()=>{if(window.confirm("Delete this user?")){try{await onDelete(u._id);alert("User deleted successfully")}catch(e){alert(e.message)}}}}>Delete</button>}</td></tr>)}
      {!users.length&&<tr><td colSpan="6"><Empty text="No users found."/></td></tr>}
    </tbody></table></div></div>
  </div>;
}

export default App;
