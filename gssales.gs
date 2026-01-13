/**
 * FASHION FIZZ BD - SALES ENGINE (ADVANCED)
 * Handles Orders, Stock Sync, and Customer Updates
 */

function soShowSalesUI() {
  const html = HtmlService.createTemplateFromFile('sales')
    .evaluate()
    .setTitle('New Sales Order')
    .setWidth(1250)
    .setHeight(800);
  SpreadsheetApp.getUi().showModalDialog(html, ' ');
}

/**
 * Fetches data for the Sales Form
 */
function getSalesStartupData() {
  return {
    customers: soGetRangeDataAsObjects('RANGECUSTOMERS') || [],
    items: soGetRangeDataAsObjects('RANGEINVENTORYITEMS') || [], 
    sales: soGetRangeDataAsObjects('RANGESO') || [],
    cities: _getUniqueDimension('City') || []
  };
}

/**
 * MASTER SAVE FUNCTION
 */
function soSaveOrder(soData, items, customer) {
  const ss = SpreadsheetApp.getActive();
  const soSheet = ss.getSheetByName('SalesOrders');
  const sdSheet = ss.getSheetByName('SalesDetails');
  
  if (!soSheet || !sdSheet) throw new Error("Critical Error: Sales sheets missing.");

  // 1. Handle Customer (Create if New)
  let custId = customer.id;
  if (customer.isNew) {
    custId = custAddNewCustomer({
      name: customer.name,
      contact: customer.contact,
      city: customer.city,
      address: customer.address
    });
  }

  // 2. Log the Main Sales Order
  // Columns: [Date, SO ID, Cust ID, Cust Name, Invoice, State, City, Total, Received, Balance, Status, Ship Status]
  soSheet.appendRow([
    new Date(), 
    soData.id, 
    custId, 
    customer.name, 
    soData.invoice, 
    customer.state || "Dhaka", // Default state if missing
    customer.city, 
    soData.totalAmount, 
    0, // Amount Received (initially 0)
    soData.totalAmount, // Balance Due
    "Unpaid", 
    "Pending"
  ]);

  // 3. Log Line Items & Update Inventory
  items.forEach(item => {
    sdSheet.appendRow([
      new Date(), 
      soData.id, 
      "SD-" + Date.now() + Math.floor(Math.random()*100), 
      custId, 
      customer.name,
      customer.state || "", 
      customer.city, 
      soData.invoice, 
      item.id, 
      item.category || "", 
      item.category || "", // Type/Cat duplicate handling
      item.subcategory || "", 
      item.name, 
      item.qty, 
      item.price, 
      item.price, // Tax Excl (simplified)
      0, // Tax Rate
      0, // Total Tax
      item.price, // Tax Incl
      item.ship, 
      item.total
    ]);
    
    // CRITICAL: Update Stock for specific size
    _syncSalesStock(item.id, item.size, item.qty);
  });

  // 4. Update Customer Stats (Total Sales & Balance)
  custUpdateCustomerFinancials(custId, soData.totalAmount);

  return { success: true, message: "Order " + soData.id + " saved successfully!" };
}

/**
 * UPDATED INVENTORY SYNC
 * Reads "S:10, L:5", subtracts QTY, saves "S:9, L:5"
 */
function _syncSalesStock(itemId, sizeSold, qtySold) {
  const sheet = SpreadsheetApp.getActive().getSheetByName('InventoryItems');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const idCol = headers.indexOf('Item ID');
  const sizeCol = headers.indexOf('Size');
  const soldCol = headers.indexOf('QTY Sold');
  const remCol = headers.indexOf('Remaining QTY');
  
  const rowIndex = data.findIndex(r => r[idCol] === itemId);
  if (rowIndex === -1) return; // Item not found
  
  const rowNum = rowIndex + 1;
  const currentSizeStr = data[rowIndex][sizeCol] || "";
  const currentSold = Number(data[rowIndex][soldCol] || 0);

  // Parse Size String
  let sizeMap = {};
  if (currentSizeStr) {
    currentSizeStr.split(',').forEach(part => {
      let [sName, sQty] = part.split(':').map(x => x.trim());
      if(sName) sizeMap[sName] = Number(sQty || 0);
    });
  }

  // Subtract Stock
  if (sizeSold && sizeMap.hasOwnProperty(sizeSold)) {
    sizeMap[sizeSold] = Math.max(0, sizeMap[sizeSold] - Number(qtySold));
  }

  // Rebuild String
  const newSizeStr = Object.keys(sizeMap)
    .map(key => `${key}:${sizeMap[key]}`)
    .join(', ');

  // Calculate new totals
  const newTotalStock = Object.values(sizeMap).reduce((a, b) => a + b, 0);

  // Update Sheet
  sheet.getRange(rowNum, sizeCol + 1).setValue(newSizeStr);
  sheet.getRange(rowNum, soldCol + 1).setValue(currentSold + Number(qtySold));
  sheet.getRange(rowNum, remCol + 1).setValue(newTotalStock);
}