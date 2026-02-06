const API_BASE = 'http://localhost:5000/api';

let token = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user') || 'null');

if (!token || !currentUser || currentUser.role !== 'admin') {
  currentUser = { name: 'Admin', role: 'admin' };
  localStorage.setItem('user', JSON.stringify(currentUser));
}

const STORAGE_KEYS = {
  inventory: 'admin_inventory_catalog',
  rewards: 'admin_reward_catalog'
};

const DEFAULT_INVENTORY = [
  { id: 'p1', name: 'Premium Organic Compost', category: 'premium', pricePerKg: 30, stock: 850, image: 'images/compost.jpg' },
  { id: 'p2', name: 'Vegetable Waste Compost', category: 'vegetable', pricePerKg: 28, stock: 1200, image: 'images/compost.jpg' },
  { id: 'p3', name: 'Enriched Garden Compost', category: 'garden', pricePerKg: 35, stock: 450, image: 'images/compost.jpg' }
];

const DEFAULT_REWARDS = [
  { id: 'r1', title: '₹50 Grocery Voucher', points: 500, description: 'Redeem for daily essentials from partner stores.', image: 'images/hero-image.jpg' },
  { id: 'r2', title: '₹100 Restaurant Discount', points: 800, description: 'Enjoy meals while supporting waste conscious kitchens.', image: 'images/hero-image1.jpg' },
  { id: 'r3', title: 'Free Compost Kit', points: 1000, description: 'Starter kit to help households begin composting.', image: 'images/compost.jpg' }
];

const state = {
  pickups: [],
  orders: [],
  inventory: [],
  rewards: [],
  stock: { available: 0, pricePerKg: 0 }
};
document.addEventListener('DOMContentLoaded', async () => {
    // Check if Leaflet is available
    if (typeof L === 'undefined') {
        console.error('❌ Leaflet library failed to load!');
    } else {
        console.log('✅ Leaflet loaded successfully');
    }

    // Validate admin authentication
    const isValid = await validateAdminAuth();
    if (!isValid) return;

    // Continue with initialization
    await initAdminDashboard();
});
async function validateAdminAuth() {
  if (!token || !currentUser) {
    console.error('❌ No token or user found');
    alert('Please login as admin');
    window.location.href = 'index.html';
    return false;
  }

  // Verify token is still valid
  try {
    const res = await fetch(`${API_BASE}/users/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      throw new Error('Token invalid');
    }

    const userData = await res.json();
    
    if (userData.role !== 'admin') {
      console.error('❌ User is not admin:', userData.role);
      alert('Admin access required');
      window.location.href = 'index.html';
      return false;
    }

    // Update local user data
    currentUser = userData;
    localStorage.setItem('user', JSON.stringify(currentUser));
    
    console.log('✅ Admin authentication validated');
    return true;

  } catch (error) {
    console.error('❌ Auth validation failed:', error);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    alert('Session expired. Please login again.');
    window.location.href = 'index.html';
    return false;
  }
}

// ✅ Call validation before initializing dashboard
async function initAdminDashboard() {
  const isValid = await validateAdminAuth();
  if (!isValid) return;

  ensureAdminUI();
  setupNavigation();
  setupFilters();
  setupForms();

  await Promise.all([
    refreshStock(), 
    refreshPickups(), 
    refreshOrders(), 
    refreshInventory(), 
    refreshRewards()
  ]);
  
  updateDashboardMetrics();
  showSection('dashboard');
}

function loadInventoryFromStorage() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.inventory) || 'null');
    if (Array.isArray(stored) && stored.length) {
      return stored;
    }
  } catch (_) {}
  localStorage.setItem(STORAGE_KEYS.inventory, JSON.stringify(DEFAULT_INVENTORY));
  return [...DEFAULT_INVENTORY];
}

function loadRewardsFromStorage() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.rewards) || 'null');
    if (Array.isArray(stored) && stored.length) {
      return stored;
    }
  } catch (_) {}
  localStorage.setItem(STORAGE_KEYS.rewards, JSON.stringify(DEFAULT_REWARDS));
  return [...DEFAULT_REWARDS];
}

async function refreshInventory() {
  try {
    const res = await fetch(`${API_BASE}/inventory`);
    if (!res.ok) throw new Error('failed');
    const items = await res.json();
    state.inventory = (Array.isArray(items) ? items : []).map((it) => ({
      id: it._id || it.id,
      name: it.name,
      category: it.category,
      pricePerKg: Number(it.pricePerKg || 0),
      stock: Number(it.stock || 0),
      image: it.image || ''
    }));
  } catch (_) {
    state.inventory = loadInventoryFromStorage();
  }
  renderInventoryList();
}

async function refreshRewards() {
  try {
    const res = await fetch(`${API_BASE}/rewards`);
    if (!res.ok) throw new Error('failed');
    const items = await res.json();
    state.rewards = (Array.isArray(items) ? items : []).map((rw) => ({
      id: rw._id || rw.id,
      title: rw.title,
      points: Number(rw.points || 0),
      description: rw.description || '',
      image: rw.image || ''
    }));
  } catch (_) {
    state.rewards = loadRewardsFromStorage();
  }
  renderRewardList();
  updateDashboardMetrics();
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) {
    alert(message);
    return;
  }
  const el = document.createElement('div');
  el.className = `toast ${type === 'error' ? 'error' : 'success'}`;
  el.innerHTML = `<span style="font-weight:700;font-size:20px;">${type === 'error' ? '✕' : '✓'}</span><span>${message}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => el.remove(), 300);
  }, 2800);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function formatDate(date) {
  if (!date) return '--';
  try {
    return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch (_) {
    return date;
  }
}

function formatDateShort(date) {
  if (!date) return '--';
  try {
    return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  } catch (_) {
    return date;
  }
}

function formatKg(value) {
  const v = Number(value || 0);
  return `${v.toLocaleString('en-IN')} kg`;
}

function formatCurrency(value) {
  const v = Number(value || 0);
  if (!v) return '₹0';
  return `₹${v.toLocaleString('en-IN')}`;
}

function statusLabel(status) {
  if (!status) return '—';
  return status.replace(/-/g, ' ');
}

function ensureAdminUI() {
  setText('userName', currentUser.name || 'Admin');
  const initial = (currentUser.name || 'Admin').charAt(0).toUpperCase();
  setText('userInitial', initial);
}

function showSection(sectionName) {
  document.querySelectorAll('.section').forEach((section) => {
    section.classList.toggle('active', section.id === `${sectionName}-section`);
  });
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('active', link.getAttribute('data-section') === sectionName);
  });
}

function setupNavigation() {
  document.querySelectorAll('.nav-link[data-section]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const section = link.getAttribute('data-section');
      if (section) showSection(section);
    });
  });
}

