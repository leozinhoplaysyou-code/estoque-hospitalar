// ============================================================
// ESTOQUE HOSPITALAR — Controle Inteligente de Ala (PWA)
// app.js — Lógica principal do aplicativo
// ============================================================

// === IMPORTS FIREBASE SDK v10 (Modular, via CDN) ===
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, onSnapshot,
  query, orderBy, where, limit, Timestamp, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

// === CONFIGURAÇÃO FIREBASE ===
// ⚠️ SUBSTITUA os valores abaixo pelas credenciais do SEU projeto Firebase.
// Veja as instruções de setup para saber como obter essas informações.
const firebaseConfig = {
  apiKey: "AIzaSyDl3znj_YbdOYw-BA3uf7eEhHTxhC30dCA",
  authDomain: "estoque-ala-hospitalar.firebaseapp.com",
  projectId: "estoque-ala-hospitalar",
  storageBucket: "estoque-ala-hospitalar.firebasestorage.app",
  messagingSenderId: "867881436238",
  appId: "1:867881436238:web:c19e16ed40c7b255dfef1f"
};

// Inicializa Firebase com persistência offline
const firebaseApp = initializeApp(firebaseConfig);
const db = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

// ============================================================
// ESTADO DA APLICAÇÃO
// ============================================================
let items = [];
let movements = [];
let currentTab = 'inicio';
let holidays = [];
let dismissedSuggestions = JSON.parse(localStorage.getItem('dismissedSuggestions') || '[]');
let showDismissed = false;
let isOnline = navigator.onLine;
let chartABC = null;
let chartMonthly = null;
let movementsLimit = 100;
let deferredInstallPrompt = null;

