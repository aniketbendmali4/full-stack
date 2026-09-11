/**
 * Frontend logic for Student Management Portal
 * Lightweight Vanilla JavaScript - Zero bloatware
 */

// Host candidates to connect to FastAPI
const RAILWAY_BACKEND = 'https://full-stack-production-8a5c.up.railway.app';
let API_BASE = (window.location.protocol === 'file:' || window.location.port === '5500' || window.location.port === '3000' || window.location.port === '5173') 
  ? RAILWAY_BACKEND 
  : (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1') ? 'http://127.0.0.1:8000' : window.location.origin);

// App state
let allStudents = [];

// DOM Elements
const statTotal = document.getElementById('stat-total');
const statAvg = document.getElementById('stat-avg');
const statTop = document.getElementById('stat-top');

const addForm = document.getElementById('add-student-form');
const submitBtn = document.getElementById('submit-btn');
const btnText = submitBtn.querySelector('.btn-text');
const btnSpinner = submitBtn.querySelector('.btn-spinner');

const studentsTbody = document.getElementById('students-tbody');
const tableLoading = document.getElementById('table-loading');
const tableEmpty = document.getElementById('table-empty');
const emptyMessage = document.getElementById('empty-message');
const searchInput = document.getElementById('search-input');
const refreshBtn = document.getElementById('refresh-btn');

// Modal Elements
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-student-form');
const editIdInput = document.getElementById('edit-id');
const editNameInput = document.getElementById('edit-name');
const editCourseInput = document.getElementById('edit-course');
const editMarksInput = document.getElementById('edit-marks');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');

// Toast Notification
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : '✕'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Resilient fetch with fallback between Railway, current origin, and local server
async function apiFetch(endpoint, options = {}) {
  const hosts = [
    API_BASE,
    RAILWAY_BACKEND,
    window.location.origin,
    'http://127.0.0.1:8000',
    'http://localhost:8000'
  ].filter(Boolean);
  const uniqueHosts = [...new Set(hosts)];

  let lastError = null;
  for (const host of uniqueHosts) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout for cold starts

    try {
      const res = await fetch(`${host}${endpoint}`, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      API_BASE = host; // Save working host
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
    }
  }

  throw lastError || new Error('Failed to connect to backend');
}

// Get Badge Class based on Marks
function getBadgeClass(marks) {
  const num = Number(marks);
  if (num >= 80) return 'badge-high';
  if (num >= 60) return 'badge-mid';
  if (num >= 40) return 'badge-low';
  return 'badge-danger';
}

// Calculate and render statistics
function updateStats(students) {
  statTotal.textContent = students.length;

  if (students.length === 0) {
    statAvg.textContent = '0';
    statTop.textContent = '0';
    return;
  }

  const marksArray = students.map(s => Number(s.marks) || 0);
  const sum = marksArray.reduce((acc, curr) => acc + curr, 0);
  const avg = (sum / students.length).toFixed(1);
  const max = Math.max(...marksArray);

  statAvg.textContent = avg;
  statTop.textContent = max;
}

// Render student rows to table
function renderTable(students) {
  studentsTbody.innerHTML = '';

  if (students.length === 0) {
    tableEmpty.style.display = 'flex';
    emptyMessage.innerHTML = searchInput.value.trim() 
      ? 'No students match your search filter' 
      : 'No students enrolled yet. Add one!';
    return;
  }

  tableEmpty.style.display = 'none';

  students.forEach(student => {
    const tr = document.createElement('tr');
    tr.dataset.id = student.id;

    const badgeClass = getBadgeClass(student.marks);

    tr.innerHTML = `
      <td class="student-id">#${student.id}</td>
      <td class="student-name-cell">${escapeHtml(student.name)}</td>
      <td><span class="course-tag">${escapeHtml(student.course)}</span></td>
      <td><span class="marks-badge ${badgeClass}">${student.marks}</span></td>
      <td>
        <div class="action-buttons">
          <button class="btn-table edit" onclick="openEditModal(${student.id})">
            Edit
          </button>
          <button class="btn-table delete" onclick="deleteStudent(${student.id})">
            Delete
          </button>
        </div>
      </td>
    `;
    studentsTbody.appendChild(tr);
  });
}

// Escape HTML helper for security
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Fetch all students from API
async function loadStudents() {
  tableLoading.style.display = 'flex';
  tableEmpty.style.display = 'none';
  studentsTbody.innerHTML = '';

  try {
    const res = await apiFetch('/students');
    if (!res.ok) {
      let errDetail = `Server returned HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson && errJson.detail) {
          errDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
        }
      } catch (_) {}
      throw new Error(errDetail);
    }

    const data = await res.json();

    // Handle data format from main.py
    allStudents = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
    
    // Sort students by id descending
    allStudents.sort((a, b) => (b.id || 0) - (a.id || 0));

    updateStats(allStudents);
    filterStudents();
  } catch (err) {
    console.error('Error fetching students:', err);
    tableEmpty.style.display = 'flex';
    emptyMessage.innerHTML = `
      <span style="font-weight: 600; color: #ef4444;">Backend / Database Notice</span>
      <span style="font-size: 0.85rem; color: #64748b; margin-top: 6px; max-width: 480px; text-align: center; word-break: break-word;">
        ${escapeHtml(err.message || 'Cannot connect to backend server')}
      </span>
      <span style="font-size: 0.78rem; color: #94a3b8; margin-top: 6px;">
        Backend URL: <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${escapeHtml(API_BASE)}</code>
      </span>
      <button class="btn btn-secondary" onclick="loadStudents()" style="margin-top: 10px; font-size: 0.8rem; padding: 0.4rem 0.8rem;">
        ↻ Retry Connection
      </button>
    `;
    showToast(err.message || 'Cannot connect to backend', 'error');
  } finally {
    tableLoading.style.display = 'none';
  }
}

// Filter students based on search input
function filterStudents() {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) {
    renderTable(allStudents);
    return;
  }

  const filtered = allStudents.filter(s => 
    (s.name && s.name.toLowerCase().includes(query)) ||
    (s.course && s.course.toLowerCase().includes(query)) ||
    (s.id && String(s.id).includes(query))
  );

  renderTable(filtered);
}

// Handle Add Student Form Submit
addForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('student-name').value.trim();
  const course = document.getElementById('student-course').value.trim();
  const marks = parseInt(document.getElementById('student-marks').value, 10);

  if (!name || !course || isNaN(marks)) {
    showToast('Please fill all fields accurately', 'error');
    return;
  }

  // Set loading button state
  submitBtn.disabled = true;
  btnText.textContent = 'Saving...';
  btnSpinner.style.display = 'inline-block';

  try {
    const params = new URLSearchParams({ name, course, marks });
    const res = await apiFetch(`/students?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || `Status ${res.status}`);
    }

    showToast(`Student "${name}" added successfully!`);
    addForm.reset();
    await loadStudents();
  } catch (err) {
    console.error('Error adding student:', err);
    showToast('Failed to add student. Check backend connection.', 'error');
  } finally {
    submitBtn.disabled = false;
    btnText.textContent = 'Add Student';
    btnSpinner.style.display = 'none';
  }
});

