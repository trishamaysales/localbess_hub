LOCALBESS HUB
Discover Local. Support Local.
Mamburao, Occidental Mindoro

HOW TO OPEN
1. Double-click index.html
2. Or open it in Google Chrome / Microsoft Edge
3. GitHub Pages: upload index.html, style.css, and script.js to a repository and enable Pages

This project uses HTML, CSS, and vanilla JavaScript only. There is no PHP, MySQL, Node backend, or real payment API.

NOTICE
This system is a front-end prototype. Authentication, user data, orders, and payment demonstrations use browser localStorage and are not suitable for real production transactions. Passwords are stored in localStorage for demo purposes only and are not production-level secure. GCash checkout is a simulation. Do not enter a real MPIN, OTP, or GCash password. No real money is processed.

ACCOUNT TYPES
Only two account types: Buyer and Seller.
There is no Reseller account.

HOW TO SIGN IN
Register first, then login. Unregistered usernames cannot sign in.
Flow: Register → Account Saved → Login → Access the System
If you try to login with an account that is not in localStorage, the system shows:
"Account not found. Please register first."
Login never auto-creates an account.

BUYER REGISTRATION
Full Name, Username, Password, Contact Number, Street/Area, Barangay, Municipality, Province, Account Type: Buyer

SELLER REGISTRATION
Buyer fields plus Shop Name, Shop Description, Shop Location, Account Type: Seller
After registration, the seller logs in to use the existing seller dashboard, shop, products, and orders.

SAMPLE SHOPS
The marketplace seeds local shops and products. Shop owners (seller, ana, nanay) are stored as registered users so those shops work. New buyers and sellers should still register their own accounts.

BUYER FLOW
REGISTER → LOGIN → HOME / PRODUCTS → [ ADD TO CART ] [ BUY ] → Quantity on checkout → Delivery Address → Payment → Place Order

PRODUCT CARDS
Show Add to Cart and Buy side by side. There is no View / View Product button and no quantity or total on the listing card.

ROLE RULES
- Visitors can browse, search, and view shops. Login is required to buy or add to cart.
- Buyers can cart, checkout, favorite, rate completed orders, and edit their profile.
- Sellers can manage their own shop, products, and incoming orders.
- A seller cannot add to cart or buy their own products. Those buttons show “YOUR PRODUCT”.
- A seller can still buy from other shops.

DELIVERY ADDRESSES
Addresses are stored as structured fields (street, barangay, municipality, province), not one glued string.
Checkout shows selectable address cards, Edit Information, and Add Address.

localStorage KEYS
users, loggedInUser, products, shops, cart, orders, favorites, ratings

Logout clears only loggedInUser. Registered users, products, carts, favorites, and orders stay in the browser.

RESET DEMO DATA
In the browser console:
localStorage.clear(); location.reload();