function setupFilters() {
  const pickupFilter = document.getElementById('pickupStatusFilter');
  const pickupSearch = document.getElementById('pickupSearchInput');
  const orderFilter = document.getElementById('orderStatusFilter');
  const orderSearch = document.getElementById('orderSearchInput');
  const inventorySearch = document.getElementById('inventorySearchInput');

  if (pickupFilter) pickupFilter.addEventListener('change', renderPickupTable);
  if (pickupSearch) pickupSearch.addEventListener('input', renderPickupTable);
  if (orderFilter) orderFilter.addEventListener('change', renderOrderTable);
  if (orderSearch) orderSearch.addEventListener('input', renderOrderTable);
  if (inventorySearch) inventorySearch.addEventListener('input', renderInventoryList);
}

function setupForms() {
  const stockForm = document.getElementById('stockForm');
  if (stockForm) {
    stockForm.addEventListener('submit', handleStockUpdate);
  }

  const inventoryForm = document.getElementById('inventoryForm');
  if (inventoryForm) {
    inventoryForm.addEventListener('submit', handleInventorySave);
  }

  const rewardForm = document.getElementById('rewardForm');
  if (rewardForm) {
    rewardForm.addEventListener('submit', handleRewardSave);
  }
}

async function initAdminDashboard() {
  ensureAdminUI();
  setupNavigation();
  setupFilters();
  setupForms();

  await Promise.all([refreshStock(), refreshPickups(), refreshOrders(), refreshInventory(), refreshRewards()]);
  updateDashboardMetrics();
  showSection('dashboard');
}

function normalisePickup(pickup) {
  const status = (pickup.status || 'pending').toLowerCase();
  return {
    _id: pickup._id || pickup.id || `${Math.random()}`,
    household: pickup.userId?.name || pickup.household || 'Household',
    phone: pickup.userId?.phone || pickup.phone || '',
    wasteType: pickup.wasteType || 'Mixed Organic Waste',
    quantity: Number(pickup.quantity || 0),
    status,
    pickupDate: pickup.pickupDate,
    pickupTime: pickup.pickupTime,
    address: pickup.address || '--',
    requestDate: pickup.requestDate || new Date().toISOString(),
    pointsAwarded: pickup.pointsAwarded || 0
  };
}

function getDemoPickups() {
  const today = new Date();
  return [
    {
      _id: 'demo-p1',
      household: 'Household Alpha',
      phone: '+91 90000 11111',
      wasteType: 'Kitchen Waste',
      quantity: 3.5,
      status: 'pending',
      pickupDate: formatDate(today.toISOString()),
      pickupTime: '09:00-12:00',
      address: 'Block A, Green Residency',
      requestDate: today.toISOString()
    },
    {
      _id: 'demo-p2',
      household: 'Household Beta',
      phone: '+91 90000 22222',
      wasteType: 'Fruit Waste',
      quantity: 2.1,
      status: 'picked',
      pickupDate: formatDate(new Date(today.getTime() - 86400000).toISOString()),
      pickupTime: '12:00-15:00',
      address: 'Lake View Apartments',
      requestDate: new Date(today.getTime() - 86400000).toISOString()
    },
    {
      _id: 'demo-p3',
      household: 'Household Gamma',
      phone: '+91 90000 33333',
      wasteType: 'Mixed Organic',
      quantity: 4.8,
      status: 'completed',
      pickupDate: formatDate(new Date(today.getTime() - 172800000).toISOString()),
      pickupTime: '15:00-18:00',
      address: 'Sunrise Villas',
      pointsAwarded: 10,
      requestDate: new Date(today.getTime() - 172800000).toISOString()
    }
  ].map(normalisePickup);
}

