/**
 * FASHION FIZZ BD - SALES ORDERS & DETAILS MANAGER (FIXED STATUS)
 */

function sdShowUI() {
  const html = HtmlService.createTemplateFromFile('sales_details')
    .evaluate()
    .setTitle('Order Management')
    .setWidth(1300)
    .setHeight(800);
  SpreadsheetApp.getUi().showModalDialog(html, ' ');
}

/**
 * FETCH ORDERS with Strict Status Calculation
 */
function sdGetOrders(startDate, endDate) {
  const ss = SpreadsheetApp.getActive();
  const soSheet = ss.getSheetByName('SalesOrders');
  
  if (!soSheet) return { error: "SalesOrders sheet missing" };

  // Read all data
  const data = soSheet.getDataRange().getValues();
  const headers = data.shift(); // Remove header row
  
  // Map Columns
  const col = {};
  headers.forEach((h, i) => col[h.trim()] = i);

  // Helper: Parse Date
  const start = startDate ? new Date(startDate).setHours(0,0,0,0) : null;
  const end = endDate ? new Date(endDate).setHours(23,59,59,999) : null;

  const orders = data.map(r => {
    let d = r[col['SO Date']];
    if (!(d instanceof Date)) d = new Date(d);

    // --- STRICT STATUS CALCULATION ---
    const total = Number(r[col['Total SO Amount']] || 0);
    const received = Number(r[col['Total Received']] || 0);
    const balance = total - received;

    let calcStatus = "Unpaid";
    if (received >= total && total > 0) calcStatus = "Paid";
    else if (received > 0) calcStatus = "Partial";
    
    // Fallback: If received is 0, it forces "Unpaid"
    
    return {
      date: d,
      id: r[col['SO ID']],
      custName: r[col['Customer Name']],
      invoice: r[col['Invoice Num']],
      total: total,
      received: received,
      balance: balance,
      payStatus: calcStatus, // Using calculated status
      shipStatus: r[col['Shipping Status']] || 'Pending'
    };
  }).filter(o => {
    // Date Filter Logic
    if (!startDate && !endDate) return true; 
    const time = o.date.getTime();
    if (start && time < start) return false;
    if (end && time > end) return false;
    return true;
  });

  // Sort: Newest First
  return orders.sort((a,b) => b.date - a.date);
}

/**
 * FETCH ITEMS for Order Details
 */
function sdGetOrderItems(soId) {
  const ss = SpreadsheetApp.getActive();
  const sdSheet = ss.getSheetByName('SalesDetails'); 
  const data = sdSheet.getDataRange().getValues();
  const headers = data.shift();
  
  const idCol = headers.indexOf('SO ID');
  const nameCol = headers.indexOf('Item Name');
  // Check both 'Size' and 'Item Subcategory' just in case
  const sizeCol = headers.indexOf('Size') > -1 ? headers.indexOf('Size') : headers.indexOf('Item Subcategory');
  const qtyCol = headers.indexOf('QTY Sold');
  const priceCol = headers.indexOf('Total Sales Price');

  return data.filter(r => r[idCol] === soId).map(r => ({
    name: r[nameCol],
    size: r[sizeCol] || '-',
    qty: r[qtyCol],
    total: r[priceCol]
  }));
}

/**
 * UPDATE STATUS
 */
function sdUpdateStatus(soId, newPayStatus, newShipStatus) {
  const ss = SpreadsheetApp.getActive();
  const soSheet = ss.getSheetByName('SalesOrders');
  const data = soSheet.getDataRange().getValues();
  const headers = data[0];
  
  const idCol = headers.indexOf('SO ID');
  const payCol = headers.indexOf('Receipt Status');
  const shipCol = headers.indexOf('Shipping Status');
  
  const rowIdx = data.findIndex(r => r[idCol] === soId);
  
  if (rowIdx > 0) {
    const row = rowIdx + 1;
    if (newPayStatus) soSheet.getRange(row, payCol + 1).setValue(newPayStatus);
    if (newShipStatus) soSheet.getRange(row, shipCol + 1).setValue(newShipStatus);
    return { success: true };
  }
  throw new Error("Order ID not found");
}