// Edit Student Modal handler
window.openEditModal = function(id) {
  const student = allStudents.find(s => s.id === id);
  if (!student) return;

  editIdInput.value = student.id;
  editNameInput.value = student.name;
  editCourseInput.value = student.course;
  editMarksInput.value = student.marks;

  editModal.style.display = 'flex';
  editNameInput.focus();
};

function closeEditModal() {
  editModal.style.display = 'none';
}

modalCloseBtn.addEventListener('click', closeEditModal);
modalCancelBtn.addEventListener('click', closeEditModal);
editModal.addEventListener('click', (e) => {
  if (e.target === editModal) closeEditModal();
});

// Submit Edit Form
editForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = parseInt(editIdInput.value, 10);
  const name = editNameInput.value.trim();
  const course = editCourseInput.value.trim();
  const marks = parseInt(editMarksInput.value, 10);

  const saveBtn = document.getElementById('modal-save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Updating...';

  try {
    const params = new URLSearchParams({ id, name, course, marks });
    const res = await apiFetch(`/students?${params.toString()}`, {
      method: 'PATCH',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || `Status ${res.status}`);
    }

    showToast(`Student #${id} updated successfully!`);
    closeEditModal();
    await loadStudents();
  } catch (err) {
    console.error('Error updating student:', err);
    showToast('Failed to update student', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Changes';
  }
});

// Delete Student
window.deleteStudent = async function(id) {
  const student = allStudents.find(s => s.id === id);
  const studentName = student ? student.name : `#${id}`;

  if (!confirm(`Are you sure you want to delete student "${studentName}"?`)) {
    return;
  }

  try {
    const res = await apiFetch(`/students?id=${id}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || `Status ${res.status}`);
    }

    showToast(`Student "${studentName}" removed`);
    await loadStudents();
  } catch (err) {
    console.error('Error deleting student:', err);
    showToast('Failed to delete student', 'error');
  }
};

// Event Listeners
searchInput.addEventListener('input', filterStudents);
refreshBtn.addEventListener('click', loadStudents);

// Keyboard Esc to close modal
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && editModal.style.display === 'flex') {
    closeEditModal();
  }
});

// Start load immediately if DOM is already ready, or on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadStudents);
} else {
  loadStudents();
}
