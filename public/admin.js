/**
 * Carmel College Tech Fest - IGNITRON '26
 * Admin Control Center Script
 */

let registrationsData = [];
let eventPrices = {
  "Hackathon": 0,
  "UI/UX Design Challenge": 0,
  "Coding Competition": 100,
  "AI Innovation Challenge": 200,
  "Robotics Contest": 400,
  "Web Development Contest": 150,
  "Gaming Tournament": 250,
  "Startup Pitch Competition": 200
};

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Check existing session
  const savedPassword = sessionStorage.getItem('adminPassword');
  if (savedPassword) {
    document.getElementById('admin-auth-overlay').classList.add('hidden');
    document.getElementById('admin-dashboard-layout').classList.remove('hidden');
    loadDashboard(savedPassword);
  }

  // Login Form Submission
  const loginForm = document.getElementById('admin-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const passwordInput = document.getElementById('admin-password');
      const password = passwordInput.value;
      const errorBanner = document.getElementById('auth-error-banner');

      try {
        const response = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });

        const result = await response.json();

        if (response.ok && result.success) {
          // Store session
          sessionStorage.setItem('adminPassword', password);
          
          // Show dashboard
          const overlay = document.getElementById('admin-auth-overlay');
          overlay.style.transition = 'opacity 0.5s ease';
          overlay.style.opacity = '0';
          setTimeout(() => {
            overlay.classList.add('hidden');
            document.getElementById('admin-dashboard-layout').classList.remove('hidden');
            loadDashboard(password);
          }, 500);
        } else {
          errorBanner.classList.remove('hidden');
          passwordInput.value = '';
        }
      } catch (err) {
        console.error('Admin Auth Error:', err);
        errorBanner.classList.remove('hidden');
        errorBanner.innerText = 'Connection error. Verify server is running.';
      }
    });
  }

  // Setup Search and Select Filters
  document.getElementById('search-input').addEventListener('input', applyFilters);
  document.getElementById('filter-event').addEventListener('change', applyFilters);
  document.getElementById('filter-dept').addEventListener('change', applyFilters);
});

/* ==========================================
   1. Dynamic Dashboard Core Loader
   ========================================== */
async function loadDashboard(password) {
  try {
    // 1. Fetch Registrations Dataset
    const response = await fetch('/api/admin/registrations', {
      method: 'GET',
      headers: {
        'x-admin-password': password
      }
    });

    if (response.status === 401) {
      adminLogout();
      return;
    }

    const result = await response.json();
    if (!result.success) {
      alert('Error fetching database registers: ' + result.error);
      return;
    }

    registrationsData = result.registrations;

    // 2. Fetch Aggregated Statistics
    const statsResponse = await fetch('/api/admin/stats', {
      method: 'GET',
      headers: {
        'x-admin-password': password
      }
    });
    
    const statsResult = await statsResponse.json();
    
    if (statsResult.success) {
      renderStats(statsResult.stats);
    }

    // 3. Render Grid Table
    renderTable(registrationsData);

  } catch (error) {
    console.error('Load Dashboard Fail:', error);
  }
}

/* ==========================================
   2. Render Dashboard Statistics & Graphics
   ========================================== */