const DAYS_PT = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const CATEGORY_COLORS = {
  'Descartáveis': { bg: 'bg-blue-100', text: 'text-blue-700' },
  'Curativos': { bg: 'bg-purple-100', text: 'text-purple-700' },
  'EPIs': { bg: 'bg-amber-100', text: 'text-amber-700' },
  'Medicamentos': { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  'Outros': { bg: 'bg-slate-100', text: 'text-slate-600' }
};

// Referências do DOM (serão inicializadas no DOMContentLoaded/init)
let DOM = {};

function cacheDOMRefs() {
  DOM = {
    connectionStatus: document.getElementById('connection-status'),
    inputResponsible: document.getElementById('input-responsible'),
    selectShift: document.getElementById('select-shift'),
    btnSaveShift: document.getElementById('btn-save-shift'),
    alertBanners: document.getElementById('alert-banners-container'),
    anomalyAlerts: document.getElementById('anomaly-alerts'),
    expiryAlerts: document.getElementById('expiry-alerts'),
    stockGrid: document.getElementById('stock-grid'),
    stockSearch: document.getElementById('stock-search'),
    stockFilterCategory: document.getElementById('stock-filter-category'),
    stockSort: document.getElementById('stock-sort'),
    suggestionsList: document.getElementById('suggestions-list'),
    btnShowDismissed: document.getElementById('btn-show-dismissed'),
    historyList: document.getElementById('history-list'),
    historyDateStart: document.getElementById('history-date-start'),
    historyDateEnd: document.getElementById('history-date-end'),
    historyTypeFilter: document.getElementById('history-type-filter'),
    btnExportHistory: document.getElementById('btn-export-history'),
    btnLoadMore: document.getElementById('btn-load-more-history'),
    chartABCCanvas: document.getElementById('chart-abc'),
    chartMonthlyCanvas: document.getElementById('chart-monthly'),
    reportMonthFilter: document.getElementById('report-month-filter'),
    reportCategoryFilter: document.getElementById('report-category-filter'),
    modalOverlay: document.getElementById('modal-overlay'),
    modalTitle: document.getElementById('modal-title'),
    itemForm: document.getElementById('item-form'),
    itemId: document.getElementById('item-id'),
    itemName: document.getElementById('item-name'),
    itemCategory: document.getElementById('item-category'),
    itemUnit: document.getElementById('item-unit'),
    itemStock: document.getElementById('item-stock'),
    itemMinStock: document.getElementById('item-min-stock'),
    itemLot: document.getElementById('item-lot'),
    itemExpiry: document.getElementById('item-expiry'),
    itemPhoto: document.getElementById('item-photo'),
    photoPreview: document.getElementById('photo-preview'),
    photoPlaceholder: document.getElementById('photo-placeholder'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    btnCancelItem: document.getElementById('btn-cancel-item'),
    modalQtyOverlay: document.getElementById('modal-qty-overlay'),
    qtyItemId: document.getElementById('qty-item-id'),
    qtyType: document.getElementById('qty-type'),
    qtyAmount: document.getElementById('qty-amount'),
    qtyItemName: document.getElementById('qty-item-name'),
    qtyModalTitle: document.getElementById('qty-modal-title'),
    btnCancelQty: document.getElementById('btn-cancel-qty'),
    btnConfirmQty: document.getElementById('btn-confirm-qty'),
    fabAddItem: document.getElementById('fab-add-item'),
    toastContainer: document.getElementById('toast-container'),
    pwaInstallBanner: document.getElementById('pwa-install-banner'),
    btnPwaInstall: document.getElementById('btn-pwa-install'),
    btnPwaDismiss: document.getElementById('btn-pwa-dismiss'),
    dashboardGreeting: document.getElementById('dashboard-greeting'),
    dashboardDate: document.getElementById('dashboard-date'),
    statTotalItems: document.getElementById('stat-total-items'),
    statLowStock: document.getElementById('stat-low-stock'),
    statExpiring: document.getElementById('stat-expiring'),
    statMovementsToday: document.getElementById('stat-movements-today'),
    recentMovements: document.getElementById('recent-movements'),
    sections: {
      inicio: document.getElementById('section-inicio'),
      estoque: document.getElementById('section-estoque'),
      sugestoes: document.getElementById('section-sugestoes'),
      relatorios: document.getElementById('section-relatorios'),
      historico: document.getElementById('section-historico')
    }
  };
}

// ============================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================
function showToast(message, type = 'success', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = {
    success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️'
  };
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
  toast.style.animationDuration = `0.35s, 0.35s`;
  toast.style.animationDelay = `0s, ${(duration - 350) / 1000}s`;
  DOM.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

function formatDate(date) {
  if (!date) return '-';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('pt-BR');
}

function formatDateTime(date) {
  if (!date) return '-';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateISO(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().split('T')[0];
}

function getDayName(date) {
  const d = date instanceof Date ? date : new Date(date);
  return DAYS_PT[d.getDay()];
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  const target = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function getResponsible() {
  return DOM.inputResponsible?.value?.trim() || 'Não informado';
}

function getShift() {
  return DOM.selectShift?.value || 'Manhã';
}

// ============================================================
// COMPRESSÃO DE FOTO
// ============================================================
function compressPhoto(file, maxWidth = 400, maxHeight = 400, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;

        if (w > maxWidth || h > maxHeight) {
          const ratio = Math.min(maxWidth / w, maxHeight / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        const base64 = canvas.toDataURL('image/jpeg', quality);
        resolve(base64);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================================
// OPERAÇÕES DE BANCO DE DADOS (FIRESTORE)
// ============================================================

// --- ITENS ---
async function saveItem(itemData) {
  try {
    if (itemData.id) {
      const ref = doc(db, 'items', itemData.id);
      const updateData = { ...itemData, updatedAt: serverTimestamp() };
      delete updateData.id;
      await updateDoc(ref, updateData);
      showToast('Item atualizado com sucesso!', 'success');
    } else {
      const newData = { ...itemData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
      delete newData.id;
      await addDoc(collection(db, 'items'), newData);
      showToast('Item cadastrado com sucesso!', 'success');
    }
  } catch (error) {
    console.error('Erro ao salvar item:', error);
    showToast('Erro ao salvar item. Será sincronizado quando houver conexão.', 'warning');
  }
}

async function deleteItem(itemId) {
  try {
    await deleteDoc(doc(db, 'items', itemId));
    showToast('Item removido.', 'info');
  } catch (error) {
    console.error('Erro ao deletar:', error);
    showToast('Erro ao remover item.', 'error');
  }
}

function subscribeToItems() {
  const q = query(collection(db, 'items'), orderBy('name'));
  onSnapshot(q, (snapshot) => {
    items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCurrentView();
  }, (error) => {
    console.error('Erro ao escutar itens:', error);
  });
}

function subscribeToMovements() {
  const q = query(collection(db, 'movements'), orderBy('timestamp', 'desc'), limit(500));
  onSnapshot(q, (snapshot) => {
    movements = snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp || Date.now())
      };
    });
    renderCurrentView();
  }, (error) => {
    console.error('Erro ao escutar movimentações:', error);
  });
}

// --- MOVIMENTAÇÕES ---
async function recordMovement(itemId, itemName, type, quantity, lotNumber = '') {
  try {
    const item = items.find(i => i.id === itemId);
    if (!item) {
      showToast('Item não encontrado.', 'error');
      return false;
    }

    const now = new Date();
    const movData = {
      itemId, itemName, type, quantity,
      responsible: getResponsible(),
      shift: getShift(),
      timestamp: serverTimestamp(),
      dayOfWeek: now.getDay(),
      weekNumber: getWeekNumber(now),
      lotNumber: lotNumber,
      anomalyNote: ''
    };

    await addDoc(collection(db, 'movements'), movData);

    // Atualizar estoque do item
    let newStock = item.currentStock || 0;
    let updatedLots = [...(item.lots || [])];

    if (type === 'saida') {
      newStock = Math.max(0, newStock - quantity);

      // PVPS: consumir do lote com validade mais próxima
      let remaining = quantity;
      updatedLots.sort((a, b) => {
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return a.expiryDate.localeCompare(b.expiryDate);
      });
      updatedLots = updatedLots.map(lot => {
        if (remaining <= 0) return lot;
        const take = Math.min(lot.quantity || 0, remaining);
        remaining -= take;
        return { ...lot, quantity: (lot.quantity || 0) - take };
      }).filter(lot => lot.quantity > 0);

    } else {
      newStock += quantity;
      // Adicionar ao lote existente ou criar novo
      if (lotNumber) {
        const existingLot = updatedLots.find(l => l.lotNumber === lotNumber);
        if (existingLot) {
          existingLot.quantity = (existingLot.quantity || 0) + quantity;
        } else {
          updatedLots.push({ lotNumber, expiryDate: '', quantity });
        }
      }
    }

    await updateDoc(doc(db, 'items', itemId), {
      currentStock: newStock,
      lots: updatedLots,
      updatedAt: serverTimestamp()
    });

    const typeText = type === 'saida' ? 'Saída' : 'Entrada';
    showToast(`${typeText}: ${quantity}x ${itemName}`, type === 'saida' ? 'info' : 'success');
    return true;
  } catch (error) {
    console.error('Erro na movimentação:', error);
    showToast('Erro na movimentação. Será sincronizada quando houver conexão.', 'warning');
    return false;
  }
}

async function quickSubtract(itemId, qty) {
  const item = items.find(i => i.id === itemId);
  if (!item) return;
  if ((item.currentStock || 0) < qty) {
    showToast(`Estoque insuficiente! Disponível: ${item.currentStock || 0}`, 'error');
    return;
  }
  // PVPS: identificar lote mais próximo do vencimento
  const sortedLots = [...(item.lots || [])].sort((a, b) => {
    if (!a.expiryDate) return 1;
    if (!b.expiryDate) return -1;
    return a.expiryDate.localeCompare(b.expiryDate);
  });
  const lotNumber = sortedLots.length > 0 ? sortedLots[0].lotNumber : '';
  await recordMovement(itemId, item.name, 'saida', qty, lotNumber);
}

async function quickAdd(itemId, qty, lotNumber = '') {
  const item = items.find(i => i.id === itemId);
  if (!item) return;
  await recordMovement(itemId, item.name, 'entrada', qty, lotNumber);
}

async function saveAnomalyNote(itemId, note) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMoves = movements.filter(m =>
      m.itemId === itemId &&
      m.type === 'saida' &&
      m.timestamp >= today
    );
    for (const mov of todayMoves) {
      await updateDoc(doc(db, 'movements', mov.id), { anomalyNote: note });
    }
    showToast('Justificativa salva.', 'success');
  } catch (error) {
    console.error('Erro ao salvar justificativa:', error);
    showToast('Erro ao salvar justificativa.', 'error');
  }
}

// ============================================================
// LÓGICA DE FERIADOS NACIONAIS
// ============================================================
const FALLBACK_HOLIDAYS = {
  2024: [
    { date: '2024-01-01', name: 'Confraternização Universal' },
    { date: '2024-02-12', name: 'Carnaval' }, { date: '2024-02-13', name: 'Carnaval' },
    { date: '2024-03-29', name: 'Sexta-feira Santa' },
    { date: '2024-04-21', name: 'Tiradentes' },
    { date: '2024-05-01', name: 'Dia do Trabalho' },
    { date: '2024-05-30', name: 'Corpus Christi' },
    { date: '2024-09-07', name: 'Independência do Brasil' },
    { date: '2024-10-12', name: 'Nossa Senhora Aparecida' },
    { date: '2024-11-02', name: 'Finados' },
    { date: '2024-11-15', name: 'Proclamação da República' },
    { date: '2024-11-20', name: 'Consciência Negra' },
    { date: '2024-12-25', name: 'Natal' }
  ],
  2025: [
    { date: '2025-01-01', name: 'Confraternização Universal' },
    { date: '2025-03-03', name: 'Carnaval' }, { date: '2025-03-04', name: 'Carnaval' },
    { date: '2025-04-18', name: 'Sexta-feira Santa' },
    { date: '2025-04-21', name: 'Tiradentes' },
    { date: '2025-05-01', name: 'Dia do Trabalho' },
    { date: '2025-06-19', name: 'Corpus Christi' },
    { date: '2025-09-07', name: 'Independência do Brasil' },
    { date: '2025-10-12', name: 'Nossa Senhora Aparecida' },
    { date: '2025-11-02', name: 'Finados' },
    { date: '2025-11-15', name: 'Proclamação da República' },
    { date: '2025-11-20', name: 'Consciência Negra' },
    { date: '2025-12-25', name: 'Natal' }
  ],
  2026: [
    { date: '2026-01-01', name: 'Confraternização Universal' },
    { date: '2026-02-16', name: 'Carnaval' }, { date: '2026-02-17', name: 'Carnaval' },
    { date: '2026-04-03', name: 'Sexta-feira Santa' },
    { date: '2026-04-21', name: 'Tiradentes' },
    { date: '2026-05-01', name: 'Dia do Trabalho' },
    { date: '2026-06-04', name: 'Corpus Christi' },
    { date: '2026-09-07', name: 'Independência do Brasil' },
    { date: '2026-10-12', name: 'Nossa Senhora Aparecida' },
    { date: '2026-11-02', name: 'Finados' },
    { date: '2026-11-15', name: 'Proclamação da República' },
    { date: '2026-11-20', name: 'Consciência Negra' },
    { date: '2026-12-25', name: 'Natal' }
  ],
  2027: [
    { date: '2027-01-01', name: 'Confraternização Universal' },
    { date: '2027-02-08', name: 'Carnaval' }, { date: '2027-02-09', name: 'Carnaval' },
    { date: '2027-03-26', name: 'Sexta-feira Santa' },
    { date: '2027-04-21', name: 'Tiradentes' },
    { date: '2027-05-01', name: 'Dia do Trabalho' },
    { date: '2027-05-27', name: 'Corpus Christi' },
    { date: '2027-09-07', name: 'Independência do Brasil' },
    { date: '2027-10-12', name: 'Nossa Senhora Aparecida' },
    { date: '2027-11-02', name: 'Finados' },
    { date: '2027-11-15', name: 'Proclamação da República' },
    { date: '2027-11-20', name: 'Consciência Negra' },
    { date: '2027-12-25', name: 'Natal' }
  ]
};

async function loadHolidays() {
  const currentYear = new Date().getFullYear();
  const yearsToLoad = [currentYear, currentYear + 1];

  for (const year of yearsToLoad) {
    try {
      const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
      if (response.ok) {
        const data = await response.json();
        const formatted = data.map(h => ({ date: h.date, name: h.name }));
        holidays = [...holidays, ...formatted];
      } else {
        throw new Error('API indisponível');
      }
    } catch {
      // Fallback para feriados embutidos
      if (FALLBACK_HOLIDAYS[year]) {
        holidays = [...holidays, ...FALLBACK_HOLIDAYS[year]];
      }
    }
  }

  // Remover duplicatas
  const seen = new Set();
  holidays = holidays.filter(h => {
    if (seen.has(h.date)) return false;
    seen.add(h.date);
    return true;
  });

  checkHolidayAlerts();
}

function isHoliday(dateStr) {
  return holidays.some(h => h.date === dateStr);
}

function getHolidayName(dateStr) {
  const h = holidays.find(h => h.date === dateStr);
  return h ? h.name : '';
}

function isWeekend(date) {
  const d = date instanceof Date ? date : new Date(date + 'T00:00:00');
  return d.getDay() === 0 || d.getDay() === 6;
}

function isBusinessDay(date) {
  const d = date instanceof Date ? date : new Date(date + 'T00:00:00');
  return !isWeekend(d) && !isHoliday(formatDateISO(d));
}

function getNextBusinessDay(date) {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  while (!isBusinessDay(d)) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function checkHolidayAlerts() {
  if (!DOM.alertBanners) return;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const alerts = [];

  // Verificar feriados nos próximos 5 dias
  for (let i = 1; i <= 5; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() + i);
    const dateStr = formatDateISO(checkDate);

    if (isHoliday(dateStr)) {
      const holidayName = getHolidayName(dateStr);
      const businessDaysBefore = [];
      const tempDate = new Date(today);
      let count = 0;
      while (tempDate < checkDate) {
        if (isBusinessDay(tempDate)) count++;
        tempDate.setDate(tempDate.getDate() + 1);
      }

      if (count <= 2) {
        alerts.push({
          type: 'danger',
          icon: '🚨',
          message: `<strong>Atenção: Feriado Nacional "${holidayName}" em ${formatDate(checkDate)} (${getDayName(checkDate)}).</strong><br>Faça os pedidos HOJE para garantir a entrega antes da pausa. Não haverá entregas no feriado.`
        });
      }
    }
  }

  // Alertas de sexta-feira / final de semana
  if (dayOfWeek === 3) { // Quarta
    alerts.push({
      type: 'warning',
      icon: '📋',
      message: `<strong>Lembrete:</strong> Amanhã (quinta) é o último dia para pedidos com entrega até sexta. Verifique o estoque para cobertura do final de semana.`
    });
  } else if (dayOfWeek === 4) { // Quinta
    alerts.push({
      type: 'warning',
      icon: '⚡',
      message: `<strong>Último dia para pedidos!</strong> Pedidos feitos hoje serão entregues amanhã (sexta). Garanta a cobertura para o final de semana.`
    });
  } else if (dayOfWeek === 5) { // Sexta
    alerts.push({
      type: 'info',
      icon: '📌',
      message: `<strong>Hoje é sexta-feira!</strong> Verifique se os pedidos para cobertura do final de semana já foram realizados. Próxima entrega: segunda-feira.`
    });
  }

  // Renderizar alertas
  DOM.alertBanners.innerHTML = alerts.map(a => `
    <div class="alert-banner alert-banner-${a.type}">
      <span class="text-xl flex-shrink-0">${a.icon}</span>
      <div class="flex-1 text-sm leading-relaxed">${a.message}</div>
    </div>
  `).join('');
}

// ============================================================
// ANÁLISE DE CONSUMO E SUGESTÕES
// ============================================================
function getConsumptionHistory(itemId, weeks = 4) {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - (weeks * 7));

  const itemMovements = movements.filter(m =>
    m.itemId === itemId &&
    m.type === 'saida' &&
    m.timestamp >= startDate
  );

  // Agrupar por dia da semana
  const byDay = {};
  const dayCount = {};
  for (let i = 0; i < 7; i++) { byDay[i] = 0; dayCount[i] = 0; }

  // Contar quantos de cada dia da semana tivemos no período
  const tempDate = new Date(startDate);
  while (tempDate <= now) {
    dayCount[tempDate.getDay()]++;
    tempDate.setDate(tempDate.getDate() + 1);
  }

  itemMovements.forEach(m => {
    const day = m.dayOfWeek !== undefined ? m.dayOfWeek : m.timestamp.getDay();
    byDay[day] += m.quantity || 0;
  });

  // Calcular médias
  const avgByDay = {};
  let totalQty = 0;
  for (let i = 0; i < 7; i++) {
    avgByDay[i] = dayCount[i] > 0 ? byDay[i] / dayCount[i] : 0;
    totalQty += byDay[i];
  }

  return {
    byDay: avgByDay,
    totalQty,
    weeklyAvg: totalQty / weeks,
    dailyAvg: totalQty / (weeks * 7)
  };
}

function generateSuggestions() {
  const today = new Date();
  const todayDay = today.getDay();
  const suggestions = [];

  items.forEach(item => {
    const history = getConsumptionHistory(item.id, 4);
    const expectedToday = history.byDay[todayDay] || 0;

    // Calcular dias até próxima entrega possível
    const nextDelivery = getNextBusinessDay(today);
    const daysToDelivery = Math.ceil((nextDelivery - today) / (1000 * 60 * 60 * 24));

    // Estimar consumo até a entrega
    let estimatedConsumption = 0;
    for (let d = 0; d < daysToDelivery; d++) {
      const checkDay = new Date(today);
      checkDay.setDate(checkDay.getDate() + d);
      estimatedConsumption += history.byDay[checkDay.getDay()] || 0;
    }

    const minStock = item.minStock || 0;
    const currentStock = item.currentStock || 0;
    const neededStock = Math.ceil(estimatedConsumption) + minStock;

    if (currentStock < neededStock && expectedToday > 0) {
      const suggestedQty = Math.max(1, Math.ceil(neededStock - currentStock + (history.weeklyAvg * 0.2))); // 20% buffer
      suggestions.push({
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        unit: item.unit,
        currentStock,
        minStock,
        suggestedQty,
        expectedToday: Math.round(expectedToday * 10) / 10,
        daysToDelivery,
        reason: currentStock <= minStock
          ? 'Estoque abaixo do mínimo'
          : `Consumo estimado de ${Math.ceil(estimatedConsumption)} ${item.unit} até a próxima entrega`
      });
    }
  });

  // Ordenar por urgência (menor razão estoque/mínimo)
  suggestions.sort((a, b) => {
    const ratioA = a.minStock > 0 ? a.currentStock / a.minStock : a.currentStock;
    const ratioB = b.minStock > 0 ? b.currentStock / b.minStock : b.currentStock;
    return ratioA - ratioB;
  });

  return suggestions;
}

// ============================================================
// DETECÇÃO DE ANOMALIAS
// ============================================================
function detectAnomalies() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayDay = today.getDay();
  const anomalies = [];

  items.forEach(item => {
    // Consumo de hoje
    const todayConsumption = movements
      .filter(m => m.itemId === item.id && m.type === 'saida' && m.timestamp >= today && m.timestamp < tomorrow)
      .reduce((sum, m) => sum + (m.quantity || 0), 0);

    if (todayConsumption === 0) return;

    // Média histórica para este dia da semana
    const history = getConsumptionHistory(item.id, 4);
    const avgForToday = history.byDay[todayDay] || 0;

    if (avgForToday > 0 && todayConsumption > avgForToday * 1.5) {
      const percentAbove = Math.round(((todayConsumption - avgForToday) / avgForToday) * 100);
      // Verificar se já tem justificativa
      const todayMoves = movements.filter(m =>
        m.itemId === item.id && m.type === 'saida' && m.timestamp >= today && m.timestamp < tomorrow
      );
      const existingNote = todayMoves.find(m => m.anomalyNote)?.anomalyNote || '';

      anomalies.push({
        itemId: item.id,
        itemName: item.name,
        todayQty: todayConsumption,
        avgQty: Math.round(avgForToday * 10) / 10,
        percentAbove,
        unit: item.unit,
        existingNote
      });
    }
  });

  return anomalies;
}



// ============================================================
// NAVEGAÇÃO
// ============================================================
function switchTab(tabName) {
  currentTab = tabName;
  Object.values(DOM.sections).forEach(s => s?.classList.add('hidden'));
  DOM.sections[tabName]?.classList.remove('hidden');

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('nav-active', btn.dataset.tab === tabName);
  });

  // FAB só aparece na aba Estoque
  if (DOM.fabAddItem) {
    DOM.fabAddItem.classList.toggle('hidden', tabName !== 'estoque');
  }

  // Renderizar conteúdo da aba ativa
  if (tabName === 'inicio') renderDashboard();
  else if (tabName === 'estoque') renderStockGrid();
  else if (tabName === 'sugestoes') renderSuggestions();
  else if (tabName === 'relatorios') renderCharts();
  else if (tabName === 'historico') renderHistory();
}

