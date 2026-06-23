const Toast = {
  show(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast-item ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, duration);
  },
  success(m) { this.show(m, 'success'); },
  error(m) { this.show(m, 'error'); },
  info(m) { this.show(m, 'info'); }
};

const Modal = {
  show(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('show');
  },
  hide(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('show');
  },
  closeOnOverlay(event) {
    if (event.target.classList.contains('modal-overlay')) {
      event.target.classList.remove('show');
    }
  }
};

function Pagination(config) {
  const { containerId, totalItems, pageSize, currentPage, onPageChange } = config;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  function render() {
    const container = document.getElementById(containerId);
    if (!container) return;
    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, totalItems);

    let html = `<div class="pagination">
      <div>共 ${totalItems} 条，显示 ${start}-${end}</div>
      <div class="page-btns">`;

    if (currentPage > 1) {
      html += `<button data-page="${currentPage - 1}">‹</button>`;
    }
    for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
      html += `<button data-page="${i}" class="${i === currentPage ? 'active' : ''}">${i}</button>`;
    }
    if (currentPage < totalPages) {
      html += `<button data-page="${currentPage + 1}">›</button>`;
    }

    html += `</div></div>`;
    container.innerHTML = html;

    container.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => onPageChange(parseInt(btn.dataset.page)));
    });
  }

  render();
  return { render };
}

function exportToExcel(filename, headers, rows) {
  let csv = '\uFEFF' + headers.join(',') + '\n';
  rows.forEach(row => {
    csv += row.map(cell => {
      const val = String(cell ?? '');
      return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
    }).join(',') + '\n';
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
  Toast.success('Excel 导出成功');
}

function printTable(tableId, title) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>
      body { font-family: 'SimSun', serif; padding: 40px; font-size: 14px; }
      h2 { text-align: center; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #333; padding: 6px 10px; text-align: left; font-size: 13px; }
      th { background: #f0f0f0; }
      .print-footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
    </style></head><body>
    <h2>${title}</h2>
    <div>打印日期：${new Date().toLocaleDateString('zh-CN')}</div>
    ${table.outerHTML}
    <div class="print-footer">浙江树人学院 · 树院智管系统</div>
    <script>window.onload=function(){window.print();window.close()}<\/script>
    </body></html>`);
  win.document.close();
}

function formatDate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getToday() { return formatDate(new Date()); }

function getCurrentUser() {
  return JSON.parse(localStorage.getItem('shuyuan_user') || '{"name":"管理员","role":"admin","avatar":"管"}');
}

function setNavigationActive(pageId) {
  document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
  const link = document.querySelector(`.sidebar-nav a[data-page="${pageId}"]`);
  if (link) link.classList.add('active');
}

function handleLogout() {
  localStorage.removeItem('shuyuan_user');
  window.location.href = 'login.html';
}