async function refreshPickups() {
  try {
    if (!token) throw new Error('demo');
    const res = await fetch(`${API_BASE}/pickup/all`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('request failed');
    const raw = await res.json();
    state.pickups = Array.isArray(raw) ? raw.map(normalisePickup) : [];
  } catch (_) {
    state.pickups = getDemoPickups();
  }
  renderPickupTable();
  renderPickupSnapshot();
  updatePickupMetrics();
}

function normaliseOrder(order) {
  const status = (order.status || 'pending').toLowerCase();
  return {
    _id: order._id || order.id || `${Math.random()}`,
    orderNumber: order.orderNumber || `ORD-${(order._id || order.id || '').toString().slice(-6).toUpperCase() || 'DEMO'}`,
    farmerName: order.farmerId?.name || order.farmerName || 'Farmer',
    farmerPhone: order.farmerId?.phone || order.farmerPhone || '',
    compostName: order.compostName || order.productName || 'Organic Compost',  // ✅ ADD THIS
    quantity: Number(order.quantity || 0),
    pricePerKg: Number(order.pricePerKg || 0),
    totalAmount: Number(order.totalAmount || 0),
    status,
    deliveryAddress: order.deliveryAddress || 'Not provided',
    createdAt: order.createdAt || new Date().toISOString()
  };
}

function getDemoOrders() {
  const now = new Date();
  return [
    {
      _id: 'demo-o1',
      orderNumber: 'ORD-001',
      farmerName: 'Farmer Xavier',
      farmerPhone: '+91 98888 11111',
      compostName: 'Premium Organic Compost',  // ✅ ADD THIS
      quantity: 50,
      pricePerKg: 32,
      totalAmount: 1600,
      status: 'pending',
      deliveryAddress: 'Plot 23, Village Road',
      createdAt: now.toISOString()
    },
    {
      _id: 'demo-o2',
      orderNumber: 'ORD-002',
      farmerName: 'Farmer Yara',
      farmerPhone: '+91 97777 22222',
      compostName: 'Vegetable Waste Compost',  // ✅ ADD THIS
      quantity: 75,
      pricePerKg: 30,
      totalAmount: 2250,
      status: 'confirmed',
      deliveryAddress: 'Farm Lane 2',
      createdAt: new Date(now.getTime() - 86400000).toISOString()
    },
    {
      _id: 'demo-o3',
      orderNumber: 'ORD-003',
      farmerName: 'Farmer Zed',
      farmerPhone: '+91 96666 33333',
      compostName: 'Enriched Garden Compost',  // ✅ ADD THIS
      quantity: 40,
      pricePerKg: 28,
      totalAmount: 1120,
      status: 'in-transit',
      deliveryAddress: 'Organic Valley, Sector 6',
      createdAt: new Date(now.getTime() - 172800000).toISOString()
    }
  ].map(normaliseOrder);
}

async function refreshOrders() {
  try {
    if (!token) throw new Error('demo');
    const res = await fetch(`${API_BASE}/order/all`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('request failed');
    const raw = await res.json();
    state.orders = Array.isArray(raw) ? raw.map(normaliseOrder) : [];
  } catch (_) {
    state.orders = getDemoOrders();
  }
  renderOrderTable();
  renderOrderSnapshot();
  updateOrderMetrics();
}

async function refreshStock() {
  try {
    const res = await fetch(`${API_BASE}/compost/stock`);
    if (!res.ok) throw new Error('request failed');
    const data = await res.json();
    state.stock = {
      available: Number(data.available || 0),
      pricePerKg: Number(data.pricePerKg || 0)
    };
  } catch (_) {
    state.stock = { available: 320, pricePerKg: 32 };
  }
  setText('availableStock', state.stock.available.toLocaleString('en-IN'));
  setText('pricePerKg', Number(state.stock.pricePerKg || 0).toFixed(2));
  setText('metricStockKg', state.stock.available.toLocaleString('en-IN'));
  setText('metricStockPrice', Number(state.stock.pricePerKg || 0).toFixed(2));
}

function renderPickupTable() {
  const tbody = document.getElementById('pickupTableBody');
  if (!tbody) return;
  const filtered = filterPickups();
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state">No pickup requests found</div></td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .sort((a, b) => new Date(b.requestDate) - new Date(a.requestDate))
    .map((pickup) => {
      const pickupWindow = pickup.pickupDate ? `${pickup.pickupDate}${pickup.pickupTime ? ` • ${pickup.pickupTime}` : ''}` : '—';
      return `
        <tr>
          <td>
            <div style="font-weight:700;">${pickup.household}</div>
            <div class="muted" style="font-size:12px;">${pickup.phone || ''}</div>
          </td>
          <td>${pickup.wasteType}</td>
          <td>${formatKg(pickup.quantity)}</td>
          <td>${pickup.address || '--'}</td>
          <td>${pickupWindow}</td>
          <td><span class="badge ${pickup.status}">${statusLabel(pickup.status)}</span></td>
          <td>
            <div class="action-buttons">
              ${pickupActionButtons(pickup)}
            </div>
          </td>
        </tr>
      `;
    }).join('');
}

function pickupActionButtons(pickup) {
  const actions = [];
  if (pickup.status === 'pending') {
    actions.push(`<button class="btn-success" onclick="handlePickupStatus('${pickup._id}','picked')">Approve</button>`);
    actions.push(`<button class="btn-warning" onclick="handlePickupStatus('${pickup._id}','pending')">Keep Pending</button>`);
    actions.push(`<button class="btn-danger" onclick="handlePickupStatus('${pickup._id}','rejected')">Reject</button>`);
  } else if (pickup.status === 'picked' || pickup.status === 'processing') {
    actions.push(`<button class="btn-success" onclick="handlePickupStatus('${pickup._id}','completed')">Mark Completed</button>`);
    actions.push(`<button class="btn-ghost" onclick="handlePickupStatus('${pickup._id}','pending')">Set Pending</button>`);
  } else if (pickup.status === 'rejected') {
    actions.push(`<button class="btn-ghost" onclick="handlePickupStatus('${pickup._id}','pending')">Reopen</button>`);
  }
  return actions.join('');
}

function filterPickups() {
  const statusFilter = (document.getElementById('pickupStatusFilter')?.value || '').toLowerCase();
  const query = (document.getElementById('pickupSearchInput')?.value || '').toLowerCase().trim();
  return state.pickups.filter((pickup) => {
    const matchesStatus = !statusFilter || pickup.status === statusFilter;
    const matchesQuery = !query || [pickup.household, pickup.phone, pickup.wasteType].some((field) => (field || '').toLowerCase().includes(query));
    return matchesStatus && matchesQuery;
  });
}

function renderPickupSnapshot() {
  const container = document.getElementById('dashboardRecentPickups');
  if (!container) return;
  if (!state.pickups.length) {
    container.innerHTML = '<div class="empty-state">No pickups logged yet</div>';
    return;
  }
  const latest = [...state.pickups]
    .sort((a, b) => new Date(b.requestDate) - new Date(a.requestDate))
    .slice(0, 3);
  container.innerHTML = latest.map((pickup) => `
    <div class="pickup-item">
      <div class="pickup-details">
        <div class="pickup-description">${pickup.household}</div>
        <div class="pickup-meta">${formatDateShort(pickup.requestDate)} • ${formatKg(pickup.quantity)}</div>
      </div>
      <span class="badge ${pickup.status}">${statusLabel(pickup.status)}</span>
    </div>
  `).join('');
}

function updatePickupMetrics() {
  const total = state.pickups.length;
  const pending = state.pickups.filter((p) => p.status === 'pending').length;
  setText('metricTotalPickups', total);
  setText('metricPendingPickups', `${pending} pending`);
}

function renderOrderTable() {
  const tbody = document.getElementById('orderTableBody');
  if (!tbody) return;

  const filtered = filterOrders();

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state">No orders found</div></td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(order => `
      <tr>
        <!-- ORDER -->
        <td>
          <div style="font-weight:700;">${order.orderNumber}</div>
          <div class="muted" style="font-size:12px;">${formatDate(order.createdAt)}</div>
        </td>

        <!-- FARMER -->
        <td>
          <div style="font-weight:600;">${order.farmerName}</div>
          <div class="muted" style="font-size:12px;">${order.farmerPhone || ''}</div>
        </td>

        <!-- COMPOST TYPE -->
        <td>${order.compostName || '—'}</td>

        <!-- QUANTITY -->
        <td>${formatKg(order.quantity)}</td>

        <!-- PRICE -->
        <td>
          <div>${formatCurrency(order.pricePerKg || 0)}/kg</div>
          <div class="muted" style="font-size:12px;">Total: ${formatCurrency(order.totalAmount || 0)}</div>
        </td>

        <!-- ADDRESS -->
        <td>${order.deliveryAddress || 'No address'}</td>

        <!-- STATUS -->
        <td><span class="badge ${order.status}">${statusLabel(order.status)}</span></td>

        <!-- ACTIONS -->
        <td>
          <div class="action-buttons">
            ${orderActionButtons(order)}
          </div>
        </td>
      </tr>
    `)
    .join('');
}


function orderActionButtons(order) {
  const actions = [];
  if (order.status === 'pending') {
    actions.push(`<button class="btn-success" onclick="handleOrderStatus('${order._id}','confirmed')">Approve</button>`);
    actions.push(`<button class="btn-danger" onclick="handleOrderStatus('${order._id}','rejected')">Reject</button>`);
  } else if (order.status === 'confirmed') {
    actions.push(`<button class="btn-warning" onclick="handleOrderStatus('${order._id}','in-transit')">Start Transit</button>`);
    actions.push(`<button class="btn-success" onclick="handleOrderStatus('${order._id}','delivered')">Mark Delivered</button>`);
  } else if (order.status === 'in-transit') {
    actions.push(`<button class="btn-success" onclick="handleOrderStatus('${order._id}','delivered')">Mark Delivered</button>`);
  } else if (order.status === 'rejected') {
    actions.push(`<button class="btn-ghost" onclick="handleOrderStatus('${order._id}','pending')">Reopen</button>`);
  }
  return actions.join('');
}

function filterOrders() {
  const statusFilter = (document.getElementById('orderStatusFilter')?.value || '').toLowerCase();
  const query = (document.getElementById('orderSearchInput')?.value || '').toLowerCase().trim();
  return state.orders.filter((order) => {
    const matchesStatus = !statusFilter || order.status === statusFilter;
    const matchesQuery = !query || [order.orderNumber, order.farmerName, order.farmerPhone].some((field) => (field || '').toLowerCase().includes(query));
    return matchesStatus && matchesQuery;
  });
}

function renderOrderSnapshot() {
  const container = document.getElementById('dashboardRecentOrders');
  if (!container) return;
  if (!state.orders.length) {
    container.innerHTML = '<div class="empty-state">No recent orders</div>';
    return;
  }
  const latest = [...state.orders]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 3);
  container.innerHTML = latest.map((order) => `
    <div class="order-item">
      <div class="order-item-left">
        <div class="order-icon ${order.status}">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <div>
          <div style="font-weight:700;">${order.orderNumber}</div>
          <div class="order-meta">${order.farmerName} • ${formatKg(order.quantity)}</div>
        </div>
      </div>
      <div style="text-align:right;">
        <div class="badge ${order.status}">${statusLabel(order.status)}</div>
        <div style="color:#16a34a;font-weight:700;margin-top:8px;">${formatCurrency(order.totalAmount)}</div>
      </div>
    </div>
  `).join('');
}

function updateOrderMetrics() {
  const activeStatuses = ['pending', 'confirmed', 'in-transit'];
  const active = state.orders.filter((order) => activeStatuses.includes(order.status)).length;
  const pending = state.orders.filter((order) => order.status === 'pending').length;
  const transit = state.orders.filter((order) => order.status === 'in-transit').length;
  setText('metricActiveOrders', active);
  setText('metricOrderBreakdown', `${pending} pending • ${transit} in transit`);
}

function renderInventoryList() {
  const container = document.getElementById('inventoryList');
  if (!container) return;
  const query = (document.getElementById('inventorySearchInput')?.value || '').toLowerCase().trim();
  const filtered = state.inventory.filter((item) => {
    if (!query) return true;
    return [item.name, item.category].some((field) => (field || '').toLowerCase().includes(query));
  });
  if (!filtered.length) {
    container.innerHTML = '<div class="empty-state">No compost varieties found. Add one above.</div>';
    return;
  }
  container.innerHTML = filtered.map((item) => `
    <div class="card-item">
      ${item.image ? `<img src="${item.image}" alt="${item.name}" onerror="this.style.display='none';">` : ''}
      <div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
          <div>
            <h3 style="margin:0;">${item.name}</h3>
            <p style="margin:4px 0 0 0;color:#64748b;font-size:13px;">Category: ${item.category || 'general'}</p>
          </div>
          <span class="badge confirmed">${formatCurrency(item.pricePerKg)}/kg</span>
        </div>
        <div style="margin-top:12px;color:#475569;font-weight:600;">${formatKg(item.stock)} available</div>
      </div>
      <div class="action-buttons" style="margin-top:auto;">
        <button class="btn-ghost" onclick="removeInventoryItem('${item.id}')">Remove</button>
      </div>
    </div>
  `).join('');
}

function renderRewardList() {
  const container = document.getElementById('rewardList');
  if (!container) return;
  if (!state.rewards.length) {
    container.innerHTML = '<div class="empty-state">No rewards configured yet.</div>';
    return;
  }
  container.innerHTML = state.rewards.map((reward) => `
    <div class="card-item">
      ${reward.image ? `<img src="${reward.image}" alt="${reward.title}" onerror="this.style.display='none';">` : ''}
      <div>
        <h3 style="margin:0;">${reward.title}</h3>
        <p style="margin:6px 0 0 0;color:#64748b;font-size:13px;">${reward.description || 'Reward redemption item for participants.'}</p>
      </div>
      <div style="font-weight:700;color:#16a34a;">${reward.points} pts</div>
      <div class="action-buttons" style="margin-top:auto;">
        <button class="btn-ghost" onclick="removeRewardItem('${reward.id}')">Remove</button>
      </div>
    </div>
  `).join('');
  setText('metricRewardItems', state.rewards.length);
}

function updateDashboardMetrics() {
  updatePickupMetrics();
  updateOrderMetrics();
  setText('metricRewardItems', state.rewards.length);
  setText('metricStockKg', state.stock.available.toLocaleString('en-IN'));
  setText('metricStockPrice', Number(state.stock.pricePerKg || 0).toFixed(2));
}

async function handlePickupStatus(pickupId, status) {
  await updatePickupStatus(pickupId, status);
}

async function updatePickupStatus(pickupId, status) {
  try {
    if (!token) throw new Error('demo');
    const res = await fetch(`${API_BASE}/pickup/${pickupId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update pickup');
    if (data.pickup) {
      const updated = normalisePickup(data.pickup);
      const idx = state.pickups.findIndex((p) => p._id === updated._id);
      if (idx !== -1) {
        state.pickups[idx] = updated;
      } else {
        state.pickups.push(updated);
      }
    } else {
      const idx = state.pickups.findIndex((p) => p._id === pickupId);
      if (idx !== -1) state.pickups[idx].status = status;
    }
    showToast(data.message || `Pickup status updated to ${statusLabel(status)}`);
  } catch (error) {
    const idx = state.pickups.findIndex((p) => p._id === pickupId);
    if (idx !== -1) state.pickups[idx].status = status;
    showToast(`${statusLabel(status)} (demo)`, 'success');
  }
  renderPickupTable();
  renderPickupSnapshot();
  updatePickupMetrics();
}

async function handleOrderStatus(orderId, status) {
  await updateOrderStatus(orderId, status);
}

async function updateOrderStatus(orderId, status) {
  try {
    if (!token) throw new Error('demo');
    const res = await fetch(`${API_BASE}/order/${orderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update order');
    if (data.order) {
      const updated = normaliseOrder(data.order);
      const idx = state.orders.findIndex((o) => o._id === updated._id);
      if (idx !== -1) {
        state.orders[idx] = updated;
      } else {
        state.orders.push(updated);
      }
    } else {
      const idx = state.orders.findIndex((o) => o._id === orderId);
      if (idx !== -1) state.orders[idx].status = status;
    }
    showToast(data.message || `Order ${statusLabel(status)}`);
    await refreshStock();
  } catch (error) {
    const idx = state.orders.findIndex((o) => o._id === orderId);
    if (idx !== -1) state.orders[idx].status = status;
    showToast(`Order ${statusLabel(status)} (demo)`, 'success');
  }
  renderOrderTable();
  renderOrderSnapshot();
  updateOrderMetrics();
}

async function handleStockUpdate(event) {
  event.preventDefault();
  const stockInput = document.getElementById('newStock');
  const priceInput = document.getElementById('newPrice');
  const payload = {};
  if (stockInput?.value) payload.available = Number(stockInput.value);
  if (priceInput?.value) payload.pricePerKg = Number(priceInput.value);

  if (!Object.keys(payload).length) {
    showToast('Enter stock or price to update', 'error');
    return;
  }

  let shouldRefresh = true;
  try {
    if (!token) throw new Error('demo');
    const res = await fetch(`${API_BASE}/compost/stock`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update stock');
    showToast(data.message || 'Stock updated');
  } catch (error) {
    showToast('Stock updated (demo)', 'success');
    state.stock.available = payload.available ?? state.stock.available;
    state.stock.pricePerKg = payload.pricePerKg ?? state.stock.pricePerKg;
    setText('availableStock', state.stock.available.toLocaleString('en-IN'));
    setText('pricePerKg', Number(state.stock.pricePerKg || 0).toFixed(2));
    shouldRefresh = false;
  }

  if (event.target) event.target.reset();
  if (shouldRefresh) {
    await refreshStock();
  }
  updateDashboardMetrics();
}

function handleCompostImageChange(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const imageUrl = e.target.result;
    document.getElementById('compostImageUrl').value = imageUrl;
    const preview = document.getElementById('compostImagePreview');
    if (preview) {
      preview.innerHTML = `<img src="${imageUrl}" alt="Preview" style="max-width:200px;max-height:150px;border-radius:8px;margin-top:8px;">`;
    }
  };
  reader.readAsDataURL(file);
}

async function handleInventorySave(event) {
  event.preventDefault();
  const name = document.getElementById('compostName')?.value.trim();
  const category = document.getElementById('compostCategory')?.value.trim() || 'general';
  const price = Number(document.getElementById('compostPrice')?.value || 0);
  const stock = Number(document.getElementById('compostStock')?.value || 0);
  const image = document.getElementById('compostImageUrl')?.value.trim() || document.getElementById('compostImage')?.value.trim();

  if (!name || !price || !stock) {
    showToast('Fill name, price and stock to add compost', 'error');
    return;
  }

  const existing = state.inventory.find((item) => item.name.toLowerCase() === name.toLowerCase());
  try {
    if (!token) throw new Error('no-token');
    if (existing && existing.id && !String(existing.id).startsWith('compost-')) {
      const res = await fetch(`${API_BASE}/inventory/${existing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, category, pricePerKg: price, stock, image: image || '' })
      });
      const saved = await res.json();
      if (!res.ok) throw new Error(saved.message || 'Update failed');
      showToast('Compost updated');
    } else {
      const res = await fetch(`${API_BASE}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, category, pricePerKg: price, stock, image: image || '' })
      });
      const saved = await res.json();
      if (!res.ok) throw new Error(saved.message || 'Create failed');
      showToast('Compost added');
    }
  } catch (_) {
    // fallback to local
    if (existing) {
      existing.category = category;
      existing.pricePerKg = price;
      existing.stock = stock;
      if (image) existing.image = image;
      showToast('Compost updated (local)');
    } else {
      state.inventory.unshift({ id: `compost-${Date.now()}`, name, category, pricePerKg: price, stock, image: image || '' });
      showToast('Compost added (local)');
    }
    localStorage.setItem(STORAGE_KEYS.inventory, JSON.stringify(state.inventory));
  }
  event.target.reset();
  const preview = document.getElementById('compostImagePreview');
  if (preview) preview.innerHTML = '';
  document.getElementById('compostImageUrl').value = '';
  await refreshInventory();
  
  // Trigger events for inventory updates
  window.dispatchEvent(new StorageEvent('storage', {
    key: 'admin_inventory_catalog',
    newValue: JSON.stringify(state.inventory)
  }));
  window.dispatchEvent(new CustomEvent('inventoryUpdated', {
    detail: { inventory: state.inventory }
  }));
}

function handleRewardImageChange(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const imageUrl = e.target.result;
    document.getElementById('rewardImageUrl').value = imageUrl;
    const preview = document.getElementById('rewardImagePreview');
    if (preview) {
      preview.innerHTML = `<img src="${imageUrl}" alt="Preview" style="max-width:200px;max-height:150px;border-radius:8px;margin-top:8px;">`;
    }
  };
  reader.readAsDataURL(file);
}

async function handleRewardSave(event) {
  event.preventDefault();
  const title = document.getElementById('rewardTitle')?.value.trim();
  const points = Number(document.getElementById('rewardPoints')?.value || 0);
  const description = document.getElementById('rewardDescription')?.value.trim();
  const image = document.getElementById('rewardImageUrl')?.value.trim() || document.getElementById('rewardImage')?.value.trim();

  if (!title || !points) {
    showToast('Fill title and points to add reward', 'error');
    return;
  }

  const existing = state.rewards.find((reward) => reward.title.toLowerCase() === title.toLowerCase());
  try {
    if (!token) throw new Error('no-token');
    if (existing && existing.id && !String(existing.id).startsWith('reward-')) {
      const res = await fetch(`${API_BASE}/rewards/${existing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, points, description, image: image || '' })
      });
      const saved = await res.json();
      if (!res.ok) throw new Error(saved.message || 'Update failed');
      showToast('Reward updated');
    } else {
      const res = await fetch(`${API_BASE}/rewards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, points, description, image: image || '' })
      });
      const saved = await res.json();
      if (!res.ok) throw new Error(saved.message || 'Create failed');
      showToast('Reward added');
    }
  } catch (_) {
    // fallback to local
    if (existing) {
      existing.points = points;
      existing.description = description;
      if (image) existing.image = image;
      showToast('Reward updated (local)');
    } else {
      state.rewards.unshift({ id: `reward-${Date.now()}`, title, points, description, image: image || '' });
      showToast('Reward added (local)');
    }
    localStorage.setItem(STORAGE_KEYS.rewards, JSON.stringify(state.rewards));
  }
  event.target.reset();
  const preview = document.getElementById('rewardImagePreview');
  if (preview) preview.innerHTML = '';
  document.getElementById('rewardImageUrl').value = '';
  await refreshRewards();
  
  // Trigger storage event for other tabs/windows and custom event for same window
  window.dispatchEvent(new StorageEvent('storage', {
    key: 'admin_reward_catalog',
    newValue: JSON.stringify(state.rewards)
  }));
  
  // Also dispatch custom event for same-window listeners
  window.dispatchEvent(new CustomEvent('rewardsUpdated', {
    detail: { rewards: state.rewards }
  }));
}

async function removeInventoryItem(id) {
  try {
    if (!token) throw new Error('no-token');
    const res = await fetch(`${API_BASE}/inventory/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Delete failed');
    showToast('Compost removed');
  } catch (_) {
    state.inventory = state.inventory.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEYS.inventory, JSON.stringify(state.inventory));
    showToast('Compost removed (local)');
  }
  await refreshInventory();
  
  // Trigger events for inventory updates
  window.dispatchEvent(new StorageEvent('storage', {
    key: 'admin_inventory_catalog',
    newValue: JSON.stringify(state.inventory)
  }));
  window.dispatchEvent(new CustomEvent('inventoryUpdated', {
    detail: { inventory: state.inventory }
  }));
}