function renderCurrentView() {
  if (currentTab === 'inicio') renderDashboard();
  else if (currentTab === 'estoque') renderStockGrid();
  else if (currentTab === 'sugestoes') renderSuggestions();
  else if (currentTab === 'relatorios') renderCharts();
  else if (currentTab === 'historico') renderHistory();
}

// ============================================================
// RENDERIZAR GRID DE ESTOQUE
// ============================================================
function getExpiryStatus(lots) {
  if (!lots || lots.length === 0) return { date: null, daysLeft: Infinity, status: 'ok', text: 'Sem lote' };
  const validLots = lots.filter(l => l.expiryDate);
  if (validLots.length === 0) return { date: null, daysLeft: Infinity, status: 'ok', text: 'Sem validade' };

  validLots.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  const nearest = validLots[0];
  const days = daysUntil(nearest.expiryDate);

  if (days < 0) return { date: nearest.expiryDate, daysLeft: days, status: 'expired', text: `Vencido há ${Math.abs(days)}d`, lotNumber: nearest.lotNumber };
  if (days <= 30) return { date: nearest.expiryDate, daysLeft: days, status: 'critical', text: `Vence em ${days}d`, lotNumber: nearest.lotNumber };
  if (days <= 60) return { date: nearest.expiryDate, daysLeft: days, status: 'warning', text: `Vence em ${days}d`, lotNumber: nearest.lotNumber };
  return { date: nearest.expiryDate, daysLeft: days, status: 'ok', text: `Vence em ${days}d`, lotNumber: nearest.lotNumber };
}

