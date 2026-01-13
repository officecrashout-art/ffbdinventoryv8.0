function getDashboardData() {
  const sales = soGetRangeDataAsObjects('RANGESO');
  const items = soGetRangeDataAsObjects('RANGEINVENTORYITEMS');
  const purchases = soGetRangeDataAsObjects('RANGEPO');

  const activeSales = sales.filter(s => s['SO ID'] && s['Total SO Amount'] > 0);
  const activeItems = items.filter(i => i['Item ID'] && i['Item Name']);

  // 1. Monthly Sales Trend Logic
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const salesTrend = months.map((m, i) => {
    const monthlyTotal = activeSales
      .filter(s => new Date(s['SO Date']).getMonth() === i)
      .reduce((acc, curr) => acc + (parseFloat(curr['Total SO Amount']) || 0), 0);
    return { month: m, total: monthlyTotal };
  });

  // 2. Category Distribution
  const catMap = {};
  activeItems.forEach(i => {
    const cat = i['Item Category'] || 'Uncategorized';
    catMap[cat] = (catMap[cat] || 0) + (parseFloat(i['Remaining QTY']) || 0);
  });
  const catData = Object.keys(catMap).map(k => ({ category: k, stock: catMap[k] }));

  return {
    totalSales: activeSales.reduce((acc, curr) => acc + (parseFloat(curr['Total SO Amount']) || 0), 0),
    totalPurchases: purchases.reduce((acc, curr) => acc + (parseFloat(curr['Total Amount']) || 0), 0),
    salesCount: activeSales.length,
    topItems: activeItems.sort((a, b) => (b['QTY Sold'] || 0) - (a['QTY Sold'] || 0)).slice(0, 5).map(i => ({ name: i['Item Name'], sold: i['QTY Sold'] || 0 })),
    salesTrend: salesTrend,
    categoryData: catData
  };
}