function renderStats(stats) {
  // Total registrations
  document.getElementById('stat-total-registrations').innerText = stats.total;

  // Calculate revenue dynamically
  let totalRevenue = 0;
  registrationsData.forEach(reg => {
    const fee = eventPrices[reg.event] || 0;
    totalRevenue += fee;
  });
  document.getElementById('stat-revenue').innerText = `₹${totalRevenue.toLocaleString('en-IN')}`;

  // Top event detection
  let topEventName = 'N/A';
  let topEventCount = 0;
  for (const [name, count] of Object.entries(stats.eventCounts)) {
    if (count > topEventCount) {
      topEventCount = count;
      topEventName = name;
    }
  }
  document.getElementById('stat-top-event').innerText = topEventName;
  document.getElementById('stat-top-event').title = topEventName;
  document.getElementById('stat-top-event-count').innerText = `${topEventCount} registrations`;

  // Top Department detection
  let topDeptName = 'N/A';
  let topDeptCount = 0;
  for (const [name, count] of Object.entries(stats.deptCounts)) {
    if (count > topDeptCount) {
      topDeptCount = count;
      topDeptName = name;
    }
  }
  document.getElementById('stat-top-dept').innerText = topDeptName;
  document.getElementById('stat-top-dept').title = topDeptName;
  document.getElementById('stat-top-dept-count').innerText = `${topDeptCount} registrations`;

  // Render Graphical Distribution Bars (Events)
  const eventBarsContainer = document.getElementById('event-stats-bars');
  if (Object.keys(stats.eventCounts).length === 0) {
    eventBarsContainer.innerHTML = '<p class="text-xs text-gray-500">No event data currently registered.</p>';
  } else {
    // Sort events by registration count descending
    const sortedEvents = Object.entries(stats.eventCounts).sort((a, b) => b[1] - a[1]);
    
    eventBarsContainer.innerHTML = sortedEvents.map(([name, count]) => {
      const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
      return `
        <div class="space-y-1">
          <div class="flex justify-between text-xs font-semibold">
            <span class="text-gray-300 truncate max-w-[200px]" title="${name}">${name}</span>
            <span class="text-white">${count} (${percentage.toFixed(1)}%)</span>
          </div>
          <div class="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-white/5">
            <div class="bg-rose-600 h-2 rounded-full shadow-[0_0_8px_rgba(225,29,72,0.3)]" style="width: ${percentage}%"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render Department Ratios Bars
  const deptBarsContainer = document.getElementById('dept-stats-bars');
  if (Object.keys(stats.deptCounts).length === 0) {
    deptBarsContainer.innerHTML = '<p class="text-xs text-gray-500">No department dataset registered.</p>';
  } else {
    const sortedDepts = Object.entries(stats.deptCounts).sort((a, b) => b[1] - a[1]);
    
    deptBarsContainer.innerHTML = sortedDepts.map(([name, count]) => {
      const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
      return `
        <div class="space-y-1">
          <div class="flex justify-between text-xs font-semibold">
            <span class="text-gray-300 truncate max-w-[140px]" title="${name}">${name}</span>
            <span class="text-white">${count}</span>
          </div>
          <div class="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-white/5">
            <div class="bg-rose-600 h-2 rounded-full" style="width: ${percentage}%"></div>
          </div>
        </div>
      `;
    }).join('');
  }
}

/* ==========================================
   3. Render Registrations Data Table Grid
   ========================================== */
function renderTable(data) {
  const tbody = document.getElementById('table-body');
  if (!tbody) return;

  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-8 text-center text-zinc-500 font-display">No registrations found matching selection guidelines.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = data.map(reg => {
    const dateStr = new Date(reg.created_at).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
      <tr class="admin-table-row border-b border-white/5 transition-colors">
        <!-- Participant Name -->
        <td class="py-4 px-4 text-white">
          <div class="font-bold text-sm">${reg.name}</div>
        </td>
        
        <!-- Department -->
        <td class="py-4 px-4 text-white">
          <div class="text-xs truncate max-w-[200px]" title="${reg.department || 'N/A'}">${reg.department || 'N/A'}</div>
        </td>
        
        <!-- Year of Study -->
        <td class="py-4 px-4 font-mono text-zinc-400">
          ${reg.year || 'N/A'}
        </td>
        
        <!-- Selected Event -->
        <td class="py-4 px-4 font-display font-bold text-white text-xs tracking-wider">
          <span class="inline-block px-2.5 py-1 bg-rose-950/20 border border-rose-500/20 rounded">
            ${reg.event}
          </span>
        </td>
        
        <!-- Screenshot -->
        <td class="py-4 px-4 no-print">
          ${reg.payment_screenshot_url === 'Free Entry' ? `
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-900/60 text-zinc-400 border border-zinc-800 tracking-wider">
              Free Entry
            </span>
          ` : `
            <button onclick="previewScreenshot('${reg.payment_screenshot_url}')" class="text-rose-500 hover:text-rose-400 font-semibold inline-flex items-center space-x-1 border border-rose-500/10 hover:border-rose-500 px-2 py-1 rounded bg-rose-600/5 hover:bg-rose-600/10 transition-colors">
              <i data-lucide="image" class="w-3.5 h-3.5 mr-1"></i>
              <span>Receipt</span>
            </button>
          `}
        </td>
        
        <!-- Date -->
        <td class="py-4 px-4 text-gray-400 font-mono whitespace-nowrap">
          ${dateStr}
        </td>
      </tr>
    `;
  }).join('');

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

/* ==========================================
   4. Apply Search & Dropdown Filters
   ========================================== */
function applyFilters() {
  const searchQuery = document.getElementById('search-input').value.toLowerCase().trim();
  const selectedEvent = document.getElementById('filter-event').value;
  const selectedDept = document.getElementById('filter-dept').value;

  const filtered = registrationsData.filter(reg => {
    // 1. Search Query Match — safely handle optional fields
    const name = (reg.name || '').toLowerCase();
    const email = (reg.email || '').toLowerCase();
    const phone = (reg.studentId || reg.phone || '');
    const college = (reg.college_name || 'Carmel College').toLowerCase();
    const dept = (reg.department || '').toLowerCase();
    const matchesSearch = 
      name.includes(searchQuery) ||
      email.includes(searchQuery) ||
      phone.includes(searchQuery) ||
      college.includes(searchQuery) ||
      dept.includes(searchQuery);

    // 2. Event Match
    const matchesEvent = selectedEvent === "" || reg.event === selectedEvent;

    // 3. Dept Match
    const matchesDept = selectedDept === "" || reg.department === selectedDept;

    return matchesSearch && matchesEvent && matchesDept;
  });

  renderTable(filtered);
}

/* ==========================================
   5. Receipt Image Preview Modal
   ========================================== */
function previewScreenshot(url) {
  const dialog = document.getElementById('screenshot-dialog');
  const img = document.getElementById('screenshot-preview-img');
  const btn = document.getElementById('download-screenshot-btn');

  if (dialog && img) {
    img.src = url;
    btn.href = url;
    dialog.showModal();
  }
}

function closeScreenshotModal() {
  const dialog = document.getElementById('screenshot-dialog');
  if (dialog) {
    dialog.close();
  }
}

/* ==========================================
   6. Export Implementations (CSV, Excel)
   ========================================== */
function exportToCSV() {
  if (registrationsData.length === 0) {
    alert('No data entries found to export!');
    return;
  }

  // Define headers
  const headers = ['Registration ID', 'Name', 'Student ID / Phone', 'Email', 'College', 'Department', 'Year', 'Event', 'Gender / Info', 'Payment Screenshot URL', 'Timestamp'];
  
  // Format rows
  const rows = registrationsData.map(reg => [
    reg.id,
    `"${reg.name.replace(/"/g, '""')}"`,
    `'${reg.studentId || reg.phone || ''}`,
    reg.email,
    `"${(reg.college_name || 'CCET Alappuzha').replace(/"/g, '""')}"`,
    `"${reg.department.replace(/"/g, '""')}"`,
    reg.year || 'N/A',
    `"${reg.event.replace(/"/g, '""')}"`,
    reg.studentId ? 'STUDENT' : reg.gender,
    reg.payment_screenshot_url,
    reg.created_at
  ]);

  const csvContent = "data:text/csv;charset=utf-8," 
    + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `ccet_techfest_registrations_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportToExcel() {
  if (registrationsData.length === 0) {
    alert('No registrations available to compile Excel sheets.');
    return;
  }

  // Format array payload for SheetJS
  const excelData = registrationsData.map((reg, idx) => ({
    "S.No": idx + 1,
    "Registration ID": reg.id,
    "Full Name": reg.name,
    "Student ID / Phone": reg.studentId || reg.phone || 'N/A',
    "Email": reg.email,
    "Gender / Info": reg.studentId ? 'STUDENT' : reg.gender,
    "College Name": reg.college_name || 'CCET Alappuzha',
    "Department": reg.department,
    "Year": reg.year || 'N/A',
    "Competition Choice": reg.event,
    "Payment Screenshot Link": reg.payment_screenshot_url,
    "Registration Date": new Date(reg.created_at).toLocaleString()
  }));

  // Create Excel Worksheet
  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Registrations");

  // Output file
  XLSX.writeFile(workbook, `ccet_techfest_registrations_${Date.now()}.xlsx`);
}

/* ==========================================
   7. Print Features
   ========================================== */
function printRegistrations() {
  // Set print timestamp
  const dateStr = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  document.getElementById('print-timestamp').innerText = dateStr;

  window.print();
}

/* ==========================================
   8. Admin Logout Session Actions
   ========================================== */
function adminLogout() {
  sessionStorage.removeItem('adminPassword');
  window.location.reload();
}