async function removeRewardItem(id) {
  try {
    if (!token) throw new Error('no-token');
    const res = await fetch(`${API_BASE}/rewards/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Delete failed');
    showToast('Reward removed');
  } catch (_) {
    state.rewards = state.rewards.filter((reward) => reward.id !== id);
    localStorage.setItem(STORAGE_KEYS.rewards, JSON.stringify(state.rewards));
    showToast('Reward removed (local)');
  }
  await refreshRewards();
  
  // Trigger events for reward updates
  window.dispatchEvent(new StorageEvent('storage', {
    key: 'admin_reward_catalog',
    newValue: JSON.stringify(state.rewards)
  }));
  window.dispatchEvent(new CustomEvent('rewardsUpdated', {
    detail: { rewards: state.rewards }
  }));
}


///////////////////////////// Route Optimisation/////////////////
// ============================================
// UNIFIED ROUTE PLANNING (PICKUP & DELIVERY)
// ============================================

let routeMap;
let routeMarkers = [];
let routeLine;
let currentRouteType = 'pickup'; // 'pickup' or 'delivery'
let pickupLocations = [];
let deliveryLocations = [];
let optimizedRouteData = null;

// Switch between pickup and delivery routes
function switchRouteType(type) {
  currentRouteType = type;
  
  // Update toggle buttons
  document.querySelectorAll('.route-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-type') === type);
  });
  
  // Update UI labels
  if (type === 'pickup') {
    document.getElementById('routeSequenceTitle').textContent = 'Pickup Sequence';
    document.getElementById('routeMetricLabel').textContent = 'Time Saved';
  } else {
    document.getElementById('routeSequenceTitle').textContent = 'Delivery Sequence';
    document.getElementById('routeMetricLabel').textContent = 'Total Load';
  }
  
  // Clear current route and reload data
  clearCurrentRoute();
  loadCurrentRouteData();
  
  console.log(`✅ Switched to ${type} routes`);
}

// Load data based on current route type
async function loadCurrentRouteData() {
  if (currentRouteType === 'pickup') {
    await loadPickupsForRouting();
  } else {
    await loadDeliveriesForRouting();
  }
}

// Initialize route map
function initRouteMap() {
  if (routeMap) return;

  if (typeof L === 'undefined') {
    console.log('⏳ Waiting for Leaflet to load...');
    setTimeout(initRouteMap, 500);
    return;
  }

  routeMap = L.map('routeMap').setView([12.2958, 76.6394], 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(routeMap);

  console.log('✅ Route map initialized');
  loadCurrentRouteData();
}

// Load pickups for routing
async function loadPickupsForRouting() {
  const overlay = document.getElementById('routeLoadingOverlay');
  overlay.classList.add('active');

  try {
    if (!token) throw new Error('demo');
    
    const res = await fetch(`${API_BASE}/pickup/all`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Failed to load pickups');

    const pickups = await res.json();
    
    pickupLocations = pickups
      .filter(p => {
        const hasStatus = p.status === 'pending' || p.status === 'processing';
        const hasCoords = p.lat && p.lon && !isNaN(p.lat) && !isNaN(p.lon);
        return hasStatus && hasCoords;
      })
      .map(p => ({
        id: p._id,
        name: p.userId?.name || 'Household',
        address: p.address || 'Address not provided',
        lat: parseFloat(p.lat),
        lon: parseFloat(p.lon),
        quantity: p.quantity || 0,
        phone: p.userId?.phone || p.phone || '',
        wasteType: p.wasteType || 'Mixed Organic',
        pickupDate: p.pickupDate,
        pickupTime: p.pickupTime
      }));

    console.log(`✅ Loaded ${pickupLocations.length} pickups`);

    if (pickupLocations.length === 0) {
      showToast('No pending pickups found', 'error');
      displayDemoPickups();
      return;
    }

    displayLocationsOnMap(pickupLocations, 'pickup');
    showToast(`Loaded ${pickupLocations.length} pickups`);

  } catch (error) {
    console.warn('⚠️ Using demo pickup data:', error.message);
    displayDemoPickups();
  } finally {
    overlay.classList.remove('active');
  }
}

// Load deliveries for routing
// Load deliveries for routing
async function loadDeliveriesForRouting() {
  const overlay = document.getElementById('routeLoadingOverlay');
  overlay.classList.add('active');

  try {
    if (!token) throw new Error('demo');
    
    const res = await fetch(`${API_BASE}/order/all`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Failed to load orders');

    const orders = await res.json();
    
    console.log(`📦 Total orders fetched: ${orders.length}`);
    console.log('Orders:', orders);
    
    // Filter for confirmed/in-transit orders
    const eligibleOrders = orders.filter(o => 
      o.status === 'confirmed' || o.status === 'in-transit'
    );
    
    console.log(`✅ Eligible orders (confirmed/in-transit): ${eligibleOrders.length}`);
    
    deliveryLocations = eligibleOrders
      .filter(o => {
        const hasCoords = o.lat && o.lon && !isNaN(o.lat) && !isNaN(o.lon);
        
        if (!hasCoords) {
          console.warn(`⚠️ Order ${o._id} missing valid coordinates:`, {
            status: o.status,
            address: o.deliveryAddress,
            lat: o.lat,
            lon: o.lon
          });
        }
        
        return hasCoords;
      })
      .map(o => ({
        id: o._id,
        name: o.farmerId?.name || 'Farmer',
        address: o.deliveryAddress || 'Address not provided',
        lat: parseFloat(o.lat),
        lon: parseFloat(o.lon),
        quantity: o.quantity || 0,
        phone: o.farmerId?.phone || '',
        orderNumber: o.orderNumber || `ORD-${o._id.slice(-6)}`,
        totalAmount: o.totalAmount || 0,
        status: o.status
      }));

    console.log(`✅ Loaded ${deliveryLocations.length} deliveries with valid coordinates`);

    if (deliveryLocations.length === 0) {
      console.warn('⚠️ No deliveries with coordinates found. Showing demo data.');
      showToast('No confirmed orders with locations found', 'error');
      displayDemoDeliveries();
      return;
    }

    displayLocationsOnMap(deliveryLocations, 'delivery');
    showToast(`Loaded ${deliveryLocations.length} deliveries for routing`);

  } catch (error) {
    console.error('❌ Error loading deliveries:', error);
    console.warn('⚠️ Using demo delivery data');
    displayDemoDeliveries();
  } finally {
    overlay.classList.remove('active');
  }
}

// Display demo data
function displayDemoPickups() {
  pickupLocations = [
    { id: '1', name: 'Household A', lat: 12.2958, lon: 76.6394, address: 'MG Road', quantity: 3, wasteType: 'Kitchen Waste' },
    { id: '2', name: 'Household B', lat: 12.3050, lon: 76.6500, address: 'Hebbal', quantity: 2.5, wasteType: 'Fruit Waste' }
  ];
  displayLocationsOnMap(pickupLocations, 'pickup');
}

// Display demo deliveries (fallback)
function displayDemoDeliveries() {
  deliveryLocations = [
    { 
      id: '1', 
      name: 'Farmer Alpha', 
      lat: 12.3100, 
      lon: 76.6250, 
      address: 'Organic Farm, Mysuru', 
      quantity: 50, 
      phone: '+91 98888 11111', 
      orderNumber: 'ORD-001', 
      totalAmount: 1500,
      status: 'confirmed'
    },
    { 
      id: '2', 
      name: 'Farmer Beta', 
      lat: 12.2800, 
      lon: 76.6300, 
      address: 'Green Valley Farm', 
      quantity: 75, 
      phone: '+91 97777 22222', 
      orderNumber: 'ORD-002', 
      totalAmount: 2250,
      status: 'in-transit'
    },
    { 
      id: '3', 
      name: 'Farmer Gamma', 
      lat: 12.3050, 
      lon: 76.6500, 
      address: 'Eco Farms Ltd', 
      quantity: 40, 
      phone: '+91 96666 33333', 
      orderNumber: 'ORD-003', 
      totalAmount: 1200,
      status: 'confirmed'
    }
  ];
  displayLocationsOnMap(deliveryLocations, 'delivery');
  showToast('Using demo delivery data', 'info');
  console.log('✅ Demo deliveries loaded:', deliveryLocations);
}

// Display locations on map
function displayLocationsOnMap(locations, type) {
  clearRouteMarkers();

  const markerColor = type === 'pickup' ? '#00A63E' : '#f97316';
  const markerBorder = type === 'pickup' ? '#00A63E' : '#ea580c';

  locations.forEach((loc, index) => {
    const icon = L.divIcon({
      html: `<div class="custom-marker" style="background:${markerColor};border-color:${markerBorder};color:#fff;">${index + 1}</div>`,
      className: '',
      iconSize: [36, 36]
    });

    const popupContent = type === 'pickup' ? `
      <strong>${loc.name}</strong><br>
      📍 ${loc.address}<br>
      📦 ${loc.quantity} kg • ${loc.wasteType || 'Organic'}<br>
      ${loc.phone ? `📞 ${loc.phone}` : ''}
    ` : `
      <strong>${loc.name}</strong><br>
      📍 ${loc.address}<br>
      📦 ${loc.quantity} kg compost<br>
      🆔 ${loc.orderNumber || ''}<br>
      ${loc.phone ? `📞 ${loc.phone}` : ''}
    `;

    const marker = L.marker([loc.lat, loc.lon], { icon })
      .bindPopup(`<div style="min-width:200px;">${popupContent}</div>`)
      .addTo(routeMap);

    routeMarkers.push(marker);
  });

  if (routeMarkers.length > 0) {
    const group = L.featureGroup(routeMarkers);
    routeMap.fitBounds(group.getBounds().pad(0.15));
  }

  updateRouteMetrics({ totalStops: locations.length });
}

// Unified optimization function
async function optimizeCurrentRoute() {
  const locations = currentRouteType === 'pickup' ? pickupLocations : deliveryLocations;
  
  if (locations.length < 2) {
    showToast(`Need at least 2 ${currentRouteType} locations`, 'error');
    return;
  }

  const overlay = document.getElementById('routeLoadingOverlay');
  overlay.classList.add('active');

  try {
    const res = await fetch(`${API_BASE}/pickup/optimize-route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ locations })
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Optimization failed');
    }

    const result = await res.json();
    optimizedRouteData = result;
    
    displayOptimizedRoute(result.optimizedOrder, result.metrics, result.method);
    showToast(`Route optimized using ${result.method === 'gemini' ? 'Gemini AI' : 'fallback algorithm'}!`);

  } catch (error) {
    console.error('❌ Optimization error:', error);
    showToast('Route optimization failed: ' + error.message, 'error');
  } finally {
    overlay.classList.remove('active');
  }
}