function getStockLevel(current, min) {
  if (current === 0) return { class: 'text-red-700 bg-red-50', label: 'ZERADO' };
  if (current <= min) return { class: 'text-red-600 bg-red-50', label: 'CRÍTICO' };
  if (current <= min * 2) return { class: 'text-amber-600 bg-amber-50', label: 'BAIXO' };
  return { class: 'text-emerald-600 bg-emerald-50', label: 'OK' };
}

function renderStockGrid() {
  if (!DOM.stockGrid) return;
  const searchTerm = (DOM.stockSearch?.value || '').toLowerCase().trim();
  const categoryFilter = DOM.stockFilterCategory?.value || '';
  const sortBy = DOM.stockSort?.value || 'name';

  let filtered = items.filter(item => {
    const matchName = !searchTerm || item.name.toLowerCase().includes(searchTerm);
    const matchCat = !categoryFilter || item.category === categoryFilter;
    return matchName && matchCat;
  });

  // Ordenação
  filtered.sort((a, b) => {
    if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
    if (sortBy === 'stock-asc') return (a.currentStock || 0) - (b.currentStock || 0);
    if (sortBy === 'expiry') {
      const expA = getExpiryStatus(a.lots);
      const expB = getExpiryStatus(b.lots);
      return (expA.daysLeft === Infinity ? 99999 : expA.daysLeft) - (expB.daysLeft === Infinity ? 99999 : expB.daysLeft);
    }
    return 0;
  });

  if (filtered.length === 0) {
    DOM.stockGrid.innerHTML = `
      <div class="col-span-full text-center py-12">
        <svg class="w-16 h-16 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
        <p class="text-slate-400 font-medium">${searchTerm || categoryFilter ? 'Nenhum item encontrado com esses filtros' : 'Nenhum item cadastrado'}</p>
        ${!searchTerm && !categoryFilter ? '<p class="text-sm text-slate-400 mt-1">Toque no botão + para adicionar</p>' : ''}
      </div>`;
    return;
  }

  DOM.stockGrid.innerHTML = filtered.map(item => {
    const catColor = CATEGORY_COLORS[item.category] || CATEGORY_COLORS['Outros'];
    const expiry = getExpiryStatus(item.lots);
    const stockLevel = getStockLevel(item.currentStock || 0, item.minStock || 0);
    const lots = item.lots || [];
    const nearestLot = lots.length > 0 ? lots.sort((a, b) => (a.expiryDate || 'z').localeCompare(b.expiryDate || 'z'))[0] : null;

    const expiryBadgeClass = expiry.status === 'expired' || expiry.status === 'critical'
      ? 'badge-critical' : expiry.status === 'warning' ? 'badge-warning' : 'badge-ok';

    return `
    <div class="card-item" data-item-id="${item.id}">
      ${item.photo
        ? `<img src="${item.photo}" alt="${item.name}" class="item-photo" loading="lazy">`
        : `<div class="item-photo-placeholder">
            <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
          </div>`
      }
      <div class="p-3">
        <div class="flex items-start justify-between mb-1.5">
          <h3 class="font-semibold text-sm text-slate-800 leading-tight flex-1 mr-2">${item.name}</h3>
          <span class="badge ${catColor.bg} ${catColor.text} flex-shrink-0">${item.category}</span>
        </div>

        <div class="flex items-center gap-2 mb-2">
          <div class="flex items-center gap-1 px-2 py-1 rounded-lg ${stockLevel.class} text-xs font-bold">
            <span class="text-lg leading-none">${item.currentStock || 0}</span>
            <span>${item.unit || 'un'}</span>
          </div>
          <span class="text-xs text-slate-400">mín: ${item.minStock || 0}</span>
          <span class="text-xs font-semibold ${stockLevel.class.split(' ')[0]}">${stockLevel.label}</span>
        </div>

        ${nearestLot ? `
        <div class="flex items-center gap-2 mb-2 text-xs">
          ${nearestLot.lotNumber ? `<span class="text-slate-500">Lote: ${nearestLot.lotNumber}</span>` : ''}
          ${expiry.date ? `<span class="badge ${expiryBadgeClass}">${expiry.text}</span>` : ''}
        </div>` : ''}

        <div class="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100">
          <button class="qty-btn qty-btn-sub flex-1" data-action="subtract-1" data-item-id="${item.id}" title="Retirar 1">-1</button>
          <button class="qty-btn qty-btn-sub flex-1 text-xs" data-action="subtract-5" data-item-id="${item.id}" title="Retirar 5">-5</button>
          <button class="qty-btn qty-btn-custom flex-1 text-xs" data-action="custom-out" data-item-id="${item.id}" title="Quantidade personalizada">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
          </button>
          <button class="qty-btn qty-btn-add flex-1" data-action="add" data-item-id="${item.id}" title="Repor estoque">+</button>
          <button class="qty-btn bg-slate-100 text-slate-500 hover:bg-slate-200" data-action="edit" data-item-id="${item.id}" title="Editar">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button class="qty-btn bg-red-50 text-red-400 hover:bg-red-100" data-action="delete" data-item-id="${item.id}" title="Excluir">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ============================================================
// RENDERIZAR DASHBOARD (INÍCIO)
// ============================================================
function renderDashboard() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Data atual
  if (DOM.dashboardDate) {
    DOM.dashboardDate.textContent = `${getDayName(today)}, ${formatDate(today)}`;
  }

  // Estatísticas
  const lowStockCount = items.filter(i => (i.currentStock || 0) <= (i.minStock || 0)).length;
  const expiringCount = items.filter(i => {
    const exp = getExpiryStatus(i.lots);
    return exp.daysLeft <= 60;
  }).length;
  const todayMoves = movements.filter(m => m.timestamp >= today && m.timestamp < tomorrow).length;

  if (DOM.statTotalItems) DOM.statTotalItems.textContent = items.length;
  if (DOM.statLowStock) DOM.statLowStock.textContent = lowStockCount;
  if (DOM.statExpiring) DOM.statExpiring.textContent = expiringCount;
  if (DOM.statMovementsToday) DOM.statMovementsToday.textContent = todayMoves;

  // Alertas de anomalia
  renderAnomalyAlerts();

  // Alertas de validade
  renderExpiryAlerts();

  // Movimentações recentes
  renderRecentMovements();
}

function renderAnomalyAlerts() {
  if (!DOM.anomalyAlerts) return;
  const anomalies = detectAnomalies();

  if (anomalies.length === 0) {
    DOM.anomalyAlerts.innerHTML = '';
    return;
  }

  DOM.anomalyAlerts.innerHTML = anomalies.map(a => `
    <div class="alert-banner alert-banner-warning mb-2">
      <span class="text-xl flex-shrink-0">📊</span>
      <div class="flex-1">
        <p class="text-sm font-semibold mb-1">Consumo atípico: ${a.itemName}</p>
        <p class="text-xs mb-2">Hoje: ${a.todayQty} ${a.unit} | Média: ${a.avgQty} ${a.unit} | <strong>+${a.percentAbove}% acima</strong></p>
        <div class="flex items-center gap-2">
          <input type="text" class="anomaly-justify-input flex-1 text-xs px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50/50 placeholder:text-amber-400"
            placeholder="Motivo do desvio (opcional): ex. aumento de internações" data-item-id="${a.itemId}" value="${a.existingNote}">
          <button class="text-xs bg-amber-700 text-white px-3 py-1.5 rounded-lg hover:bg-amber-800 transition font-medium anomaly-save-btn" data-item-id="${a.itemId}">Salvar</button>
        </div>
      </div>
    </div>
  `).join('');
}

function renderExpiryAlerts() {
  if (!DOM.expiryAlerts) return;
  const expiringItems = items.filter(i => {
    const exp = getExpiryStatus(i.lots);
    return exp.daysLeft <= 60;
  }).sort((a, b) => {
    const expA = getExpiryStatus(a.lots);
    const expB = getExpiryStatus(b.lots);
    return expA.daysLeft - expB.daysLeft;
  });

  if (expiringItems.length === 0) {
    DOM.expiryAlerts.innerHTML = '';
    return;
  }

  DOM.expiryAlerts.innerHTML = `
    <div class="bg-white rounded-2xl shadow-sm p-4 mb-2">
      <h3 class="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
        <svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
        Itens com Validade Próxima (PVPS)
      </h3>
      <div class="space-y-2">
        ${expiringItems.map(item => {
          const exp = getExpiryStatus(item.lots);
          const badgeClass = exp.status === 'expired' || exp.status === 'critical' ? 'badge-critical' : 'badge-warning';
          return `
          <div class="flex items-center justify-between py-2 px-3 rounded-lg ${exp.status === 'expired' || exp.status === 'critical' ? 'bg-red-50' : 'bg-amber-50'}">
            <div>
              <span class="text-sm font-medium text-slate-800">${item.name}</span>
              ${exp.lotNumber ? `<span class="text-xs text-slate-500 ml-2">Lote: ${exp.lotNumber}</span>` : ''}
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-slate-500">${exp.date ? formatDate(exp.date) : ''}</span>
              <span class="badge ${badgeClass}">${exp.text}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

function renderRecentMovements() {
  if (!DOM.recentMovements) return;
  const recent = movements.slice(0, 5);

  if (recent.length === 0) {
    DOM.recentMovements.innerHTML = '<p class="text-sm text-slate-400 py-4 text-center">Nenhuma movimentação registrada ainda.</p>';
    return;
  }

  DOM.recentMovements.innerHTML = recent.map(m => {
    const isOut = m.type === 'saida';
    return `
    <div class="history-item">
      <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isOut ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${isOut ? 'M17 13l-5 5m0 0l-5-5m5 5V6' : 'M7 11l5-5m0 0l5 5m-5-5v12'}"/>
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-slate-800 truncate">${m.itemName}</p>
        <p class="text-xs text-slate-500">${m.responsible || '-'} · ${m.shift || '-'}</p>
      </div>
      <div class="text-right flex-shrink-0">
        <span class="text-sm font-bold ${isOut ? 'text-red-600' : 'text-emerald-600'}">${isOut ? '-' : '+'}${m.quantity}</span>
        <p class="text-xs text-slate-400">${formatDateTime(m.timestamp)}</p>
      </div>
    </div>`;
  }).join('');
}

// ============================================================
// SUGESTÕES DE PEDIDO
// ============================================================
function renderSuggestions() {
  if (!DOM.suggestionsList) return;
  const suggestions = generateSuggestions();

  const todayStr = formatDateISO(new Date());
  const activeSuggestions = suggestions.filter(s =>
    showDismissed || !dismissedSuggestions.some(d => d.itemId === s.itemId && d.date === todayStr)
  );

  const hasDismissed = suggestions.some(s =>
    dismissedSuggestions.some(d => d.itemId === s.itemId && d.date === todayStr)
  );

  if (DOM.btnShowDismissed) {
    DOM.btnShowDismissed.classList.toggle('hidden', !hasDismissed);
    DOM.btnShowDismissed.textContent = showDismissed ? 'Ocultar dispensadas' : 'Mostrar ocultadas';
  }

  if (activeSuggestions.length === 0) {
    DOM.suggestionsList.innerHTML = `
      <div class="text-center py-12">
        <svg class="w-16 h-16 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <p class="text-slate-400 font-medium">Sem sugestões para hoje</p>
        <p class="text-sm text-slate-400 mt-1">O estoque está adequado para o consumo esperado.</p>
      </div>`;
    return;
  }

  DOM.suggestionsList.innerHTML = activeSuggestions.map(s => {
    const isDismissed = dismissedSuggestions.some(d => d.itemId === s.itemId && d.date === todayStr);
    return `
    <div class="suggestion-card mb-3 ${isDismissed ? 'dismissed' : ''}">
      <div class="flex items-start justify-between mb-2">
        <div>
          <h4 class="font-semibold text-slate-800">${s.itemName}</h4>
          <span class="badge badge-info">${s.category}</span>
        </div>
        <button class="dismiss-suggestion-btn text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition" data-item-id="${s.itemId}" title="${isDismissed ? 'Restaurar' : 'Dispensar'}">
          ${isDismissed
            ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>'
            : '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>'
          }
        </button>
      </div>
      <div class="grid grid-cols-3 gap-2 text-center mb-2">
        <div class="bg-slate-50 rounded-lg p-2">
          <span class="text-lg font-bold text-slate-800">${s.currentStock}</span>
          <span class="text-xs text-slate-500 block">${s.unit} atual</span>
        </div>
        <div class="bg-hospital-50 rounded-lg p-2">
          <span class="text-lg font-bold text-hospital-700">${s.suggestedQty}</span>
          <span class="text-xs text-hospital-600 block">${s.unit} pedir</span>
        </div>
        <div class="bg-amber-50 rounded-lg p-2">
          <span class="text-lg font-bold text-amber-700">${s.expectedToday}</span>
          <span class="text-xs text-amber-600 block">${s.unit}/dia</span>
        </div>
      </div>
      <p class="text-xs text-slate-500">📌 ${s.reason} · Próx. entrega em ${s.daysToDelivery} dia(s)</p>
    </div>`;
  }).join('');
}

function dismissSuggestion(itemId) {
  const todayStr = formatDateISO(new Date());
  const idx = dismissedSuggestions.findIndex(d => d.itemId === itemId && d.date === todayStr);
  if (idx >= 0) {
    dismissedSuggestions.splice(idx, 1);
  } else {
    dismissedSuggestions.push({ itemId, date: todayStr });
  }
  localStorage.setItem('dismissedSuggestions', JSON.stringify(dismissedSuggestions));
  renderSuggestions();
}

// ============================================================
// HISTÓRICO
// ============================================================
function renderHistory() {
  if (!DOM.historyList) return;

  let filtered = [...movements];
  const startDate = DOM.historyDateStart?.value;
  const endDate = DOM.historyDateEnd?.value;
  const typeFilter = DOM.historyTypeFilter?.value;

  if (startDate) {
    const start = new Date(startDate + 'T00:00:00');
    filtered = filtered.filter(m => m.timestamp >= start);
  }
  if (endDate) {
    const end = new Date(endDate + 'T23:59:59');
    filtered = filtered.filter(m => m.timestamp <= end);
  }
  if (typeFilter) {
    filtered = filtered.filter(m => m.type === typeFilter);
  }

  if (filtered.length === 0) {
    DOM.historyList.innerHTML = '<p class="text-sm text-slate-400 py-8 text-center">Nenhuma movimentação encontrada.</p>';
    return;
  }

  DOM.historyList.innerHTML = filtered.slice(0, movementsLimit).map(m => {
    const isOut = m.type === 'saida';
    return `
    <div class="history-item">
      <div class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isOut ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${isOut ? 'M17 13l-5 5m0 0l-5-5m5 5V6' : 'M7 11l5-5m0 0l5 5m-5-5v12'}"/>
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-slate-800 truncate">${m.itemName}</span>
          <span class="badge ${isOut ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}">${isOut ? 'Saída' : 'Entrada'}</span>
        </div>
        <p class="text-xs text-slate-500 mt-0.5">
          👤 ${m.responsible || '-'} · ${m.shift || '-'} · ${getDayName(m.timestamp)}
          ${m.lotNumber ? ` · Lote: ${m.lotNumber}` : ''}
        </p>
        ${m.anomalyNote ? `<p class="text-xs text-amber-600 mt-0.5">📝 ${m.anomalyNote}</p>` : ''}
      </div>
      <div class="text-right flex-shrink-0">
        <span class="text-base font-bold ${isOut ? 'text-red-600' : 'text-emerald-600'}">${isOut ? '-' : '+'}${m.quantity}</span>
        <p class="text-xs text-slate-400 mt-0.5">${formatDateTime(m.timestamp)}</p>
      </div>
    </div>`;
  }).join('');

  if (DOM.btnLoadMore) {
    DOM.btnLoadMore.classList.toggle('hidden', filtered.length <= movementsLimit);
  }
}

function exportHistory() {
  let filtered = [...movements];
  const startDate = DOM.historyDateStart?.value;
  const endDate = DOM.historyDateEnd?.value;
  const typeFilter = DOM.historyTypeFilter?.value;

  if (startDate) filtered = filtered.filter(m => m.timestamp >= new Date(startDate + 'T00:00:00'));
  if (endDate) filtered = filtered.filter(m => m.timestamp <= new Date(endDate + 'T23:59:59'));
  if (typeFilter) filtered = filtered.filter(m => m.type === typeFilter);

  if (filtered.length === 0) {
    showToast('Nenhum dado para exportar.', 'warning');
    return;
  }

  const headers = ['Data/Hora', 'Dia', 'Item', 'Tipo', 'Qtd', 'Lote', 'Responsável', 'Turno', 'Observação'];
  const rows = filtered.map(m => [
    formatDateTime(m.timestamp),
    getDayName(m.timestamp),
    m.itemName,
    m.type === 'saida' ? 'Saída' : 'Entrada',
    m.quantity,
    m.lotNumber || '',
    m.responsible || '',
    m.shift || '',
    m.anomalyNote || ''
  ]);

  const csvContent = '\uFEFF' + [headers, ...rows].map(r => r.map(c => `"${c}"`).join(';')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `historico_estoque_${formatDateISO(new Date())}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('Histórico exportado com sucesso!', 'success');
}

// ============================================================
// RELATÓRIOS / GRÁFICOS (CHART.JS)
// ============================================================
function renderCharts() {
  renderABCChart();
  renderMonthlyChart();
}

function renderABCChart() {
  if (!DOM.chartABCCanvas) return;
  const categoryFilter = DOM.reportCategoryFilter?.value || '';

  // Filtrar movimentações de saída
  let filtered = movements.filter(m => m.type === 'saida');
  if (categoryFilter) {
    const catItems = items.filter(i => i.category === categoryFilter).map(i => i.id);
    filtered = filtered.filter(m => catItems.includes(m.itemId));
  }

  // Agrupar por item
  const byItem = {};
  filtered.forEach(m => {
    byItem[m.itemName] = (byItem[m.itemName] || 0) + m.quantity;
  });

  const sorted = Object.entries(byItem).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    if (chartABC) { chartABC.destroy(); chartABC = null; }
    return;
  }

  const total = sorted.reduce((s, [, v]) => s + v, 0);
  let cumulative = 0;
  const labels = [];
  const data = [];
  const cumulativeData = [];
  const bgColors = [];

  sorted.forEach(([name, qty]) => {
    cumulative += qty;
    const pct = (cumulative / total) * 100;
    labels.push(name.length > 15 ? name.substring(0, 15) + '...' : name);
    data.push(qty);
    cumulativeData.push(Math.round(pct * 10) / 10);

    if (pct <= 80) bgColors.push('#059669');
    else if (pct <= 95) bgColors.push('#D97706');
    else bgColors.push('#DC2626');
  });

  if (chartABC) chartABC.destroy();
  chartABC = new Chart(DOM.chartABCCanvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Quantidade',
          data,
          backgroundColor: bgColors,
          borderRadius: 6,
          order: 2
        },
        {
          label: '% Acumulada',
          data: cumulativeData,
          type: 'line',
          borderColor: '#0891B2',
          backgroundColor: 'rgba(8,145,178,0.1)',
          borderWidth: 2,
          pointRadius: 3,
          fill: false,
          yAxisID: 'y1',
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: 'Quantidade' } },
        y1: { position: 'right', min: 0, max: 100, title: { display: true, text: '% Acumulada' },
          grid: { drawOnChartArea: false },
          ticks: { callback: v => v + '%' }
        },
        x: { ticks: { maxRotation: 45, minRotation: 0, font: { size: 11 } } }
      },
      plugins: {
        legend: { position: 'top', labels: { usePointStyle: true, padding: 15 } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if (ctx.dataset.label === '% Acumulada') return `${ctx.dataset.label}: ${ctx.parsed.y}%`;
              return `${ctx.dataset.label}: ${ctx.parsed.y} un`;
            }
          }
        }
      }
    }
  });
}

