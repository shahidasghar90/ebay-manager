# eBay Business Manager

Google Apps Script admin console for running an eBay reselling/dropshipping business, bound directly to a Google Sheet as its database. Products, orders, inventory, sourcing research, accounts, and returns are all managed from one web app, with product photos stored on Google Drive.

## Stack

- **Backend:** Google Apps Script (`Code.js`), bound to a Google Sheet
- **Frontend:** HTML Service (`Index.html`, `Styles.html`, `JavaScript.html`) — vanilla JS, no build step
- **Database:** the bound Google Sheet
- **Media storage:** Google Drive, folder `eBay_Product_Images`
- **Local dev / deploy:** [`clasp`](https://github.com/google/clasp)

## Sheet tabs expected

| Tab | Purpose |
|---|---|
| `Products` | Catalogue: SKU, condition, business model, supplier, cost breakdown, pricing, profit, Drive image |
| `Orders` | eBay sales: buyer, pricing, fees, cost, profit, fulfillment status |
| `Inventory` | Stock levels, reorder alerts, dropship/virtual tracking |
| `Product_Research` | Sourcing leads and competitor links |
| `Accounts` | Income/expense ledger (EUR) |
| `Returns_Cases` | Return/refund case tracking |
| `Settings` | FX rates (EUR base) and platform fee defaults |

Row 1 of each tab is the header row — the backend maps columns to JSON by header name, so column order in the sheet must match the order each `save*` function in `Code.js` appends values in.

## Local setup

```bash
npm install -g @google/clasp
clasp login
```

Enable the Apps Script API once at https://script.google.com/home/usersettings.

This repo already has `.clasp.json` pointing at the bound script. To push local changes to the script:

```bash
clasp push
```

To publish a new web app version:

```bash
clasp deploy --description "v1.1"
clasp open --webapp
```

Use `clasp push --watch` while developing to auto-sync on save.

## Key backend functions (`Code.js`)

- `doGet()` — serves `Index.html`
- `getAppData()` — one call returning products, orders, inventory, research, accounts, returns, dashboard KPIs, and settings
- `saveProduct` / `saveOrder` / `saveInventoryItem` / `saveResearch` / `saveAccountTx` / `saveReturnCase` — append-row writers with auto-generated IDs (`EB-`, `ACC-`, `RET-`)
- `uploadImageToDrive(base64Data, filename, sku)` — decodes a base64 image, saves it to the `eBay_Product_Images` Drive folder, returns a thumbnail URL
- Cost/profit math: landed cost, eBay + payment fees, breakeven price, recommended price, net profit, margin

All `save*`/`get*` functions throw on invalid input; the frontend's `withFailureHandler` surfaces the error message as a toast.

## Frontend

Single-page layout with a sidebar (Dashboard, Products, Add Product, Orders, Product Research, Inventory, Accounts, Returns). The Add Product form shows a live profit preview (total cost, breakeven, recommended price, net profit, margin) that recalculates on every keystroke using the FX rates and fee defaults from the `Settings` tab.