// Display optimized route
function displayOptimizedRoute(optimizedOrder, metrics, method) {
  clearRouteMarkers();
  clearRouteLine();

  const markerColor = currentRouteType === 'pickup' ? '#00A63E' : '#f97316';
  const lineColor = currentRouteType === 'pickup' ? '#00A63E' : '#f97316';

  // Draw route line
  const coordinates = optimizedOrder.map(loc => [loc.lat, loc.lon]);
  
  routeLine = L.polyline(coordinates, {
    color: lineColor,
    weight: 5,
    opacity: 0.8,
    dashArray: '10, 10',
    lineJoin: 'round'
  }).addTo(routeMap);

  // Add markers
  optimizedOrder.forEach((loc, index) => {
    const icon = L.divIcon({
      html: `<div class="custom-marker optimized-marker" style="background:${markerColor};border-color:${markerColor};">${index + 1}</div>`,
      className: '',
      iconSize: [36, 36]
    });

    const marker = L.marker([loc.lat, loc.lon], { icon })
      .bindPopup(`<strong>Stop ${index + 1}: ${loc.name}</strong><br>${loc.address}<br>📦 ${loc.quantity} kg`)
      .addTo(routeMap);

    routeMarkers.push(marker);
  });

  routeMap.fitBounds(routeLine.getBounds().pad(0.15));

  updateRouteStopList(optimizedOrder);
  updateRouteMetrics(metrics);
  updateRouteMethodInfo(method);
}