function renderMonthlyChart() {
  if (!DOM.chartMonthlyCanvas) return;
  const categoryFilter = DOM.reportCategoryFilter?.value || '';

  let filtered = movements.filter(m => m.type === 'saida');
  if (categoryFilter) {
    const catItems = items.filter(i => i.category === categoryFilter).map(i => i.id);
    filtered = filtered.filter(m => catItems.includes(m.itemId));
  }

  // Agrupar por mês (últimos 6 meses)
  const monthlyData = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyData[key] = { total: 0, byCategory: {} };
  }

  filtered.forEach(m => {
    const d = m.timestamp;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (monthlyData[key]) {
      monthlyData[key].total += m.quantity;
      const item = items.find(i => i.id === m.itemId);
      const cat = item?.category || 'Outros';
      monthlyData[key].byCategory[cat] = (monthlyData[key].byCategory[cat] || 0) + m.quantity;
    }
  });

  const labels = Object.keys(monthlyData).map(k => {
    const [y, m] = k.split('-');
    return MONTHS_PT[parseInt(m) - 1]?.substring(0, 3) + '/' + y.substring(2);
  });

  if (chartMonthly) chartMonthly.destroy();

  if (categoryFilter) {
    // Gráfico simples para uma categoria
    const data = Object.values(monthlyData).map(v => v.total);
    chartMonthly = new Chart(DOM.chartMonthlyCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: categoryFilter,
          data,
          backgroundColor: '#0891B2',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true } },
        plugins: { legend: { display: false } }
      }
    });
  } else {
    // Stacked por categoria
    const categories = ['Descartáveis', 'Curativos', 'EPIs', 'Medicamentos', 'Outros'];
    const catColors = ['#3B82F6', '#8B5CF6', '#F59E0B', '#059669', '#94A3B8'];
    const datasets = categories.map((cat, idx) => ({
      label: cat,
      data: Object.values(monthlyData).map(v => v.byCategory[cat] || 0),
      backgroundColor: catColors[idx],
      borderRadius: 4
    }));

    chartMonthly = new Chart(DOM.chartMonthlyCanvas, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
        plugins: { legend: { position: 'top', labels: { usePointStyle: true, padding: 12, font: { size: 11 } } } }
      }
    });
  }
}

