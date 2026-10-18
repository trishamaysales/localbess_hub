(() => {
  const KEYS = {
    users: "users",
    loggedInUser: "loggedInUser",
    products: "products",
    shops: "shops",
    cart: "cart",
    orders: "orders",
    favorites: "favorites",
    ratings: "ratings"
  };

  const CATEGORIES = [
    "Handmade Crafts",
    "Bags",
    "Accessories",
    "Food",
    "Snacks",
    "Native Products",
    
  ];

  const DELIVERY_FEE = 50;
  const STATUSES = ["Processing", "Preparing", "Ready for Delivery", "Completed"];

  const state = {
    view: "home",
    shopId: null,
    search: "",
    category: "",
    registerRole: "buyer",
    checkout: null,
    profileEditing: false,
    checkoutEditing: false,
    addressForm: null,
    payMethod: "COD"
  };

  const $ = (id) => document.getElementById(id);

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function toast(message) {
    const root = $("toastRoot");
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    root.appendChild(el);
    setTimeout(() => el.remove(), 2800);
  }

  function peso(n) {
    return "₱" + Number(n).toLocaleString("en-PH", { minimumFractionDigits: 0 });
  }

  function uid(prefix) {
    return prefix + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function starText(score) {
    const n = Math.max(0, Math.min(5, Math.round(Number(score) || 0)));
    return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n) + " " + Number(score || 0).toFixed(1);
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function currentUser() {
    return load(KEYS.loggedInUser, null);
  }

  function users() { return load(KEYS.users, []); }
  function products() { return load(KEYS.products, []); }
  function shops() { return load(KEYS.shops, []); }
  function cart() { return load(KEYS.cart, []); }
  function orders() { return load(KEYS.orders, []); }
  function favorites() { return load(KEYS.favorites, []); }
  function ratings() { return load(KEYS.ratings, []); }

  function setUsers(v) { save(KEYS.users, v); }
  function setProducts(v) { save(KEYS.products, v); }
  function setShops(v) { save(KEYS.shops, v); }
  function setCart(v) { save(KEYS.cart, v); }
  function setOrders(v) { save(KEYS.orders, v); }
  function setFavorites(v) { save(KEYS.favorites, v); }
  function setRatings(v) { save(KEYS.ratings, v); }

  function persistUser(user) {
    const all = users().map((u) => (u.id === user.id ? user : u));
    setUsers(all);
    const logged = currentUser();
    if (logged && logged.id === user.id) save(KEYS.loggedInUser, user);
  }

  function emptyAddressParts() {
    return { street: "", barangay: "", municipality: "", province: "" };
  }

  function splitGluedAddress(str) {
    return String(str || "")
      .replace(/Mindoro\s*barangay/gi, "Mindoro, Barangay ")
      .replace(/([a-z])barangay/gi, "$1, Barangay ")
      .replace(/barangay(?=\S)/gi, "Barangay ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseAddress(raw) {
    if (!raw) return emptyAddressParts();
    if (typeof raw === "object" && !Array.isArray(raw)) {
      if (raw.street || raw.barangay || raw.municipality || raw.province) {
        return {
          street: String(raw.street || "").trim(),
          barangay: String(raw.barangay || "").trim(),
          municipality: String(raw.municipality || "").trim(),
          province: String(raw.province || "").trim()
        };
      }
      if (raw.address) return parseAddress(raw.address);
      return emptyAddressParts();
    }
    const s = splitGluedAddress(raw);
    const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
    const result = emptyAddressParts();
    const barangayPart = parts.find((p) => /^(brgy\.?|barangay)\b/i.test(p));
    const provincePart = parts.find((p) => /occidental mindoro|\bmindoro\b/i.test(p) && !/mamburao/i.test(p));
    const muniPart = parts.find((p) => /\bmamburao\b/i.test(p));
    if (barangayPart) result.barangay = barangayPart.replace(/^(brgy\.?|barangay)\s+/i, "").trim();
    if (muniPart) result.municipality = muniPart.replace(/^(municipality of)\s+/i, "").trim();
    if (provincePart) result.province = provincePart;
    const used = new Set([barangayPart, muniPart, provincePart].filter(Boolean));
    const leftover = parts.filter((p) => !used.has(p));
    result.street = leftover.join(", ");
    if (!result.municipality) {
      const maybeMuni = leftover.find((p) => /mamburao/i.test(p));
      if (maybeMuni) result.municipality = maybeMuni;
    }
    if (!result.province && leftover.length) {
      const last = leftover[leftover.length - 1];
      if (/mindoro|province/i.test(last)) result.province = last;
    }
    return result;
  }

  function makeSavedAddress(data, user, index) {
    const parts = parseAddress(data);
    return {
      id: (data && data.id) || ("addr-" + (index + 1) + "-" + (user?.id || "u")),
      label: (data && data.label) || (index === 0 ? "Default Address" : "Address " + (index + 1)),
      fullName: (data && data.fullName) || user?.fullName || "",
      contact: (data && data.contact) || user?.contact || "",
      street: parts.street,
      barangay: parts.barangay,
      municipality: parts.municipality,
      province: parts.province,
      isDefault: !!(data && data.isDefault) || index === 0
    };
  }

  function formatAddressLines(addr) {
    const a = parseAddress(addr);
    const line1 = [a.street, a.municipality].filter(Boolean).join(", ");
    const brgy = a.barangay
      ? (/^(brgy\.?|barangay)\b/i.test(a.barangay) ? a.barangay : "Barangay " + a.barangay)
      : "";
    const line3 = a.province;
    return [line1, brgy, line3].filter(Boolean);
  }

  function formatAddressText(addr) {
    return formatAddressLines(addr).join("\n");
  }

  function formatAddressHtml(addr) {
    return formatAddressLines(addr).map((line) => `<span>${escapeHtml(line)}</span>`).join("");
  }

  function addressFormFields(prefix, addr, name, contact) {
    const a = parseAddress(addr || {});
    return `
      <div class="form-group"><label>Full Name</label><input id="${prefix}Name" required value="${escapeHtml(name || "")}"></div>
      <div class="form-group"><label>Contact Number</label><input id="${prefix}Contact" required value="${escapeHtml(contact || "")}"></div>
      <div class="form-group"><label>Street / Area</label><input id="${prefix}Street" required value="${escapeHtml(a.street)}"></div>
      <div class="form-group"><label>Barangay</label><input id="${prefix}Barangay" required value="${escapeHtml(a.barangay)}"></div>
      <div class="form-group"><label>Municipality</label><input id="${prefix}Municipality" required value="${escapeHtml(a.municipality)}"></div>
      <div class="form-group"><label>Province</label><input id="${prefix}Province" required value="${escapeHtml(a.province || "Occidental Mindoro")}"></div>
    `;
  }

  function readAddressFields(prefix) {
    return {
      fullName: ($(`${prefix}Name`)?.value || "").trim(),
      contact: ($(`${prefix}Contact`)?.value || "").trim(),
      street: ($(`${prefix}Street`)?.value || "").trim(),
      barangay: ($(`${prefix}Barangay`)?.value || "").trim(),
      municipality: ($(`${prefix}Municipality`)?.value || "").trim(),
      province: ($(`${prefix}Province`)?.value || "").trim()
    };
  }

  function applyDelivery(addr) {
    if (!state.checkout || !addr) return;
    state.checkout.addressId = addr.id;
    state.checkout.deliveryName = addr.fullName || "";
    state.checkout.deliveryContact = addr.contact || "";
    state.checkout.deliveryAddress = formatAddressText(addr);
    state.checkout.deliveryParts = parseAddress(addr);
  }

  function pageBack(fallbackHash) {
    return `<p class="page-back"><button type="button" class="back-link" data-back="${escapeHtml(fallbackHash || "#home")}">← Back</button></p>`;
  }

  function avgRating(type, id, fallback) {
    const list = ratings().filter((r) => r.type === type && r.targetId === id);
    if (!list.length) return Number(fallback || 0);
    return list.reduce((s, r) => s + r.stars, 0) / list.length;
  }

  function productRating(p) {
    return avgRating("product", p.id, p.baseRating);
  }

  function shopRating(s) {
    const fromShop = ratings().filter((r) => r.type === "shop" && r.targetId === s.id);
    const fromProducts = products()
      .filter((p) => p.shopId === s.id)
      .map((p) => productRating(p));
    const all = fromShop.map((r) => r.stars).concat(fromProducts);
    if (!all.length) return Number(s.baseRating || 0);
    return all.reduce((a, b) => a + b, 0) / all.length;
  }

  function isOwnProduct(user, product) {
    return !!(user && product && user.id === product.sellerId);
  }

  function shopById(id) {
    return shops().find((s) => s.id === id);
  }

  function productById(id) {
    return products().find((p) => p.id === id);
  }

  function userById(id) {
    return users().find((u) => u.id === id);
  }

  function shopProductCount(shopId) {
    return products().filter((p) => p.shopId === shopId).length;
  }

  function migrateSampleProductImages() {
    if (localStorage.getItem("lbh_product_images_v4") === "1") return;
    const allProducts = products();
    const imageUpdates = {
      p5: "https://plus.unsplash.com/premium_photo-1674562179916-dd3f312ac7ff?auto=format&fit=crop&w=800&q=80",
      p8: "https://images.unsplash.com/photo-1619028005538-db42565dd583?auto=format&fit=crop&w=800&q=80",
      p9: "https://tse4.mm.bing.net/th/id/OIP.ZFUUAWA3T2PyeMtEgh5TnAHaHa?r=0&rs=1&pid=ImgDetMain&o=7&rm=3"
    };
    const updatedProducts = allProducts.map((product) => (
      imageUpdates[product.id] ? { ...product, image: imageUpdates[product.id] } : product
    ));
    const nanay = userById("u-nanay");
    const nanayShop = shopById("shop-nanay");
    if (!updatedProducts.some((product) => product.id === "p9") && nanay && nanayShop) {
      updatedProducts.push({
        id: "p9",
        sellerId: nanay.id,
        shopId: nanayShop.id,
        name: "Cassava Cake",
        price: 120,
        stock: 30,
        category: "Snacks",
        description: "Soft, rich cassava cake freshly prepared by Nanay Lita.",
        image: imageUpdates.p9,
        baseRating: 4.8
      });
    }
    setProducts(updatedProducts);
    localStorage.setItem("lbh_product_images_v4", "1");
  }

  function seedIfNeeded() {
    const existingProducts = products();
    const structureOk = existingProducts.length && existingProducts[0].sellerId && shops().length;
    if ((localStorage.getItem("lbh_complete_v1") === "1" || localStorage.getItem("lbh_complete_v2") === "1" || localStorage.getItem("lbh_complete_v3") === "1") && structureOk) {
      migrateAccountTypes();
      migrateAddresses();
      ensureDemoUsers();
      migrateSampleProductImages();
      return;
    }

    const buyerAddr = { street: "Poblacion", barangay: "Talabaan", municipality: "Mamburao", province: "Occidental Mindoro" };
    const sellerAddr = { street: "", barangay: "Tayamaan", municipality: "Mamburao", province: "Occidental Mindoro" };
    const anaAddr = { street: "", barangay: "Fatima", municipality: "Mamburao", province: "Occidental Mindoro" };
    const nanayAddr = { street: "", barangay: "4", municipality: "Mamburao", province: "Occidental Mindoro" };

    const buyer = {
      id: "u-buyer",
      role: "buyer",
      fullName: "Rhea Mae Santos",
      username: "buyer",
      email: "rhea@example.com",
      password: "buyer123",
      contact: "09171234567",
      address: buyerAddr,
      savedAddresses: [makeSavedAddress({ ...buyerAddr, label: "Default Address", fullName: "Rhea Mae Santos", contact: "09171234567", isDefault: true }, { id: "u-buyer", fullName: "Rhea Mae Santos", contact: "09171234567" }, 0)],
      avatar: ""
    };

    const seller = {
      id: "u-seller",
      role: "seller",
      sellerType: "Local Seller",
      fullName: "Juan Dela Cruz",
      username: "seller",
      email: "juan@localbess.demo",
      password: "seller123",
      contact: "09181234567",
      address: sellerAddr,
      businessName: "Mamburao Handmade Crafts",
      businessDesc: "Handwoven bags, native crafts, and artisan accessories made in Mamburao.",
      businessLocation: "Mamburao, Occidental Mindoro",
      shopId: "shop-crafts",
      savedAddresses: [makeSavedAddress({ ...sellerAddr, label: "Default Address", fullName: "Juan Dela Cruz", contact: "09181234567", isDefault: true }, { id: "u-seller", fullName: "Juan Dela Cruz", contact: "09181234567" }, 0)],
      avatar: ""
    };

    const sellerTwo = {
      id: "u-ana",
      role: "seller",
      sellerType: "Local Seller",
      fullName: "Ana Villanueva",
      username: "ana",
      email: "ana@localbess.demo",
      password: "ana123",
      contact: "09191234567",
      address: anaAddr,
      businessName: "Mindoro Local Finds",
      businessDesc: "Homemade food, snacks, and native goods from Mamburao makers.",
      businessLocation: "Mamburao, Occidental Mindoro",
      shopId: "shop-finds",
      savedAddresses: [makeSavedAddress({ ...anaAddr, label: "Default Address", fullName: "Ana Villanueva", contact: "09191234567", isDefault: true }, { id: "u-ana", fullName: "Ana Villanueva", contact: "09191234567" }, 0)],
      avatar: ""
    };

    const nanay = {
      id: "u-nanay",
      role: "seller",
      sellerType: "Local Seller",
      fullName: "Lita Ramos",
      username: "nanay",
      email: "nanaylita@localbess.demo",
      password: "nanay123",
      contact: "09201234567",
      address: nanayAddr,
      businessName: "Nanay Lita's Homemade Snacks",
      businessDesc: "Crispy homemade chips and merienda favorites from a Mamburao kitchen.",
      businessLocation: "Mamburao, Occidental Mindoro",
      shopId: "shop-nanay",
      savedAddresses: [makeSavedAddress({ ...nanayAddr, label: "Default Address", fullName: "Lita Ramos", contact: "09201234567", isDefault: true }, { id: "u-nanay", fullName: "Lita Ramos", contact: "09201234567" }, 0)],
      avatar: ""
    };

    const seedShops = [
      {
        id: "shop-crafts",
        ownerId: seller.id,
        name: "Mamburao Handmade Crafts",
        sellerType: "Local Seller",
        description: seller.businessDesc,
        location: "Mamburao, Occidental Mindoro",
        contact: seller.contact,
        baseRating: 4.8,
        image: "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=800&q=80"
      },
      {
        id: "shop-finds",
        ownerId: sellerTwo.id,
        name: "Mindoro Local Finds",
        sellerType: "Local Seller",
        description: sellerTwo.businessDesc,
        location: "Mamburao, Occidental Mindoro",
        contact: sellerTwo.contact,
        baseRating: 4.6,
        image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80"
      },
      {
        id: "shop-nanay",
        ownerId: nanay.id,
        name: "Nanay Lita's Homemade Snacks",
        sellerType: "Local Seller",
        description: nanay.businessDesc,
        location: "Mamburao, Occidental Mindoro",
        contact: nanay.contact,
        baseRating: 4.9,
        image: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=800&q=80"
      }
    ];

    const seedProducts = [
      { id: "p1", sellerId: seller.id, shopId: "shop-crafts", name: "Handmade Rattan Bag", price: 450, stock: 18, category: "Bags", description: "Sturdy handwoven rattan bag made by Mamburao artisans. Perfect for market days and everyday errands.", image: "https://images.unsplash.com/photo-1590874103328-eac38a94178a?auto=format&fit=crop&w=800&q=80", baseRating: 4.8 },
      { id: "p2", sellerId: seller.id, shopId: "shop-crafts", name: "Handmade Beaded Bracelet", price: 120, stock: 40, category: "Accessories", description: "Colorful beaded bracelet with island-inspired patterns. Lightweight and handmade.", image: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=800&q=80", baseRating: 4.7 },
      { id: "p3", sellerId: seller.id, shopId: "shop-crafts", name: "Native Basket", price: 300, stock: 12, category: "Native Products", description: "Traditional native basket woven from local materials. Useful for storage or gifting.", image: "https://images.unsplash.com/photo-1603201667141-5a2d4c673378?auto=format&fit=crop&w=800&q=80", baseRating: 4.6 },
      { id: "p4", sellerId: seller.id, shopId: "shop-crafts", name: "Handmade Keychain", price: 100, stock: 50, category: "Accessories", description: "Cute handmade keychain featuring local craft details. A small souvenir from Mamburao.", image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80", baseRating: 4.5 },
      { id: "p5", sellerId: sellerTwo.id, shopId: "shop-finds", name: "Mango Jam", price: 150, stock: 25, category: "Food", description: "Sweet homemade mango jam bottled by local makers in Mamburao.", image: "https://plus.unsplash.com/premium_photo-1674562179916-dd3f312ac7ff?auto=format&fit=crop&w=800&q=80", baseRating: 4.8 },
      { id: "p6", sellerId: sellerTwo.id, shopId: "shop-finds", name: "Local Handwoven Pouch", price: 250, stock: 16, category: "Handmade Crafts", description: "Compact handwoven pouch for coins, gadgets, or small essentials.", image: "https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=800&q=80", baseRating: 4.4 },
      { id: "p7", sellerId: nanay.id, shopId: "shop-nanay", name: "Local Cassava Chips", price: 80, stock: 60, category: "Snacks", description: "Crispy garlic cassava chips fried in small batches by Nanay Lita.", image: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=800&q=80", baseRating: 4.9 },
      { id: "p8", sellerId: nanay.id, shopId: "shop-nanay", name: "Banana Chips", price: 70, stock: 55, category: "Snacks", description: "Thin, lightly sweet banana chips — a classic Mamburao merienda.", image: "https://images.unsplash.com/photo-1619028005538-db42565dd583?auto=format&fit=crop&w=800&q=80", baseRating: 4.7 },
      { id: "p9", sellerId: nanay.id, shopId: "shop-nanay", name: "Cassava Cake", price: 120, stock: 30, category: "Snacks", description: "Soft, rich cassava cake freshly prepared by Nanay Lita.", image: "https://tse4.mm.bing.net/th/id/OIP.ZFUUAWA3T2PyeMtEgh5TnAHaHa?r=0&rs=1&pid=ImgDetMain&o=7&rm=3", baseRating: 4.8 }
    ];

    setUsers([buyer, seller, sellerTwo, nanay]);
    setShops(seedShops);
    setProducts(seedProducts);
    if (!localStorage.getItem(KEYS.cart)) setCart([]);
    if (!localStorage.getItem(KEYS.orders)) setOrders([]);
    if (!localStorage.getItem(KEYS.favorites)) setFavorites([]);
    if (!localStorage.getItem(KEYS.ratings)) setRatings([]);
    localStorage.setItem("lbh_complete_v1", "1");
    localStorage.setItem("lbh_complete_v2", "1");
    localStorage.setItem("lbh_complete_v3", "1");
    localStorage.setItem("lbh_product_images_v4", "1");
  }

  function userAddresses(user) {
    if (!user) return [];
    const raw = Array.isArray(user.savedAddresses) ? user.savedAddresses.slice() : [];
    if (user.address && typeof user.address === "string" && !raw.length) raw.unshift(user.address);
    if (user.address && typeof user.address === "object" && !raw.length) raw.unshift(user.address);
    const list = raw.map((entry, i) => makeSavedAddress(entry, user, i)).filter(Boolean);
    if (!list.length && user.address) list.push(makeSavedAddress(user.address, user, 0));
    return list;
  }

  function migrateAccountTypes() {
    let changed = false;
    const nextUsers = users().map((u) => {
      const n = { ...u, role: u.role === "reseller" ? "seller" : u.role };
      if (n.sellerType === "Local Reseller") n.sellerType = "Local Seller";
      if (n.username === "reseller") {
        n.username = "ana";
        n.password = "ana123";
        n.role = "seller";
        n.sellerType = "Local Seller";
        n.id = n.id || "u-ana";
      }
      if (JSON.stringify(n) !== JSON.stringify(u)) changed = true;
      return n;
    }).filter((u) => u.username !== "reseller");
    if (changed || nextUsers.length !== users().length) setUsers(nextUsers);
    const nextShops = shops().map((s) => s.sellerType === "Local Reseller" ? { ...s, sellerType: "Local Seller" } : s);
    if (JSON.stringify(nextShops) !== JSON.stringify(shops())) setShops(nextShops);
    const logged = currentUser();
    if (logged) {
      if (logged.role === "reseller" || logged.username === "reseller") {
        const fresh = users().find((u) => u.username === "ana");
        if (fresh) save(KEYS.loggedInUser, fresh);
        else localStorage.removeItem(KEYS.loggedInUser);
      } else {
        const fresh = users().find((u) => u.id === logged.id);
        if (fresh) save(KEYS.loggedInUser, fresh);
      }
    }
    localStorage.setItem("lbh_complete_v2", "1");
  }

  function migrateAddresses() {
    const next = users().map((u) => {
      const list = userAddresses(u);
      const primary = list[0] || makeSavedAddress(u.address, u, 0);
      return {
        ...u,
        address: parseAddress(primary),
        savedAddresses: list.length ? list : (primary.street || primary.barangay ? [primary] : [])
      };
    });
    setUsers(next);
    const logged = currentUser();
    if (logged) {
      const fresh = next.find((u) => u.id === logged.id);
      if (fresh) save(KEYS.loggedInUser, fresh);
    }
    localStorage.setItem("lbh_complete_v3", "1");
  }

  function ensureDemoUsers() {
    let all = users().filter((u) => u.username !== "reseller" && u.role !== "reseller");
    if (JSON.stringify(all) !== JSON.stringify(users())) setUsers(all);
  }

  function requireLogin(action) {
    const user = currentUser();
    if (!user) {
      toast("Please login or register to " + action + ".");
      location.hash = "#login";
      return false;
    }
    return true;
  }

  function closeOverlay() {
    $("overlayRoot").innerHTML = "";
  }

  function openOverlay(html) {
    $("overlayRoot").innerHTML = `<div class="overlay">${html}</div>`;
    $("overlayRoot").querySelector(".overlay").addEventListener("click", (e) => {
      if (e.target.classList.contains("overlay")) closeOverlay();
    });
  }

  function initials(name) {
    return String(name || "U").split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  }

  function imgTag(src, alt, extra) {
    const fallback = "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80";
    return `<img src="${escapeHtml(src || fallback)}" alt="${escapeHtml(alt)}" ${extra || ""} onerror="this.onerror=null;this.src='${fallback}'">`;
  }

  function navHtml() {
    const user = currentUser();
    const links = [];
    const add = (hash, label) => {
      const active = location.hash.replace("#", "").split("/")[0] === hash || (!location.hash && hash === "home") ? "active" : "";
      links.push(`<a class="${active}" href="#${hash}">${label}</a>`);
    };
    add("home", "Home");
    add("products", "Products");
    add("shops", "Shops");
    add("categories", "Categories");
    if (!user) {
      add("login", "Login");
      add("register", "Register");
    } else if (user.role === "buyer") {
      add("cart", "Cart");
      add("orders", "My Orders");
      add("favorites", "My Favorites");
      add("account", "Account");
      links.push(`<button class="nav-link" type="button" data-logout>Logout</button>`);
    } else {
      add("cart", "Cart");
      add("orders", "My Orders");
      add("dashboard", "Dashboard");
      add("myshop", "My Shop");
      add("myproducts", "My Products");
      add("sellerorders", "Orders");
      add("account", "Account");
      links.push(`<button class="nav-link" type="button" data-logout>Logout</button>`);
    }
    return links.join("");
  }

  function renderNav() {
    const nav = $("mainNav");
    nav.innerHTML = navHtml();
    nav.querySelectorAll("[data-logout]").forEach((btn) => btn.addEventListener("click", logout));
  }

  function logout() {
    localStorage.removeItem(KEYS.loggedInUser);
    toast("You have been logged out.");
    location.hash = "#home";
    render();
  }

  function productCard(p, opts = {}) {
    const shop = shopById(p.shopId);
    const user = currentUser();
    const own = isOwnProduct(user, p);
    return `<article class="card product-card">
      <div class="thumb" style="background-image:url('${escapeHtml(p.image)}')">
        <span class="badge ${own ? "own" : ""}">${escapeHtml(p.category)}</span>
      </div>
      <div class="card-body">
        <h3>${escapeHtml(p.name)}</h3>
        <div class="price">${peso(p.price)}</div>
        <p class="meta">Shop: <span class="shop-link" data-shop="${p.shopId}">${escapeHtml(shop ? shop.name : "Shop")}</span></p>
        <p class="meta">Location: ${escapeHtml(shop ? shop.location : "")}</p>
        <p class="stars">${starText(productRating(p))}</p>
        <p class="meta">${escapeHtml(shop ? shop.sellerType : "")}</p>
        ${own ? `<div class="own-label">YOUR PRODUCT</div>
          <div class="card-actions">
            <button class="btn secondary" data-edit-product="${p.id}">Edit Product</button>
            <button class="btn danger" data-delete-product="${p.id}">Delete Product</button>
          </div>` : `<div class="card-actions product-buy-actions">
            <button class="btn btn-cart" type="button" data-add-cart="${p.id}" data-qty="1">Add to Cart</button>
            <button class="btn btn-buy" type="button" data-buy-now="${p.id}" data-qty="1">Buy</button>
          </div>`}
      </div>
    </article>`;
  }

  function shopCard(s) {
    return `<article class="card shop-card">
      <div class="thumb" style="background-image:url('${escapeHtml(s.image)}')"></div>
      <div class="card-body">
        <h3 class="shop-link" data-shop="${s.id}">${escapeHtml(s.name)}</h3>
        <p class="meta">${escapeHtml(s.sellerType)}</p>
        <p class="meta">${escapeHtml(s.location)}</p>
        <p class="meta">${escapeHtml(s.description)}</p>
        <p class="stars">${starText(shopRating(s))}</p>
        <p class="meta">${shopProductCount(s.id)} products</p>
        <div class="card-actions">
          <button class="btn" data-shop="${s.id}">View Shop</button>
          <button class="btn ghost" data-fav-shop="${s.id}">♡ Favorite</button>
        </div>
      </div>
    </article>`;
  }

  function filteredProducts() {
    const q = (state.search || "").toLowerCase().trim();
    return products().filter((p) => {
      const shop = shopById(p.shopId);
      if (state.category && p.category !== state.category) return false;
      if (!q) return true;
      const hay = [p.name, p.category, p.description, shop?.name, shop?.location, shop?.sellerType].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  function filteredShops() {
    const q = (state.search || "").toLowerCase().trim();
    if (!q) return shops();
    return shops().filter((s) => [s.name, s.sellerType, s.location, s.description].join(" ").toLowerCase().includes(q));
  }

  function viewHome() {
    const featured = products().slice(0, 8);
    const popular = shops();
    return `<section class="hero">
      <h1>Discover Local. Support Local.</h1>
      <p>Find handmade bags, native crafts, homemade snacks, and neighborhood shops in Mamburao, Occidental Mindoro.</p>
      <div class="hero-actions">
        <a class="btn" href="#products">Shop Now</a>
        <a class="btn ghost" href="#shops">Explore Shops</a>
      </div>
    </section>
    <section class="section">
      <div class="section-head"><h2>Featured Products</h2><a href="#products">See all</a></div>
      <div class="grid products-grid">${featured.map((p) => productCard(p)).join("")}</div>
    </section>
    <section class="section">
      <div class="section-head"><h2>Popular Shops</h2><a href="#shops">Business directory</a></div>
      <div class="grid shops-grid">${popular.map(shopCard).join("")}</div>
    </section>
    <section class="section">
      <div class="section-head"><h2>Categories</h2></div>
      <div class="chips">${CATEGORIES.map((c) => `<button class="chip" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join("")}</div>
    </section>
    <section class="section">
      <div class="section-head"><h2>Why LocalBess Hub?</h2></div>
      <div class="grid why-grid">
        <article class="card why-card"><h3>Support local makers</h3><p class="muted">Every order helps Mamburao sellers keep their livelihood in town.</p></article>
        <article class="card why-card"><h3>Shop the neighborhood</h3><p class="muted">Browse crafts, food, and native products without leaving your browser.</p></article>
        <article class="card why-card"><h3>Simple demo checkout</h3><p class="muted">COD and demo GCash let you walk through the full purchase flow. No real payments.</p></article>
      </div>
    </section>`;
  }

  function viewProducts() {
    const list = filteredProducts();
    const shopsFound = state.search ? filteredShops() : [];
    return `<section class="section">
      <div class="section-head">
        <div>
          <h2>Products</h2>
          <p class="muted">${state.search ? "Results for “" + escapeHtml(state.search) + "”" : "Browse local products from Mamburao shops."}</p>
        </div>
      </div>
      <div class="chips" style="margin-bottom:16px">
        <button class="chip ${!state.category ? "active" : ""}" data-cat="">All</button>
        ${CATEGORIES.map((c) => `<button class="chip ${state.category === c ? "active" : ""}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join("")}
      </div>
      ${shopsFound.length ? `<h3 style="margin:0 0 12px">Matching shops</h3><div class="grid shops-grid" style="margin-bottom:24px">${shopsFound.map(shopCard).join("")}</div>` : ""}
      ${list.length ? `<div class="grid products-grid">${list.map((p) => productCard(p)).join("")}</div>` : `<div class="empty">No products found.</div>`}
    </section>`;
  }

  function viewShops() {
    const list = filteredShops();
    return `<section class="section">
      <div class="section-head"><div><h2>Business Directory</h2><p class="muted">Local sellers in Mamburao.</p></div></div>
      ${list.length ? `<div class="grid shops-grid">${list.map(shopCard).join("")}</div>` : `<div class="empty">No shops found.</div>`}
    </section>`;
  }

  function viewCategories() {
    return `<section class="section">
      <div class="section-head"><h2>Categories</h2></div>
      <div class="grid cats-grid">${CATEGORIES.map((c) => `<button class="card why-card chip" style="text-align:left" data-cat="${escapeHtml(c)}"><h3>${escapeHtml(c)}</h3><p class="muted">${products().filter((p) => p.category === c).length} products</p></button>`).join("")}</div>
    </section>`;
  }

  function viewLogin() {
    return `<section class="auth-wrap">
      ${pageBack("#home")}
      <h2>Login</h2>
      <p class="muted">You must register first. Login only works for accounts saved in this browser.</p>
      <form id="loginForm">
        <div class="form-group"><label>Username</label><input name="username" required></div>
        <div class="form-group"><label>Password</label><input name="password" type="password" required></div>
        <button class="btn" type="submit">Login</button>
      </form>
      <p class="hint">No account yet? <a href="#register">Register as a Buyer or Seller</a>.</p>
      <p class="hint">Passwords are stored in localStorage for this prototype only. This is not production-level security.</p>
    </section>`;
  }

  function viewRegister() {
    const seller = state.registerRole === "seller";
    return `<section class="auth-wrap">
      ${pageBack("#login")}
      <h2>Create an account</h2>
      <p class="muted">Register first. After your account is saved, you can login.</p>
      <div class="role-pick">
        <div class="role-card ${!seller ? "active" : ""}" data-reg-role="buyer"><strong>Buyer</strong><p class="muted">Browse, favorite, and buy from local shops.</p></div>
        <div class="role-card ${seller ? "active" : ""}" data-reg-role="seller"><strong>Seller</strong><p class="muted">Open a shop, add products, and still buy from other shops.</p></div>
      </div>
      <form id="registerForm">
        <div class="form-grid">
          <div class="form-group"><label>Full Name</label><input name="fullName" required></div>
          <div class="form-group"><label>Username</label><input name="username" required></div>
          <div class="form-group"><label>Password</label><input name="password" type="password" required minlength="6"></div>
          <div class="form-group"><label>Confirm Password</label><input name="confirm" type="password" required></div>
          <div class="form-group"><label>Contact Number</label><input name="contact" required></div>
          <div class="form-group"><label>Account Type</label><input name="accountType" value="${seller ? "Seller" : "Buyer"}" readonly></div>
          <div class="form-group"><label>Street / Area</label><input name="street" required placeholder="Poblacion"></div>
          <div class="form-group"><label>Barangay</label><input name="barangay" required placeholder="Talabaan"></div>
          <div class="form-group"><label>Municipality</label><input name="municipality" required value="Mamburao"></div>
          <div class="form-group"><label>Province</label><input name="province" required value="Occidental Mindoro"></div>
          ${seller ? `
            <div class="form-group full"><label>Shop Name</label><input name="businessName" required></div>
            <div class="form-group full"><label>Shop Description</label><textarea name="businessDesc" rows="3" required></textarea></div>
            <div class="form-group full"><label>Shop Location</label><input name="businessLocation" value="Mamburao, Occidental Mindoro" required></div>
            <input type="hidden" name="sellerType" value="Local Seller">
          ` : ""}
        </div>
        <button class="btn" type="submit">Register</button>
      </form>
    </section>`;
  }

  function viewShopPage() {
    const shop = shopById(state.shopId);
    if (!shop) return `<section class="section"><div class="empty">Shop not found.</div></section>`;
    const owner = userById(shop.ownerId);
    const list = products().filter((p) => p.shopId === shop.id);
    const user = currentUser();
    const mine = user && user.id === shop.ownerId;
    return `<section class="section">
      ${pageBack(state.view === "myshop" ? "#dashboard" : "#shops")}
      <div class="card" style="padding:20px;margin-bottom:20px">
        <h2>${escapeHtml(shop.name)}</h2>
        <p class="meta">Owner: ${escapeHtml(owner ? owner.fullName : "—")} · ${escapeHtml(shop.sellerType)}</p>
        <p>${escapeHtml(shop.description)}</p>
        <p class="meta">Location: ${escapeHtml(shop.location)}</p>
        <p class="meta">Contact: ${escapeHtml(shop.contact || owner?.contact || "—")}</p>
        <p class="stars">${starText(shopRating(shop))}</p>
        <p class="meta">${list.length} products</p>
        <div class="card-actions">
          <button class="btn ghost" data-fav-shop="${shop.id}">♡ Favorite this shop</button>
          ${mine ? `<a class="btn" href="#myshop">Manage my shop</a>` : ""}
        </div>
      </div>
      <div class="section-head"><h2>Products from ${escapeHtml(shop.name)}</h2></div>
      ${mine ? `<p class="muted" style="margin-bottom:12px">These are your products. You can edit or delete them, but you cannot add them to cart or buy them.</p>` : ""}
      <div class="grid products-grid">${list.map((p) => productCard(p)).join("")}</div>
    </section>`;
  }

  function viewCart() {
    const user = currentUser();
    if (!user) return viewLogin();
    const items = cart().filter((c) => c.userId === user.id);
    if (!items.length) return `<section class="section">${pageBack("#products")}<div class="empty">Your cart is empty. <a href="#products">Continue shopping</a></div></section>`;
    let subtotal = 0;
    const rows = items.map((item) => {
      const p = productById(item.productId);
      if (!p) return "";
      const shop = shopById(p.shopId);
      const line = p.price * item.quantity;
      subtotal += line;
      return `<div class="cart-item">
        ${imgTag(p.image, p.name)}
        <div>
          <h3>${escapeHtml(p.name)}</h3>
          <p class="shop-link" data-shop="${p.shopId}">${escapeHtml(shop?.name || "")}</p>
          <p>${peso(p.price)}</p>
          <div class="qty">
            <button type="button" data-cart-qty="${item.productId}" data-delta="-1">−</button>
            <span>${item.quantity}</span>
            <button type="button" data-cart-qty="${item.productId}" data-delta="1">+</button>
          </div>
        </div>
        <div>
          <strong>${peso(line)}</strong>
          <p><button class="btn ghost" data-cart-remove="${item.productId}">Remove</button></p>
        </div>
      </div>`;
    }).join("");
    return `<section class="section wide">
      ${pageBack("#products")}
      <h2>Cart</h2>
      ${rows}
      <div class="totals">
        <p><span>Subtotal</span><span>${peso(subtotal)}</span></p>
        <p><span>Delivery Fee</span><span>${peso(DELIVERY_FEE)}</span></p>
        <p class="grand"><span>Grand Total</span><span>${peso(subtotal + DELIVERY_FEE)}</span></p>
        <div class="card-actions">
          <a class="btn ghost" href="#products">Continue shopping</a>
          <button class="btn" data-checkout-cart>Checkout</button>
        </div>
      </div>
    </section>`;
  }

  function initCheckoutDelivery(user) {
    if (!state.checkout) return;
    const addresses = userAddresses(user);
    if (state.checkout.addressId) {
      const current = addresses.find((a) => a.id === state.checkout.addressId);
      if (current) { applyDelivery(current); return; }
    }
    if (addresses.length) applyDelivery(addresses[0]);
    else {
      state.checkout.deliveryName = user.fullName || "";
      state.checkout.deliveryContact = user.contact || "";
      state.checkout.deliveryAddress = formatAddressText(user.address);
      state.checkout.deliveryParts = parseAddress(user.address);
    }
  }

  function viewCheckout() {
    const user = currentUser();
    if (!user || !state.checkout) return `<section class="section">${pageBack("#products")}<div class="empty">Nothing to checkout. <a href="#products">Shop now</a></div></section>`;
    initCheckoutDelivery(user);
    const items = state.checkout.items.map((it) => {
      const p = productById(it.productId);
      const shop = p ? shopById(p.shopId) : null;
      return { ...it, product: p, shop };
    }).filter((it) => it.product);
    const subtotal = items.reduce((s, it) => s + it.product.price * it.quantity, 0);
    const addresses = userAddresses(user);
    const selectedId = state.checkout.addressId;
    const selected = addresses.find((a) => a.id === selectedId) || addresses[0];
    const formMode = state.addressForm;
    const buyNow = state.checkout.source === "buy";
    return `<section class="auth-wrap wide">
      ${pageBack(state.checkout.from || (buyNow ? "#products" : "#cart"))}
      <h2>Buy / Checkout</h2>
      ${items.map((it) => `<div class="order-card checkout-item">
        ${imgTag(it.product.image, it.product.name)}
        <div>
          <p><strong>Product</strong><br>${escapeHtml(it.product.name)}</p>
          <p class="price">${peso(it.product.price)}</p>
          <p class="meta">Available stock: ${it.product.stock}</p>
          <p class="meta">Shop: ${escapeHtml(it.shop?.name || "")}</p>
          <div class="buy-qty-box">
            <p><strong>Quantity</strong></p>
            <div class="qty">
              <button type="button" data-co-qty="${it.productId}" data-delta="-1">−</button>
              <strong>${it.quantity}</strong>
              <button type="button" data-co-qty="${it.productId}" data-delta="1">+</button>
            </div>
            <p>Total: <strong>${peso(it.product.price * it.quantity)}</strong></p>
          </div>
        </div>
      </div>`).join("")}
      <div class="totals">
        <p><span>Subtotal</span><span>${peso(subtotal)}</span></p>
        <p><span>Delivery Fee</span><span>${peso(DELIVERY_FEE)}</span></p>
        <p class="grand"><span>Grand Total</span><span>${peso(subtotal + DELIVERY_FEE)}</span></p>
      </div>
      <div class="address-section">
        <h3>Delivery Address</h3>
        <p class="muted">Choose the address for this order</p>
        ${addresses.length ? addresses.map((addr) => `
          <button type="button" class="address-card ${addr.id === selectedId ? "selected" : ""}" data-pick-address="${escapeHtml(addr.id)}">
            <div class="addr-label">${addr.id === selectedId ? "✓ " : "○ "}${escapeHtml(addr.label || "Saved Address")}</div>
            <div class="addr-name">${escapeHtml(addr.fullName || user.fullName)}</div>
            <div class="meta">${escapeHtml(addr.contact || user.contact || "")}</div>
            <div class="address-lines">${formatAddressHtml(addr)}</div>
          </button>
        `).join("") : `<p class="muted">No saved address yet. Add one below.</p>`}
        <div class="address-toolbar">
          <button class="btn secondary" type="button" data-edit-checkout ${selected ? "" : "disabled"}>Edit Information</button>
          <button class="btn ghost" type="button" id="addAddressBtn">+ Add Address</button>
        </div>
        ${formMode === "edit" && selected ? `<div class="addr-form-card" id="editAddressBox">
          <h3>Edit Information</h3>
          ${addressFormFields("edit", selected, selected.fullName, selected.contact)}
          <div class="address-toolbar">
            <button class="btn ghost" type="button" data-cancel-address>Cancel</button>
            <button class="btn" type="button" id="saveCheckoutInfo">Save Changes</button>
          </div>
        </div>` : ""}
        ${formMode === "add" ? `<div class="addr-form-card" id="newAddressBox">
          <h3>Add New Address</h3>
          ${addressFormFields("new", { municipality: "Mamburao", province: "Occidental Mindoro" }, user.fullName, user.contact)}
          <div class="address-toolbar">
            <button class="btn ghost" type="button" data-cancel-address>Cancel</button>
            <button class="btn" type="button" id="saveNewAddress">Save Address</button>
          </div>
        </div>` : ""}
      </div>
      <h3 style="margin:16px 0 8px">Payment Information</h3>
      <div class="pay-options">
        <div class="pay-option ${(!state.payMethod || state.payMethod === "COD") ? "active" : ""}" data-pay="COD"><strong>COD</strong><p class="muted">Cash on Delivery. Payment will be collected when your order is delivered.</p></div>
        <div class="pay-option ${state.payMethod === "GCash" ? "active" : ""}" data-pay="GCash"><strong>GCash</strong><p class="muted">Demo payment only. No real money, MPIN, or OTP.</p></div>
      </div>
      <button class="btn" id="placeOrderBtn">Place Order</button>
    </section>`;
  }

  function viewSuccess() {
    const order = state.lastOrder;
    if (!order) return `<section class="section"><div class="empty">No recent order.</div></section>`;
    return `<section class="auth-wrap">
      ${pageBack("#home")}
      <div class="success-box">
        <h2>Order placed successfully!</h2>
        <p>Order Number: <strong>${escapeHtml(order.orderNumber)}</strong></p>
      </div>
      ${order.items.map((it) => `<p><strong>Shop:</strong> ${escapeHtml(it.shopName)}<br><strong>Product:</strong> ${escapeHtml(it.name)}<br><strong>Quantity:</strong> ${it.quantity}</p>`).join("<hr style='margin:12px 0;border:0;border-top:1px solid #e2e8f0'>")}
      <p><strong>Total:</strong> ${peso(order.total)}</p>
      <p><strong>Payment:</strong> ${escapeHtml(order.paymentMethod)}</p>
      <p><strong>Payment Status:</strong> ${escapeHtml(order.paymentStatus)}</p>
      <p><strong>Order Status:</strong> ${escapeHtml(order.status)}</p>
      ${order.deliveryAddress ? `<p><strong>Delivery:</strong> ${escapeHtml(order.deliveryName)} · ${escapeHtml(order.deliveryContact)}</p><p class="address-lines">${escapeHtml(order.deliveryAddress).replace(/\n/g, "<br>")}</p>` : ""}
      ${order.gcash ? `<p><strong>GCash Number:</strong> ${escapeHtml(order.gcash.number)}<br><strong>Reference Number:</strong> ${escapeHtml(order.gcash.ref)}</p>` : ""}
      <div class="card-actions" style="margin-top:16px">
        <a class="btn" href="#orders">View My Orders</a>
        <a class="btn ghost" href="#home">Back Home</a>
      </div>
    </section>`;
  }

  function viewOrders() {
    const user = currentUser();
    if (!user) return viewLogin();
    const mine = orders().filter((o) => o.userId === user.id).reverse();
    if (!mine.length) return `<section class="section">${pageBack("#home")}<div class="empty">No orders yet.</div></section>`;
    return `<section class="section wide">${pageBack("#home")}<h2>My Orders</h2>${mine.map(orderCardHtml).join("")}</section>`;
  }

  function orderCardHtml(o, sellerMode) {
    const date = o.createdAt ? new Date(o.createdAt).toLocaleString() : "—";
    return `<article class="card" style="padding:16px;margin-bottom:12px">
      <p><strong>${escapeHtml(o.orderNumber)}</strong></p>
      <p class="meta">Order date: ${escapeHtml(date)}</p>
      <p class="meta">Status: ${escapeHtml(o.status)} · Payment: ${escapeHtml(o.paymentMethod)} (${escapeHtml(o.paymentStatus)})</p>
      ${o.items.map((it) => `<p><strong>Product:</strong> ${escapeHtml(it.name)}<br><strong>Shop/Seller:</strong> ${escapeHtml(it.shopName)}<br><strong>Quantity:</strong> ${it.quantity} · <strong>Price:</strong> ${peso(it.price)} · <strong>Subtotal:</strong> ${peso(it.price * it.quantity)}</p>`).join("")}
      <p><strong>Total ${peso(o.total)}</strong></p>
      ${o.deliveryName ? `<p class="meta"><strong>Deliver to:</strong> ${escapeHtml(o.deliveryName)} · ${escapeHtml(o.deliveryContact || "")}</p>` : ""}
      ${o.deliveryAddress ? `<p class="meta"><strong>Delivery address:</strong></p><p class="address-lines">${escapeHtml(o.deliveryAddress).replace(/\n/g, "<br>")}</p>` : ""}
      ${sellerMode ? `<label>Update status
        <select data-order-status="${o.id}">${STATUSES.map((s) => `<option ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}</select>
      </label>` : ""}
      ${!sellerMode && o.status === "Completed" ? o.items.map((it) => `<button class="btn gold" data-rate-product="${it.productId}" data-shop="${it.shopId}">Rate ${escapeHtml(it.name)}</button>`).join(" ") : ""}
    </article>`;
  }

  function sellerSales(user) {
    const mine = orders()
      .map((o) => ({ ...o, items: (o.items || []).filter((it) => it.sellerId === user.id) }))
      .filter((o) => o.items.length);
    const productsSold = mine.reduce((s, o) => s + o.items.reduce((n, it) => n + Number(it.quantity || 0), 0), 0);
    const totalSales = mine.reduce((s, o) => s + o.items.reduce((n, it) => n + Number(it.price || 0) * Number(it.quantity || 0), 0), 0);
    const completed = mine.filter((o) => o.status === "Completed").length;
    return {
      totalOrders: mine.length,
      productsSold,
      totalSales,
      pending: mine.length - completed,
      completed
    };
  }

  function viewDashboard() {
    const user = currentUser();
    if (!user || user.role !== "seller") return viewLogin();
    const s = sellerSales(user);
    return `<section class="section wide">
      ${pageBack("#home")}
      <h2>Seller Dashboard</h2>
      <p class="muted">Sales from your products only.</p>
      <div class="stats-grid">
        <div class="stat-card"><span>Total Orders</span><strong>${s.totalOrders}</strong></div>
        <div class="stat-card"><span>Products Sold</span><strong>${s.productsSold}</strong></div>
        <div class="stat-card"><span>Total Sales</span><strong>${peso(s.totalSales)}</strong></div>
        <div class="stat-card"><span>Pending Orders</span><strong>${s.pending}</strong></div>
        <div class="stat-card"><span>Completed Orders</span><strong>${s.completed}</strong></div>
      </div>
      <a class="btn" href="#sellerorders">Manage customer orders</a>
    </section>`;
  }

  function viewSellerOrders() {
    const user = currentUser();
    if (!user || user.role !== "seller") return viewLogin();
    const mine = orders()
      .map((o) => ({ ...o, items: o.items.filter((it) => it.sellerId === user.id) }))
      .filter((o) => o.items.length)
      .reverse();
    if (!mine.length) return `<section class="section">${pageBack("#dashboard")}<div class="empty">No customer orders for your shop yet.</div></section>`;
    return `<section class="section wide">${pageBack("#dashboard")}<h2>Customer Orders</h2><p class="muted">Only orders that include your products are shown.</p>${mine.map((o) => orderCardHtml(o, true)).join("")}</section>`;
  }

  function viewFavorites() {
    const user = currentUser();
    if (!user) return viewLogin();
    const favs = favorites().filter((f) => f.userId === user.id);
    const prod = favs.filter((f) => f.type === "product").map((f) => productById(f.targetId)).filter(Boolean);
    const sh = favs.filter((f) => f.type === "shop").map((f) => shopById(f.targetId)).filter(Boolean);
    return `<section class="section">
      ${pageBack("#home")}
      <h2>My Favorites</h2>
      <h3 style="margin:16px 0 8px">Products</h3>
      ${prod.length ? `<div class="grid products-grid">${prod.map((p) => productCard(p)).join("")}</div>` : `<div class="empty">No favorite products.</div>`}
      <h3 style="margin:24px 0 8px">Shops</h3>
      ${sh.length ? `<div class="grid shops-grid">${sh.map(shopCard).join("")}</div>` : `<div class="empty">No favorite shops.</div>`}
    </section>`;
  }

  function viewAccount() {
    const user = currentUser();
    if (!user) return viewLogin();
    const edit = state.profileEditing;
    const ro = edit ? "" : "readonly";
    const seller = user.role === "seller";
    const addr = parseAddress(user.address);
    return `<section class="auth-wrap">
      ${pageBack("#home")}
      <h2>My Profile</h2>
      <div class="profile-avatar">${escapeHtml(initials(user.fullName))}</div>
      <form id="profileForm">
        <div class="form-grid">
          <div class="form-group"><label>Full Name</label><input name="fullName" value="${escapeHtml(user.fullName)}" ${ro}></div>
          <div class="form-group"><label>Username</label><input name="username" value="${escapeHtml(user.username)}" readonly></div>
          <div class="form-group"><label>Email</label><input name="email" type="email" value="${escapeHtml(user.email || "")}" ${ro}></div>
          <div class="form-group"><label>Contact Number</label><input name="contact" value="${escapeHtml(user.contact)}" ${ro}></div>
          <div class="form-group"><label>Street / Area</label><input name="street" value="${escapeHtml(addr.street)}" ${ro}></div>
          <div class="form-group"><label>Barangay</label><input name="barangay" value="${escapeHtml(addr.barangay)}" ${ro}></div>
          <div class="form-group"><label>Municipality</label><input name="municipality" value="${escapeHtml(addr.municipality)}" ${ro}></div>
          <div class="form-group"><label>Province</label><input name="province" value="${escapeHtml(addr.province)}" ${ro}></div>
        </div>
        ${seller ? `
          <h3>Shop Information</h3>
          <div class="form-grid">
            <div class="form-group full"><label>Business Name</label><input name="businessName" value="${escapeHtml(user.businessName || "")}" ${ro}></div>
            <div class="form-group full"><label>Business Description</label><textarea name="businessDesc" rows="3" ${ro}>${escapeHtml(user.businessDesc || "")}</textarea></div>
            <div class="form-group"><label>Business Location</label><input name="businessLocation" value="${escapeHtml(user.businessLocation || "")}" ${ro}></div>
            <div class="form-group"><label>Account Type</label><input value="Seller" readonly></div>
          </div>
          <p class="stars">Shop rating: ${starText(shopRating(shopById(user.shopId) || { id: user.shopId, baseRating: 0 }))}</p>
        ` : ""}
        <div class="card-actions">
          ${edit ? `<button class="btn" type="submit">Save Changes</button><button class="btn ghost" type="button" data-cancel-edit>Cancel</button>` : `<button class="btn" type="button" data-edit-profile>Edit Profile</button>`}
          <button class="btn danger" type="button" data-logout>Logout</button>
        </div>
      </form>
    </section>`;
  }

  function viewMyShop() {
    const user = currentUser();
    if (!user || user.role !== "seller") return viewLogin();
    const shop = shopById(user.shopId);
    if (!shop) return `<section class="section">${pageBack("#dashboard")}<div class="empty">Shop missing.</div></section>`;
    state.shopId = shop.id;
    return viewShopPage() + `<section class="section"><a class="btn" href="#myproducts">Add / manage products</a></section>`;
  }

  function viewMyProducts() {
    const user = currentUser();
    if (!user || user.role !== "seller") return viewLogin();
    const list = products().filter((p) => p.sellerId === user.id);
    return `<section class="section">
      ${pageBack("#dashboard")}
      <div class="section-head"><h2>My Products</h2><button class="btn" data-add-product>Add Product</button></div>
      ${list.length ? `<div class="grid products-grid">${list.map((p) => productCard(p)).join("")}</div>` : `<div class="empty">You have no products yet.</div>`}
    </section>`;
  }

  function parseHash() {
    const raw = (location.hash || "#home").slice(1);
    const [view, extra] = raw.split("/");
    state.view = view || "home";
    state.shopId = view === "shop" ? extra : state.shopId;
    if (view !== "account") state.profileEditing = false;
    if (view !== "checkout") {
      state.addressForm = null;
      state.checkoutEditing = false;
    }
  }

  function viewHtml() {
    switch (state.view) {
      case "home": return viewHome();
      case "products": return viewProducts();
      case "shops": return viewShops();
      case "categories": return viewCategories();
      case "login": return viewLogin();
      case "register": return viewRegister();
      case "shop": return viewShopPage();
      case "cart": return viewCart();
      case "checkout": return viewCheckout();
      case "success": return viewSuccess();
      case "orders": return viewOrders();
      case "sellerorders": return viewSellerOrders();
      case "dashboard": return viewDashboard();
      case "favorites": return viewFavorites();
      case "account": return viewAccount();
      case "myshop": return viewMyShop();
      case "myproducts": return viewMyProducts();
      default: return viewHome();
    }
  }

  function bindAppEvents() {
    const app = $("app");
    app.querySelectorAll("[data-shop]").forEach((el) => el.addEventListener("click", () => {
      location.hash = "#shop/" + el.getAttribute("data-shop");
    }));
    app.querySelectorAll("[data-cat]").forEach((el) => el.addEventListener("click", () => {
      state.category = el.getAttribute("data-cat") || "";
      state.search = "";
      location.hash = "#products";
      render();
    }));
    app.querySelectorAll("[data-back]").forEach((el) => el.addEventListener("click", () => goBack(el.getAttribute("data-back"))));
    app.querySelectorAll("[data-add-cart]").forEach((el) => el.addEventListener("click", () => {
      const id = el.getAttribute("data-add-cart");
      const qty = Number(el.getAttribute("data-qty") || 1);
      addToCart(id, qty);
    }));
    app.querySelectorAll("[data-buy-now]").forEach((el) => el.addEventListener("click", () => {
      const id = el.getAttribute("data-buy-now");
      const qty = Number(el.getAttribute("data-qty") || 1);
      buyNow(id, qty);
    }));
    app.querySelectorAll("[data-co-qty]").forEach((el) => el.addEventListener("click", () => {
      updateCheckoutQty(el.getAttribute("data-co-qty"), Number(el.getAttribute("data-delta")));
    }));
    app.querySelectorAll("[data-pick-address]").forEach((el) => el.addEventListener("click", () => {
      const user = currentUser();
      const addr = userAddresses(user).find((a) => a.id === el.getAttribute("data-pick-address"));
      if (addr) {
        applyDelivery(addr);
        state.addressForm = null;
        render();
      }
    }));
    app.querySelector("[data-cancel-address]")?.addEventListener("click", () => {
      state.addressForm = null;
      render();
    });
    app.querySelectorAll("[data-qty-minus]").forEach((el) => el.addEventListener("click", () => {
      const span = document.getElementById("q-" + el.getAttribute("data-qty-minus"));
      span.textContent = String(Math.max(1, Number(span.textContent) - 1));
    }));
    app.querySelectorAll("[data-qty-plus]").forEach((el) => el.addEventListener("click", () => {
      const span = document.getElementById("q-" + el.getAttribute("data-qty-plus"));
      const stock = Number(el.getAttribute("data-stock"));
      span.textContent = String(Math.min(stock, Number(span.textContent) + 1));
    }));
    app.querySelectorAll("[data-fav-shop]").forEach((el) => el.addEventListener("click", () => favorite("shop", el.getAttribute("data-fav-shop"))));
    app.querySelectorAll("[data-cart-qty]").forEach((el) => el.addEventListener("click", () => updateCartQty(el.getAttribute("data-cart-qty"), Number(el.getAttribute("data-delta")))));
    app.querySelectorAll("[data-cart-remove]").forEach((el) => el.addEventListener("click", () => removeCart(el.getAttribute("data-cart-remove"))));
    app.querySelector("[data-checkout-cart]")?.addEventListener("click", checkoutCart);
    app.querySelectorAll(".pay-option").forEach((el) => el.addEventListener("click", () => {
      app.querySelectorAll(".pay-option").forEach((p) => p.classList.remove("active"));
      el.classList.add("active");
      state.payMethod = el.getAttribute("data-pay");
    }));
    app.querySelector("[data-edit-checkout]")?.addEventListener("click", () => {
      state.addressForm = "edit";
      state.checkoutEditing = true;
      render();
    });
    app.querySelector("#saveCheckoutInfo")?.addEventListener("click", saveEditedCheckoutAddress);
    app.querySelector("#addAddressBtn")?.addEventListener("click", () => {
      state.addressForm = "add";
      render();
    });
    app.querySelector("#saveNewAddress")?.addEventListener("click", saveNewCheckoutAddress);
    app.querySelector("#placeOrderBtn")?.addEventListener("click", () => beginPayment(state.payMethod || "COD"));
    app.querySelector("#loginForm")?.addEventListener("submit", handleLogin);
    app.querySelector("#registerForm")?.addEventListener("submit", handleRegister);
    app.querySelectorAll("[data-reg-role]").forEach((el) => el.addEventListener("click", () => {
      state.registerRole = el.getAttribute("data-reg-role");
      render();
    }));
    app.querySelector("[data-edit-profile]")?.addEventListener("click", () => { state.profileEditing = true; render(); });
    app.querySelector("[data-cancel-edit]")?.addEventListener("click", () => { state.profileEditing = false; render(); });
    app.querySelector("#profileForm")?.addEventListener("submit", saveProfile);
    app.querySelectorAll("[data-logout]").forEach((btn) => btn.addEventListener("click", logout));
    app.querySelector("[data-add-product]")?.addEventListener("click", () => openProductForm());
    app.querySelectorAll("[data-edit-product]").forEach((el) => el.addEventListener("click", () => openProductForm(el.getAttribute("data-edit-product"))));
    app.querySelectorAll("[data-delete-product]").forEach((el) => el.addEventListener("click", () => deleteProduct(el.getAttribute("data-delete-product"))));
    app.querySelectorAll("[data-order-status]").forEach((el) => el.addEventListener("change", () => updateOrderStatus(el.getAttribute("data-order-status"), el.value)));
    app.querySelectorAll("[data-rate-product]").forEach((el) => el.addEventListener("click", () => openRating(el.getAttribute("data-rate-product"), el.getAttribute("data-shop"))));
  }

  function goBack(fallbackHash) {
    location.hash = fallbackHash || "#home";
    render();
  }

  function handleLogin(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const username = String(fd.get("username")).trim();
    const password = String(fd.get("password"));
    const existing = users().find((u) => u.username.toLowerCase() === username.toLowerCase());
    if (!existing) {
      toast("Account not found. Please register first.");
      return;
    }
    if (existing.password !== password) {
      toast("Invalid username or password.");
      return;
    }
    save(KEYS.loggedInUser, existing);
    toast("Welcome, " + existing.fullName + "!");
    location.hash = "#home";
    render();
  }

  function handleRegister(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const password = String(fd.get("password"));
    const confirm = String(fd.get("confirm"));
    if (password !== confirm) { toast("Passwords do not match."); return; }
    const username = String(fd.get("username")).trim();
    if (users().some((u) => u.username.toLowerCase() === username.toLowerCase())) {
      toast("Username already exists.");
      return;
    }
    const role = state.registerRole === "seller" ? "seller" : "buyer";
    const address = {
      street: String(fd.get("street") || "").trim(),
      barangay: String(fd.get("barangay") || "").trim(),
      municipality: String(fd.get("municipality") || "").trim(),
      province: String(fd.get("province") || "").trim()
    };
    const user = {
      id: uid("u"),
      role,
      fullName: String(fd.get("fullName")).trim(),
      username,
      email: username + "@localbess.local",
      password,
      contact: String(fd.get("contact")).trim(),
      address,
      savedAddresses: [],
      avatar: ""
    };
    user.savedAddresses = [makeSavedAddress({
      ...address,
      label: "Default Address",
      fullName: user.fullName,
      contact: user.contact,
      isDefault: true
    }, user, 0)];
    if (role === "seller") {
      const shopId = uid("shop");
      user.sellerType = "Local Seller";
      user.businessName = String(fd.get("businessName")).trim();
      user.businessDesc = String(fd.get("businessDesc")).trim();
      user.businessLocation = String(fd.get("businessLocation")).trim();
      user.shopId = shopId;
      const shop = {
        id: shopId,
        ownerId: user.id,
        name: user.businessName,
        sellerType: user.sellerType,
        description: user.businessDesc,
        location: user.businessLocation,
        contact: user.contact,
        baseRating: 5,
        image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80"
      };
      setShops(shops().concat(shop));
    }
    setUsers(users().concat(user));
    toast("Account saved. Please login to continue.");
    location.hash = "#login";
    render();
  }

  function saveProfile(e) {
    e.preventDefault();
    if (!state.profileEditing) return;
    const user = currentUser();
    const fd = new FormData(e.target);
    const email = String(fd.get("email")).trim();
    const contact = String(fd.get("contact")).trim();
    const fullName = String(fd.get("fullName")).trim();
    if (!fullName || !contact) { toast("Please complete required fields."); return; }
    user.fullName = fullName;
    user.email = email;
    user.contact = contact;
    user.address = {
      street: String(fd.get("street") || "").trim(),
      barangay: String(fd.get("barangay") || "").trim(),
      municipality: String(fd.get("municipality") || "").trim(),
      province: String(fd.get("province") || "").trim()
    };
    const addrs = userAddresses(user);
    if (addrs.length) {
      addrs[0] = makeSavedAddress({
        ...addrs[0],
        ...user.address,
        fullName,
        contact,
        label: addrs[0].label || "Default Address",
        isDefault: true
      }, user, 0);
    } else {
      addrs.push(makeSavedAddress({
        ...user.address,
        fullName,
        contact,
        label: "Default Address",
        isDefault: true
      }, user, 0));
    }
    user.savedAddresses = addrs;
    if (user.role === "seller") {
      user.businessName = String(fd.get("businessName") || "").trim();
      user.businessDesc = String(fd.get("businessDesc") || "").trim();
      user.businessLocation = String(fd.get("businessLocation") || "").trim();
      user.sellerType = "Local Seller";
      const allShops = shops().map((s) => {
        if (s.id !== user.shopId) return s;
        return {
          ...s,
          name: user.businessName,
          description: user.businessDesc,
          location: user.businessLocation,
          sellerType: user.sellerType,
          contact: user.contact
        };
      });
      setShops(allShops);
    }
    persistUser(user);
    state.profileEditing = false;
    toast("Profile updated successfully!");
    render();
  }

  function favorite(type, id) {
    if (!requireLogin("save favorites")) return;
    const user = currentUser();
    const all = favorites();
    const exists = all.find((f) => f.userId === user.id && f.type === type && f.targetId === id);
    if (exists) {
      setFavorites(all.filter((f) => f !== exists));
      toast("Removed from favorites.");
    } else {
      all.push({ userId: user.id, type, targetId: id });
      setFavorites(all);
      toast("Added to favorites.");
    }
  }

  function addToCart(productId, qty) {
    if (!requireLogin("add items to cart")) return;
    const user = currentUser();
    const product = productById(productId);
    if (!product) return;
    if (isOwnProduct(user, product)) {
      toast("You cannot add your own product to the cart.");
      return;
    }
    qty = Math.max(1, Math.min(product.stock, Number(qty) || 1));
    const all = cart();
    const existing = all.find((c) => c.userId === user.id && c.productId === productId);
    if (existing) existing.quantity = Math.min(product.stock, existing.quantity + qty);
    else all.push({ userId: user.id, productId, quantity: qty });
    setCart(all);
    toast("Added to cart.");
  }

  function updateCartQty(productId, delta) {
    const user = currentUser();
    const product = productById(productId);
    const all = cart().map((c) => {
      if (c.userId !== user.id || c.productId !== productId) return c;
      const next = Math.max(1, Math.min(product.stock, c.quantity + delta));
      return { ...c, quantity: next };
    });
    setCart(all);
    render();
  }

  function removeCart(productId) {
    const user = currentUser();
    setCart(cart().filter((c) => !(c.userId === user.id && c.productId === productId)));
    render();
  }

  function buyNow(productId, qty) {
    if (!requireLogin("buy products")) return;
    const user = currentUser();
    const product = productById(productId);
    if (!product) return;
    if (isOwnProduct(user, product)) {
      toast("You cannot buy your own product.");
      return;
    }
    qty = Math.max(1, Math.min(product.stock, Number(qty) || 1));
    state.checkout = {
      items: [{ productId, quantity: qty }],
      source: "buy",
      from: "#products"
    };
    state.payMethod = "COD";
    state.checkoutEditing = false;
    state.addressForm = null;
    initCheckoutDelivery(user);
    location.hash = "#checkout";
    render();
  }

  function checkoutCart() {
    const user = currentUser();
    const items = cart().filter((c) => c.userId === user.id);
    if (!items.length) return;
    const invalid = items.some((it) => {
      const p = productById(it.productId);
      return !p || isOwnProduct(user, p);
    });
    if (invalid) {
      toast("Your cart contains items you cannot purchase.");
      return;
    }
    state.checkout = {
      items: items.map((it) => ({ productId: it.productId, quantity: it.quantity })),
      source: "cart",
      from: "#cart"
    };
    state.payMethod = "COD";
    state.checkoutEditing = false;
    state.addressForm = null;
    initCheckoutDelivery(user);
    location.hash = "#checkout";
    render();
  }

  function updateCheckoutQty(productId, delta) {
    if (!state.checkout) return;
    const product = productById(productId);
    if (!product) return;
    state.checkout.items = state.checkout.items.map((it) => {
      if (it.productId !== productId) return it;
      const next = Math.max(1, Math.min(product.stock, Number(it.quantity) + delta));
      return { ...it, quantity: next };
    });
    render();
  }

  function captureCheckoutForm() {
    if (!state.checkout) return;
    const user = currentUser();
    const addrs = userAddresses(user);
    const selected = addrs.find((a) => a.id === state.checkout.addressId) || addrs[0];
    if (selected) applyDelivery(selected);
  }

  function saveEditedCheckoutAddress() {
    const user = currentUser();
    const fields = readAddressFields("edit");
    if (!fields.fullName || !fields.contact || !fields.street || !fields.barangay || !fields.municipality || !fields.province) {
      toast("Please complete all delivery fields.");
      return;
    }
    const addrs = userAddresses(user);
    const idx = addrs.findIndex((a) => a.id === state.checkout.addressId);
    const updated = makeSavedAddress({
      ...(addrs[idx] || {}),
      ...fields,
      id: state.checkout.addressId || uid("addr"),
      label: (addrs[idx] && addrs[idx].label) || "Default Address"
    }, user, idx >= 0 ? idx : 0);
    if (idx >= 0) addrs[idx] = updated;
    else addrs.unshift(updated);
    user.savedAddresses = addrs;
    user.fullName = fields.fullName;
    user.contact = fields.contact;
    if (idx <= 0) user.address = parseAddress(updated);
    persistUser(user);
    applyDelivery(updated);
    state.addressForm = null;
    state.checkoutEditing = false;
    toast("Delivery information updated.");
    render();
  }

  function saveNewCheckoutAddress() {
    const user = currentUser();
    const fields = readAddressFields("new");
    if (!fields.fullName || !fields.contact || !fields.street || !fields.barangay || !fields.municipality || !fields.province) {
      toast("Please complete all address fields.");
      return;
    }
    const addrs = userAddresses(user);
    const saved = makeSavedAddress({
      ...fields,
      id: uid("addr"),
      label: addrs.length ? "Other Address" : "Default Address",
      isDefault: !addrs.length
    }, user, addrs.length);
    addrs.push(saved);
    user.savedAddresses = addrs;
    persistUser(user);
    applyDelivery(saved);
    state.addressForm = null;
    toast("Address added. It is selected for this order.");
    render();
  }

  function nextOrderNumber() {
    const n = orders().length + 1;
    return "ORD-2026-" + String(n).padStart(4, "0");
  }

  function beginPayment(method) {
    const user = currentUser();
    if (!user || !state.checkout) return;
    captureCheckoutForm();
    if (!state.checkout.deliveryName || !state.checkout.deliveryContact || !state.checkout.deliveryAddress) {
      toast("Please add or select a delivery address.");
      return;
    }
    const ownItem = state.checkout.items.some((it) => {
      const p = productById(it.productId);
      return isOwnProduct(user, p);
    });
    if (ownItem) {
      toast("You cannot checkout your own products.");
      return;
    }
    if (method === "GCash") {
      const items = state.checkout.items.map((it) => {
        const p = productById(it.productId);
        return { ...it, product: p };
      });
      const subtotal = items.reduce((s, it) => s + it.product.price * it.quantity, 0);
      const total = subtotal + DELIVERY_FEE;
      const ref = "GC" + Math.floor(100000000 + Math.random() * 900000000);
      openOverlay(`<div class="modal">
        <button class="modal-close" type="button" id="ovClose">×</button>
        <div class="gcash-box">
          <h2>GCash Payment</h2>
          <p>This is a demonstration only. No real GCash account, MPIN, OTP, or money is used.</p>
          <p>GCash Number:<br><strong>09XX XXX XXXX</strong></p>
          <p>Account Name:<br><strong>LocalBess Hub Demo</strong></p>
          <p>Amount:<br><strong>${peso(total)}</strong></p>
          <p>Reference Number:<br><strong>${ref}</strong></p>
        </div>
        <button class="btn" style="margin-top:14px" id="confirmGcash">Confirm Payment</button>
      </div>`);
      $("overlayRoot").querySelector("#ovClose").onclick = closeOverlay;
      $("overlayRoot").querySelector("#confirmGcash").onclick = () => {
        closeOverlay();
        placeOrder("GCash", {
          number: "09XX XXX XXXX",
          name: "LocalBess Hub Demo",
          ref,
          status: "PAID"
        });
      };
      return;
    }
    placeOrder("COD", null);
  }

  function placeOrder(method, gcash) {
    const user = currentUser();
    const built = state.checkout.items.map((it) => {
      const p = productById(it.productId);
      const shop = shopById(p.shopId);
      return {
        productId: p.id,
        sellerId: p.sellerId,
        shopId: p.shopId,
        name: p.name,
        shopName: shop.name,
        quantity: it.quantity,
        price: p.price
      };
    });
    const subtotal = built.reduce((s, it) => s + it.price * it.quantity, 0);
    const order = {
      id: uid("ord"),
      orderNumber: nextOrderNumber(),
      userId: user.id,
      items: built,
      deliveryFee: DELIVERY_FEE,
      subtotal,
      total: subtotal + DELIVERY_FEE,
      paymentMethod: method,
      paymentStatus: method === "GCash" ? "PAID" : "COD — pay on delivery",
      status: "Processing",
      deliveryName: state.checkout.deliveryName,
      deliveryContact: state.checkout.deliveryContact,
      deliveryAddress: state.checkout.deliveryAddress,
      gcash,
      createdAt: new Date().toISOString()
    };
    const allProducts = products().map((p) => {
      const it = built.find((b) => b.productId === p.id);
      if (!it) return p;
      return { ...p, stock: Math.max(0, p.stock - it.quantity) };
    });
    setProducts(allProducts);
    setOrders(orders().concat(order));
    if (state.view === "checkout" && cart().some((c) => c.userId === user.id && built.some((b) => b.productId === c.productId))) {
      setCart(cart().filter((c) => !(c.userId === user.id && built.some((b) => b.productId === c.productId))));
    }
    state.lastOrder = order;
    state.checkout = null;
    if (method === "GCash") {
      openOverlay(`<div class="modal success-box">
        <button class="modal-close" type="button" id="ovClose">×</button>
        <h2>Payment Successful</h2>
        <p>Payment Method: GCash</p>
        <p>GCash Number: 09XX XXX XXXX</p>
        <p>Reference Number: ${escapeHtml(gcash.ref)}</p>
        <p>Amount Paid: ${peso(order.total)}</p>
        <p>Payment Status: <strong>PAID</strong></p>
        <p>Order Number: ${escapeHtml(order.orderNumber)}</p>
        <button class="btn" id="seeOrder">View Order</button>
      </div>`);
      $("overlayRoot").querySelector("#ovClose").onclick = closeOverlay;
      $("overlayRoot").querySelector("#seeOrder").onclick = () => {
        closeOverlay();
        location.hash = "#success";
        render();
      };
    }
    location.hash = "#success";
    render();
  }

  function updateOrderStatus(id, status) {
    setOrders(orders().map((o) => (o.id === id ? { ...o, status } : o)));
    toast("Order status updated.");
    render();
  }

  function openProduct(id, buyMode = false) {
    const p = productById(id);
    if (!p) return;
    const shop = shopById(p.shopId);
    const user = currentUser();
    const own = isOwnProduct(user, p);
    const showBuy = buyMode && !own;
    openOverlay(`<div class="modal">
      <button class="modal-close" type="button" id="ovClose">×</button>
      <div class="purchase">
        ${imgTag(p.image, p.name)}
        <div>
          <h2>${escapeHtml(p.name)}</h2>
          <p class="price" id="detailPrice">${peso(p.price)}</p>
          <p>${escapeHtml(p.description)}</p>
          <p class="meta">Available stock: ${p.stock}</p>
          <p class="stars">${starText(productRating(p))}</p>
          <p>Shop: <span class="shop-link" id="detailShop">${escapeHtml(shop?.name || "")}</span></p>
          <p class="meta">${escapeHtml(shop?.location || "")} · ${escapeHtml(shop?.sellerType || "")}</p>
          ${own ? `<div class="own-label">YOUR PRODUCT</div>
            <div class="card-actions">
              <button class="btn secondary" id="dEdit">Edit Product</button>
              <button class="btn danger" id="dDelete">Delete Product</button>
            </div>` : showBuy ? `
            <p>Quantity</p>
            <div class="qty">
              <button type="button" id="dMinus">−</button>
              <strong id="dQty">1</strong>
              <button type="button" id="dPlus">+</button>
            </div>
            <p>Price: ${peso(p.price)}</p>
            <p>Total: <strong id="dTotal">${peso(p.price)}</strong></p>
            ${user ? `<div class="card-actions">
              <button class="btn secondary" id="dCart">Add to Cart</button>
              <button class="btn" id="dBuy">Buy Now</button>
            </div>` : `<p class="muted">Login to add this to your cart or buy now.</p><a class="btn" href="#login">Login</a>`}
            <button class="btn ghost" id="dFav" style="margin-top:8px">♡ Favorite product</button>
          ` : `
            ${user ? `<button class="btn" id="chooseBuy">Buy Product</button>` : `<p class="muted">Login to buy this product.</p><a class="btn" href="#login">Login</a>`}
          `}
        </div>
      </div>
    </div>`);
    const root = $("overlayRoot");
    root.querySelector("#ovClose").onclick = closeOverlay;
    root.querySelector("#detailShop").onclick = () => { closeOverlay(); location.hash = "#shop/" + p.shopId; };
    root.querySelector("#chooseBuy")?.addEventListener("click", () => openProduct(p.id, true));
    root.querySelector("#dEdit")?.addEventListener("click", () => { closeOverlay(); openProductForm(p.id); });
    root.querySelector("#dDelete")?.addEventListener("click", () => { closeOverlay(); deleteProduct(p.id); });
    root.querySelector("#dFav")?.addEventListener("click", () => favorite("product", p.id));
    let qty = 1;
    const updateTotal = () => {
      const q = root.querySelector("#dQty");
      const t = root.querySelector("#dTotal");
      if (q) q.textContent = String(qty);
      if (t) t.textContent = peso(p.price * qty);
    };
    root.querySelector("#dMinus")?.addEventListener("click", () => { qty = Math.max(1, qty - 1); updateTotal(); });
    root.querySelector("#dPlus")?.addEventListener("click", () => { qty = Math.min(p.stock, qty + 1); updateTotal(); });
    root.querySelector("#dCart")?.addEventListener("click", () => { addToCart(p.id, qty); closeOverlay(); });
    root.querySelector("#dBuy")?.addEventListener("click", () => { closeOverlay(); buyNow(p.id, qty); });
  }

  function openProductForm(id) {
    const user = currentUser();
    if (!user || user.role !== "seller") { toast("Only sellers can manage products."); return; }
    const p = id ? productById(id) : null;
    if (p && p.sellerId !== user.id) { toast("You can only edit your own products."); return; }
    openOverlay(`<div class="modal">
      <button class="modal-close" type="button" id="ovClose">×</button>
      <h2>${p ? "Edit Product" : "Add Product"}</h2>
      <form id="prodForm">
        <div class="form-group"><label>Product Name</label><input name="name" required value="${escapeHtml(p?.name || "")}"></div>
        <div class="form-group"><label>Price</label><input name="price" type="number" min="1" required value="${p?.price || ""}"></div>
        <div class="form-group"><label>Stock</label><input name="stock" type="number" min="0" required value="${p?.stock ?? 10}"></div>
        <div class="form-group"><label>Category</label>
          <select name="category">${CATEGORIES.map((c) => `<option ${p?.category === c ? "selected" : ""}>${c}</option>`).join("")}</select>
        </div>
        <div class="form-group"><label>Image URL</label><input name="image" value="${escapeHtml(p?.image || "")}" placeholder="https://..."></div>
        <div class="form-group"><label>Description</label><textarea name="description" rows="3" required>${escapeHtml(p?.description || "")}</textarea></div>
        <button class="btn" type="submit">Save Product</button>
      </form>
    </div>`);
    $("overlayRoot").querySelector("#ovClose").onclick = closeOverlay;
    $("overlayRoot").querySelector("#prodForm").onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = {
        name: String(fd.get("name")).trim(),
        price: Number(fd.get("price")),
        stock: Number(fd.get("stock")),
        category: String(fd.get("category")),
        image: String(fd.get("image")).trim() || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80",
        description: String(fd.get("description")).trim()
      };
      if (p) {
        if (p.sellerId !== currentUser().id) { toast("You can only edit your own products."); return; }
        setProducts(products().map((x) => (x.id === p.id ? { ...x, ...data } : x)));
        toast("Product updated.");
      } else {
        setProducts(products().concat({
          id: uid("p"),
          sellerId: user.id,
          shopId: user.shopId,
          baseRating: 5,
          ...data
        }));
        toast("Product added.");
      }
      closeOverlay();
      render();
    };
  }

  function deleteProduct(id) {
    const user = currentUser();
    const p = productById(id);
    if (!p || !user || p.sellerId !== user.id) {
      toast("You can only delete your own products.");
      return;
    }
    if (!confirm("Delete this product?")) return;
    setProducts(products().filter((x) => x.id !== id));
    toast("Product deleted.");
    render();
  }

  function openRating(productId, shopId) {
    const user = currentUser();
    openOverlay(`<div class="modal">
      <button class="modal-close" type="button" id="ovClose">×</button>
      <h2>Rate your purchase</h2>
      <p>Tap a star (1–5) for the product, then the shop.</p>
      <p>Product</p>
      <div id="prodStars">${[1,2,3,4,5].map((n) => `<span class="star-pick" data-n="${n}">★</span>`).join("")}</div>
      <p style="margin-top:12px">Shop</p>
      <div id="shopStars">${[1,2,3,4,5].map((n) => `<span class="star-pick" data-n="${n}">★</span>`).join("")}</div>
      <button class="btn" style="margin-top:16px" id="saveRate">Save rating</button>
    </div>`);
    let prod = 5, shop = 5;
    const paint = (rootId, value) => {
      $("overlayRoot").querySelectorAll("#" + rootId + " .star-pick").forEach((el) => {
        el.classList.toggle("on", Number(el.getAttribute("data-n")) <= value);
      });
    };
    const bind = (rootId, setter) => {
      $("overlayRoot").querySelectorAll("#" + rootId + " .star-pick").forEach((el) => {
        el.addEventListener("click", () => { setter(Number(el.getAttribute("data-n"))); paint(rootId, Number(el.getAttribute("data-n"))); });
      });
    };
    bind("prodStars", (n) => { prod = n; });
    bind("shopStars", (n) => { shop = n; });
    paint("prodStars", 5);
    paint("shopStars", 5);
    $("overlayRoot").querySelector("#ovClose").onclick = closeOverlay;
    $("overlayRoot").querySelector("#saveRate").onclick = () => {
      const all = ratings().filter((r) => !(r.userId === user.id && ((r.type === "product" && r.targetId === productId) || (r.type === "shop" && r.targetId === shopId))));
      all.push({ userId: user.id, type: "product", targetId: productId, stars: prod });
      all.push({ userId: user.id, type: "shop", targetId: shopId, stars: shop });
      setRatings(all);
      toast("Thank you for rating!");
      closeOverlay();
      render();
    };
  }

  function render() {
    seedIfNeeded();
    parseHash();
    renderNav();
    $("app").innerHTML = viewHtml();
    bindAppEvents();
    $("mainNav").classList.remove("open");
  }

  document.addEventListener("DOMContentLoaded", () => {
    seedIfNeeded();
    $("headerSearchForm").addEventListener("submit", (e) => {
      e.preventDefault();
      state.search = $("globalSearch").value.trim();
      state.category = "";
      location.hash = "#products";
      render();
    });
    $("navToggle").addEventListener("click", () => $("mainNav").classList.toggle("open"));
    window.addEventListener("hashchange", render);
    if (!location.hash) location.hash = "#home";
    render();
  });
})();