// Helper functions for current route type
function refreshCurrentMap() {
  clearCurrentRoute();
  loadCurrentRouteData();
}

function clearCurrentRoute() {
  clearRouteMarkers();
  clearRouteLine();
  document.getElementById('routeStopList').innerHTML = '<div class="empty-state">Click "Optimize Route" to generate sequence</div>';
  document.getElementById('routeMethodCard').style.display = 'none';
}

function clearRouteMarkers() {
  routeMarkers.forEach(m => routeMap.removeLayer(m));
  routeMarkers = [];
}

function clearRouteLine() {
  if (routeLine) {
    routeMap.removeLayer(routeLine);
    routeLine = null;
  }
}

function exportCurrentRoutePDF() {
  if (!optimizedRouteData) {
    showToast('Please optimize a route first', 'error');
    return;
  }
  exportRoutePDF(); // Use existing function
}

function exportCurrentRouteCSV() {
  if (!optimizedRouteData) {
    showToast('Please optimize a route first', 'error');
    return;
  }
  exportRouteCSV(); // Use existing function
}

function exportRoutePDF() {
  if (!optimizedRouteData || !optimizedRouteData.optimizedOrder) {
    showToast("No optimized route to export", "error");
    return;
  }

  // 🔥 This extracts jsPDF from window.jspdf (MANDATORY)
  const { jsPDF } = window.jspdf;

  // 🔥 Now jsPDF is defined
  const doc = new jsPDF();

  doc.setFontSize(14);
  doc.text("Optimized Route", 10, 10);

  let y = 20;

  optimizedRouteData.optimizedOrder.forEach((loc, index) => {
    doc.text(`${index + 1}. ${loc.name} - ${loc.address}`, 10, y);
    y += 8;
  });

  doc.save("optimized-route.pdf");
}