// ============================================================
// MODAIS
// ============================================================
function openItemModal(itemId = null) {
  if (itemId) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    DOM.modalTitle.textContent = 'Editar Item';
    DOM.itemId.value = item.id;
    DOM.itemName.value = item.name || '';
    DOM.itemCategory.value = item.category || 'Descartáveis';
    DOM.itemUnit.value = item.unit || 'un';
    DOM.itemStock.value = item.currentStock || 0;
    DOM.itemMinStock.value = item.minStock || 0;
    const lots = item.lots || [];
    DOM.itemLot.value = lots.length > 0 ? lots[0].lotNumber || '' : '';
    DOM.itemExpiry.value = lots.length > 0 ? lots[0].expiryDate || '' : '';
    if (item.photo) {
      DOM.photoPreview.src = item.photo;
      DOM.photoPreview.classList.remove('hidden');
      DOM.photoPlaceholder?.classList.add('hidden');
    } else {
      DOM.photoPreview.classList.add('hidden');
      DOM.photoPreview.src = '';
      DOM.photoPlaceholder?.classList.remove('hidden');
    }
  } else {
    DOM.modalTitle.textContent = 'Novo Item';
    DOM.itemForm.reset();
    DOM.itemId.value = '';
    DOM.photoPreview.classList.add('hidden');
    DOM.photoPreview.src = '';
    DOM.photoPlaceholder?.classList.remove('hidden');
  }
  DOM.modalOverlay.classList.add('modal-active');
}