// Update stop list
function updateRouteStopList(order) {
  const container = document.getElementById('routeStopList');
  container.innerHTML = order.map((loc, index) => `
    <div class="stop-item" onclick="focusOnStop(${index})">
      <div class="stop-number">${index + 1}</div>
      <div class="stop-details">
        <div class="stop-name">${loc.name}</div>
        <div class="stop-address">${loc.address}</div>
      </div>
      
    </div>
  `).join('');
}

// Focus on specific stop
function focusOnStop(index) {
  if (routeMarkers[index]) {
    routeMarkers[index].openPopup();
    routeMap.setView(routeMarkers[index].getLatLng(), 15, { animate: true });
  }
}

// Update metrics
function updateRouteMetrics(metrics) {
  setText('routeTotalStops', metrics.totalStops || 0);
  setText('routeTotalDistance', `${metrics.totalDistance || 0} km`);
  setText('routeEstimatedTime', `${metrics.estimatedTime || 0} min`);
  
  if (currentRouteType === 'pickup') {
    setText('routeMetricValue', `${metrics.timeSaved || 0} min`);
  } else {
    const totalLoad = deliveryLocations.reduce((sum, loc) => sum + (loc.quantity || 0), 0);
    setText('routeMetricValue', `${totalLoad} kg`);
  }
}

// Fix missing coordinates for orders
async function fixOrderCoordinates() {
  if (!confirm('This will geocode all orders missing coordinates. Continue?')) {
    return;
  }

  const overlay = document.getElementById('routeLoadingOverlay');
  overlay.classList.add('active');

  try {
    const res = await fetch(`${API_BASE}/order/fix-coordinates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) throw new Error('Failed to fix coordinates');

    const result = await res.json();
    
    showToast(`Fixed coordinates for ${result.updated} orders!`, 'success');
    console.log('✅ Coordinate fix result:', result);
    
    // Reload deliveries
    await loadDeliveriesForRouting();

  } catch (error) {
    console.error('❌ Fix coordinates error:', error);
    showToast('Failed to fix coordinates: ' + error.message, 'error');
  } finally {
    overlay.classList.remove('active');
  }
}

// Make it global
window.fixOrderCoordinates = fixOrderCoordinates;

// Update method info
function updateRouteMethodInfo(method) {
  const card = document.getElementById('routeMethodCard');
  const info = document.getElementById('routeMethodInfo');
  
  if (method === 'gemini') {
    info.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="font-size:24px;">✨</span>
        <strong style="color:#00A63E;">Gemini AI Optimization</strong>
      </div>
      <p style="margin:0;">Route optimized using Google's Gemini AI with Haversine distance calculations.</p>
    `;
  } else {
    info.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="font-size:24px;">🔧</span>
        <strong style="color:#3b82f6;">Nearest-Neighbor Algorithm</strong>
      </div>
      <p style="margin:0;">Route optimized using greedy nearest-neighbor algorithm.</p>
    `;
  }
  
  card.style.display = 'block';
}


// Load deliveries for routing
async function loadDeliveriesForRouting() {
  const overlay = document.getElementById('routeLoadingOverlay');
  overlay.classList.add('active');

  try {
    if (!token) throw new Error('demo');
    
    const res = await fetch(`${API_BASE}/order/all`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Failed to load orders');

    const orders = await res.json();
    
    console.log(`📦 Total orders fetched: ${orders.length}`);
    
    // Filter for confirmed/in-transit orders
    const eligibleOrders = orders.filter(o => 
      o.status === 'confirmed' || o.status === 'in-transit'
    );
    
    console.log(`✅ Eligible orders (confirmed/in-transit): ${eligibleOrders.length}`);
    
    // Separate orders with and without coordinates
    const ordersWithCoords = [];
    const ordersWithoutCoords = [];
    
    eligibleOrders.forEach(o => {
      const hasCoords = o.lat && o.lon && !isNaN(o.lat) && !isNaN(o.lon);
      
      if (hasCoords) {
        ordersWithCoords.push(o);
      } else {
        ordersWithoutCoords.push(o);
        console.warn(`⚠️ Order ${o._id} missing coordinates:`, {
          status: o.status,
          address: o.deliveryAddress,
          lat: o.lat,
          lon: o.lon
        });
      }
    });
    
    deliveryLocations = ordersWithCoords.map(o => ({
      id: o._id,
      name: o.farmerId?.name || 'Farmer',
      address: o.deliveryAddress || 'Address not provided',
      lat: parseFloat(o.lat),
      lon: parseFloat(o.lon),
      quantity: o.quantity || 0,
      phone: o.farmerId?.phone || '',
      orderNumber: o.orderNumber || `ORD-${o._id.slice(-6)}`,
      totalAmount: o.totalAmount || 0,
      status: o.status
    }));

    console.log(`✅ Loaded ${deliveryLocations.length} deliveries with valid coordinates`);

    if (deliveryLocations.length === 0) {
      if (ordersWithoutCoords.length > 0) {
        // Show helpful message about fixing coordinates
        showToast(
          `Found ${ordersWithoutCoords.length} order(s) without coordinates. Click "Fix Missing Coordinates" button.`,
          'error'
        );
      } else {
        showToast('No confirmed orders found', 'error');
      }
      displayDemoDeliveries();
      return;
    }

    displayLocationsOnMap(deliveryLocations, 'delivery');
    
    if (ordersWithoutCoords.length > 0) {
      showToast(
        `Loaded ${deliveryLocations.length} deliveries. ${ordersWithoutCoords.length} order(s) missing coordinates.`,
        'warning'
      );
    } else {
      showToast(`Loaded ${deliveryLocations.length} deliveries for routing`);
    }

  } catch (error) {
    console.error('❌ Error loading deliveries:', error);
    showToast('Failed to load deliveries: ' + error.message, 'error');
    displayDemoDeliveries();
  } finally {
    overlay.classList.remove('active');
  }
}

// Initialize when route planning section is shown
const originalShowSection = window.showSection;
window.showSection = function(sectionName) {
  originalShowSection(sectionName);
  
  if (sectionName === 'route-planning') {
    setTimeout(() => {
      initRouteMap();
    }, 100);
  }
};

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'index.html';
}

window.handlePickupStatus = handlePickupStatus;
window.handleOrderStatus = handleOrderStatus;
window.removeInventoryItem = removeInventoryItem;
window.removeRewardItem = removeRewardItem;
window.showSection = showSection;
window.logout = logout;
window.handleRewardImageChange = handleRewardImageChange;
window.handleCompostImageChange = handleCompostImageChange;

document.addEventListener('DOMContentLoaded', initAdminDashboard);