function closeItemModal() {
  DOM.modalOverlay.classList.remove('modal-active');
  DOM.itemForm.reset();
  DOM.itemId.value = '';
  DOM.photoPreview.classList.add('hidden');
  DOM.photoPreview.src = '';
  DOM.photoPlaceholder?.classList.remove('hidden');
}

function openQtyModal(itemId, type) {
  const item = items.find(i => i.id === itemId);
  if (!item) return;
  DOM.qtyItemId.value = itemId;
  DOM.qtyType.value = type;
  DOM.qtyItemName.textContent = item.name;
  DOM.qtyModalTitle.textContent = type === 'saida' ? 'Retirar do Estoque' : 'Repor Estoque';
  DOM.qtyAmount.value = 1;
  DOM.modalQtyOverlay.classList.add('modal-active');
  setTimeout(() => DOM.qtyAmount.focus(), 100);
}

function closeQtyModal() {
  DOM.modalQtyOverlay.classList.remove('modal-active');
}

async function handleSaveItem() {
  const name = DOM.itemName.value.trim();
  if (!name) {
    showToast('Informe o nome do item.', 'error');
    return;
  }

  const itemData = {
    name,
    category: DOM.itemCategory.value,
    unit: DOM.itemUnit.value,
    currentStock: parseInt(DOM.itemStock.value) || 0,
    minStock: parseInt(DOM.itemMinStock.value) || 0,
    lots: []
  };

  // Montar lote
  const lotNumber = DOM.itemLot.value.trim();
  const expiryDate = DOM.itemExpiry.value;
  if (lotNumber || expiryDate) {
    itemData.lots.push({
      lotNumber: lotNumber,
      expiryDate: expiryDate,
      quantity: itemData.currentStock
    });
  }

  // Foto
  const photoFile = DOM.itemPhoto.files[0];
  if (photoFile) {
    try {
      itemData.photo = await compressPhoto(photoFile);
    } catch (err) {
      console.error('Erro ao comprimir foto:', err);
      showToast('Erro ao processar foto.', 'warning');
    }
  } else if (DOM.itemId.value) {
    // Manter foto existente no modo edição
    const existing = items.find(i => i.id === DOM.itemId.value);
    if (existing?.photo) itemData.photo = existing.photo;
  }

  if (DOM.itemId.value) {
    itemData.id = DOM.itemId.value;
    // Manter lotes existentes no modo edição, se não alterou
    const existing = items.find(i => i.id === DOM.itemId.value);
    if (existing?.lots && existing.lots.length > 0 && !lotNumber && !expiryDate) {
      itemData.lots = existing.lots;
    }
  }

  await saveItem(itemData);
  closeItemModal();
}

async function handleQtyConfirm() {
  const itemId = DOM.qtyItemId.value;
  const type = DOM.qtyType.value;
  const amount = parseInt(DOM.qtyAmount.value);

  if (!amount || amount <= 0) {
    showToast('Informe uma quantidade válida.', 'error');
    return;
  }

  if (type === 'saida') {
    await quickSubtract(itemId, amount);
  } else {
    await quickAdd(itemId, amount);
  }
  closeQtyModal();
}

// ============================================================
// STATUS DE CONEXÃO E PWA
// ============================================================
function updateConnectionStatus() {
  isOnline = navigator.onLine;
  if (!DOM.connectionStatus) return;

  if (isOnline) {
    DOM.connectionStatus.className = 'status-online flex items-center gap-1.5 text-xs font-medium';
    DOM.connectionStatus.innerHTML = '<span class="pulse-dot"></span><span class="status-text text-emerald-700">Online</span>';
  } else {
    DOM.connectionStatus.className = 'status-offline flex items-center gap-1.5 text-xs font-medium';
    DOM.connectionStatus.innerHTML = '<span class="pulse-dot"></span><span class="status-text text-red-600">Offline — sincronizará ao reconectar</span>';
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registrado:', reg.scope))
      .catch(err => console.warn('Falha ao registrar SW:', err));
  }
}

function handleInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (DOM.pwaInstallBanner) DOM.pwaInstallBanner.classList.remove('hidden');
  });
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function setupEventListeners() {
  // Navegação
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Responsável e Turno
  DOM.btnSaveShift?.addEventListener('click', () => {
    localStorage.setItem('responsible', DOM.inputResponsible.value.trim());
    localStorage.setItem('shift', DOM.selectShift.value);
    showToast(`Turno salvo: ${DOM.inputResponsible.value.trim() || 'Sem nome'} — ${DOM.selectShift.value}`, 'success');
  });

  DOM.inputResponsible?.addEventListener('blur', () => {
    localStorage.setItem('responsible', DOM.inputResponsible.value.trim());
  });

  DOM.selectShift?.addEventListener('change', () => {
    localStorage.setItem('shift', DOM.selectShift.value);
  });

  // Busca e filtros de estoque
  DOM.stockSearch?.addEventListener('input', debounce(() => renderStockGrid(), 300));
  DOM.stockFilterCategory?.addEventListener('change', () => renderStockGrid());
  DOM.stockSort?.addEventListener('change', () => renderStockGrid());

  // Event delegation no grid de estoque
  DOM.stockGrid?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const itemId = btn.dataset.itemId;

    switch (action) {
      case 'subtract-1':
        await quickSubtract(itemId, 1);
        break;
      case 'subtract-5':
        await quickSubtract(itemId, 5);
        break;
      case 'custom-out':
        openQtyModal(itemId, 'saida');
        break;
      case 'add':
        openQtyModal(itemId, 'entrada');
        break;
      case 'edit':
        openItemModal(itemId);
        break;
      case 'delete':
        if (confirm('Tem certeza que deseja excluir este item?')) {
          await deleteItem(itemId);
        }
        break;
    }
  });

  // Modal Item
  DOM.fabAddItem?.addEventListener('click', () => openItemModal());
  DOM.btnCloseModal?.addEventListener('click', closeItemModal);
  DOM.btnCancelItem?.addEventListener('click', closeItemModal);
  DOM.modalOverlay?.addEventListener('click', (e) => {
    if (e.target === DOM.modalOverlay) closeItemModal();
  });

  DOM.itemForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSaveItem();
  });

  // Preview de foto
  DOM.itemPhoto?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const compressed = await compressPhoto(file);
        DOM.photoPreview.src = compressed;
        DOM.photoPreview.classList.remove('hidden');
        DOM.photoPlaceholder?.classList.add('hidden');
      } catch {
        showToast('Erro ao carregar foto.', 'error');
      }
    }
  });

  // Modal Quantidade
  DOM.btnCancelQty?.addEventListener('click', closeQtyModal);
  DOM.btnConfirmQty?.addEventListener('click', handleQtyConfirm);
  DOM.modalQtyOverlay?.addEventListener('click', (e) => {
    if (e.target === DOM.modalQtyOverlay) closeQtyModal();
  });

  // Enter no campo de quantidade
  DOM.qtyAmount?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleQtyConfirm();
  });

  // Relatórios
  DOM.reportMonthFilter?.addEventListener('change', () => renderCharts());
  DOM.reportCategoryFilter?.addEventListener('change', () => renderCharts());

  // Histórico
  DOM.historyDateStart?.addEventListener('change', () => renderHistory());
  DOM.historyDateEnd?.addEventListener('change', () => renderHistory());
  DOM.historyTypeFilter?.addEventListener('change', () => renderHistory());
  DOM.btnExportHistory?.addEventListener('click', exportHistory);
  DOM.btnLoadMore?.addEventListener('click', () => {
    movementsLimit += 50;
    renderHistory();
  });

  // Sugestões
  DOM.suggestionsList?.addEventListener('click', (e) => {
    const btn = e.target.closest('.dismiss-suggestion-btn');
    if (btn) {
      dismissSuggestion(btn.dataset.itemId);
    }
  });
  DOM.btnShowDismissed?.addEventListener('click', () => {
    showDismissed = !showDismissed;
    renderSuggestions();
  });

  // Anomalias (event delegation)
  DOM.anomalyAlerts?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.anomaly-save-btn');
    if (btn) {
      const itemId = btn.dataset.itemId;
      const input = DOM.anomalyAlerts.querySelector(`.anomaly-justify-input[data-item-id="${itemId}"]`);
      if (input) {
        await saveAnomalyNote(itemId, input.value.trim());
      }
    }
  });

  // Conexão
  window.addEventListener('online', () => {
    updateConnectionStatus();
    showToast('Conexão restaurada! Sincronizando dados...', 'success');
  });
  window.addEventListener('offline', () => {
    updateConnectionStatus();
    showToast('Sem conexão. Os dados serão salvos localmente.', 'warning');
  });

  // PWA Install
  DOM.btnPwaInstall?.addEventListener('click', async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const result = await deferredInstallPrompt.userChoice;
      if (result.outcome === 'accepted') {
        showToast('App instalado com sucesso!', 'success');
      }
      deferredInstallPrompt = null;
      DOM.pwaInstallBanner?.classList.add('hidden');
    }
  });
  DOM.btnPwaDismiss?.addEventListener('click', () => {
    DOM.pwaInstallBanner?.classList.add('hidden');
  });
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================
async function initApp() {
  // Cachear referências do DOM
  cacheDOMRefs();

  // Carregar responsável e turno salvos
  const savedResponsible = localStorage.getItem('responsible');
  const savedShift = localStorage.getItem('shift');
  if (savedResponsible && DOM.inputResponsible) DOM.inputResponsible.value = savedResponsible;
  if (savedShift && DOM.selectShift) DOM.selectShift.value = savedShift;

  // Status de conexão
  updateConnectionStatus();

  // Service Worker
  registerServiceWorker();

  // Prompt de instalação PWA
  handleInstallPrompt();

  // Configurar event listeners
  setupEventListeners();

  // Iniciar listeners do Firestore
  subscribeToItems();
  subscribeToMovements();

  // Carregar feriados (async, sem bloquear)
  loadHolidays().catch(err => console.warn('Falha ao carregar feriados:', err));

  // Iniciar na aba Início
  switchTab('inicio');

  // Limpar sugestões expiradas (manter só as de hoje)
  const todayStr = formatDateISO(new Date());
  dismissedSuggestions = dismissedSuggestions.filter(d => d.date === todayStr);
  localStorage.setItem('dismissedSuggestions', JSON.stringify(dismissedSuggestions));

  console.log('✅ Sistema de Estoque Hospitalar inicializado com sucesso!');
}

// Iniciar o aplicativo quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
