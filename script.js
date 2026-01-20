console.log("script.js carregou ✅");

// 🔑 SUAS CHAVES
const SUPABASE_URL = "https://lkpdemmxodcpczxrlkyh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-l1AF3pexmQYwIGBbRd-sQ_wkYq-pUm";

// ✅ cria o client sem redeclarar `supabase`
window.__supabaseClient =
  window.__supabaseClient ||
  window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 👉 NOME DIFERENTE (IMPORTANTE)
const supabaseClient = window.__supabaseClient;

const el = (id) => document.getElementById(id);

// ===== Helpers =====
const money = (n) =>
  (Number(n) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

function monthRange(d = new Date()) {
  const year = d.getFullYear();
  const month = d.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);

  const iso = (x) => x.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

// ===== UI =====
function showApp() {
  el("auth").classList.add("hidden");
  el("app").classList.remove("hidden");
  el("addTransaction").classList.add("hidden");
}

function showAuth() {
  el("auth").classList.remove("hidden");
  el("app").classList.add("hidden");
  el("addTransaction").classList.add("hidden");
}

function showAddTransaction() {
  el("auth").classList.add("hidden");
  el("app").classList.add("hidden");
  el("addTransaction").classList.remove("hidden");
}

// ===== Charts =====
let pieChart, lineChart, barChart;

// ===== AUTH =====
el("btnSignUp").onclick = async () => {
  const email = el("email").value.trim();
  const password = el("password").value.trim();

  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) return alert("Erro: " + error.message);

  alert("Conta criada! Agora clique em Entrar.");
};

el("btnSignIn").onclick = async () => {
  const email = el("email").value.trim();
  const password = el("password").value.trim();

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return alert("Erro: " + error.message);

  showApp();
  await loadDashboardAndList();
};

el("btnSignOut").onclick = async () => {
  await supabaseClient.auth.signOut();
  showAuth();
};

el("btnSignOut2").onclick = async () => {
  await supabaseClient.auth.signOut();
  showAuth();
};

// Navegação entre telas
el("btnAddTransaction").onclick = () => {
  showAddTransaction();
  loadAllTransactions();
  initializeTransactionForm();
};

el("btnBackToDashboard").onclick = () => {
  showApp();
  loadDashboardAndList();
};

// Inicializa o formulário de transação
function initializeTransactionForm() {
  // Seletores de tipo de transação
  const typeOptions = document.querySelectorAll('.type-option');
  const typeInput = el('type');
  
  typeOptions.forEach(option => {
    option.addEventListener('click', () => {
      typeOptions.forEach(opt => opt.classList.remove('active'));
      option.classList.add('active');
      typeInput.value = option.dataset.type;
    });
  });
  
  // Seletores de método de pagamento
  const paymentOptions = document.querySelectorAll('.payment-option');
  const paymentInput = el('paymentMethod');
  
  paymentOptions.forEach(option => {
    option.addEventListener('click', () => {
      paymentOptions.forEach(opt => opt.classList.remove('active'));
      option.classList.add('active');
      paymentInput.value = option.dataset.method;
    });
  });
  
  // Gerenciamento de categorias
  const categorySelect = el('categorySelect');
  const categoryInput = el('category');
  
  if (categorySelect && categoryInput) {
    categorySelect.addEventListener('change', (e) => {
      if (e.target.value === 'custom') {
        categoryInput.style.display = 'block';
        categoryInput.focus();
        categoryInput.value = '';
      } else if (e.target.value) {
        categoryInput.style.display = 'none';
        categoryInput.value = e.target.value;
      } else {
        categoryInput.style.display = 'none';
        categoryInput.value = '';
      }
    });
  }
  
  // Define valores padrão
  document.querySelector('.type-option[data-type="expense"]').classList.add('active');
  document.querySelector('.payment-option[data-method="dinheiro"]').classList.add('active');
  
  // Define data atual
  const today = new Date().toISOString().split('T')[0];
  el('date').value = today;
  
  // Carrega categorias existentes
  loadCategories();
}

// ===== APP (Form) =====
el("formTx").onsubmit = async (e) => {
  e.preventDefault();

  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  if (!user) return alert("Você precisa estar logado.");

  const payload = {
    user_id: user.id,
    date: el("date").value,
    type: el("type").value,
    category: el("category").value.trim(),
    amount: Number(el("amount").value),
    payment_method: el("paymentMethod").value,
  };

  const { error } = await supabaseClient.from("transactions").insert(payload);

  if (error) return alert("Erro ao salvar: " + error.message);

  // Reset form
  el("category").value = '';
  el("amount").value = '';
  el("description").value = '';
  el("categorySelect").value = '';
  el("category").style.display = 'none';
  
  // Adiciona nova categoria ao conjunto se for personalizada
  if (payload.category && !categories.has(payload.category)) {
    categories.add(payload.category);
    updateCategorySelect();
  }
  
  // Reset seletores visuais
  document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('active'));
  document.querySelectorAll('.payment-option').forEach(opt => opt.classList.remove('active'));
  document.querySelector('.type-option[data-type="expense"]').classList.add('active');
  document.querySelector('.payment-option[data-method="dinheiro"]').classList.add('active');
  
  alert("Transação salva com sucesso!");
  await loadAllTransactions();
};

// ===== Dashboard + Lista =====
async function loadDashboardAndList() {
  // 1) Dados do mês atual (pra dashboard)
  const { start, end } = monthRange();

  const { data: monthRows, error: monthErr } = await supabaseClient
    .from("transactions")
    .select("*")
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: true }); // ascending pra saldo acumulado

  if (monthErr) return alert("Erro ao carregar (mês): " + monthErr.message);

  // 2) Lista completa (pra exibir lançamentos, pode ser só mês também se quiser)
  const { data: allRows, error: listErr } = await supabaseClient
    .from("transactions")
    .select("*")
    .order("date", { ascending: false });

  if (listErr) return alert("Erro ao carregar (lista): " + listErr.message);

  renderList(allRows || []);
  renderDashboard(monthRows || []);
  await renderLast6MonthsBar();
}

function renderList(rows) {
  const listEl = el("list");
  if (!rows.length) {
    listEl.innerHTML = '<li class="no-data"><i class="fas fa-info-circle"></i> Nenhum registro encontrado</li>';
    return;
  }
  
  // Mostra apenas os últimos 5 registros no dashboard
  const recentRows = rows.slice(0, 5);
  
  listEl.innerHTML = recentRows
    .map((d) => {
      const typeIcon = d.type === "income" ? "fas fa-arrow-up income" : "fas fa-arrow-down expense";
      const typeText = d.type === "income" ? "Receita" : "Despesa";
      return `
        <li class="transaction-item">
          <div class="transaction-info">
            <div class="transaction-header">
              <i class="${typeIcon}"></i>
              <span class="transaction-type">${typeText}</span>
              <span class="transaction-date">${new Date(d.date).toLocaleDateString('pt-BR')}</span>
            </div>
            <div class="transaction-details">
              <span class="transaction-category">${d.category}</span>
              <span class="transaction-amount ${d.type}">${money(d.amount)}</span>
            </div>
          </div>
        </li>
      `;
    })
    .join("");
}

// Nova função para carregar todas as transações na tela de adicionar
async function loadAllTransactions() {
  const { data: allRows, error } = await supabaseClient
    .from("transactions")
    .select("*")
    .order("date", { ascending: false });

  if (error) return alert("Erro ao carregar transações: " + error.message);

  renderAllTransactionsList(allRows || []);
}

function renderAllTransactionsList(rows) {
  const listEl = el("allTransactionsList");
  if (!rows.length) {
    listEl.innerHTML = '<li class="no-data"><i class="fas fa-info-circle"></i> Nenhuma transação encontrada</li>';
    return;
  }
  
  listEl.innerHTML = rows
    .map((d) => {
      const typeIcon = d.type === "income" ? "fas fa-arrow-up income" : "fas fa-arrow-down expense";
      const typeText = d.type === "income" ? "Receita" : "Despesa";
      const paymentIcon = getPaymentIcon(d.payment_method);
      return `
        <li class="transaction-item">
          <div class="transaction-info">
            <div class="transaction-header">
              <i class="${typeIcon}"></i>
              <span class="transaction-type">${typeText}</span>
              <span class="payment-method">
                <i class="${paymentIcon}"></i>
                ${formatPaymentMethod(d.payment_method)}
              </span>
              <span class="transaction-date">${new Date(d.date).toLocaleDateString('pt-BR')}</span>
            </div>
            <div class="transaction-details">
              <span class="transaction-category">${d.category}</span>
              <span class="transaction-amount ${d.type}">${money(d.amount)}</span>
            </div>
          </div>
          <button class="btn-delete" data-id="${d.id}" title="Excluir transação">
            <i class="fas fa-trash"></i>
          </button>
        </li>
      `;
    })
    .join("");
    
  // Adiciona event listeners para os botões de excluir
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      await deleteTransaction(id);
    });
  });
}

function getPaymentIcon(method) {
  const icons = {
    'dinheiro': 'fas fa-money-bill-wave',
    'pix': 'fas fa-qrcode',
    'debito': 'fas fa-credit-card',
    'credito': 'fas fa-credit-card'
  };
  return icons[method] || 'fas fa-money-bill-wave';
}

function formatPaymentMethod(method) {
  const methods = {
    'dinheiro': 'Dinheiro',
    'pix': 'PIX',
    'debito': 'Débito',
    'credito': 'Crédito'
  };
  return methods[method] || 'Dinheiro';
}

// Gerenciamento de categorias
let categories = new Set();

async function loadCategories() {
  const { data: transactions, error } = await supabaseClient
    .from('transactions')
    .select('category')
    .not('category', 'is', null);
    
  if (!error && transactions) {
    categories = new Set(transactions.map(t => t.category).filter(Boolean));
    updateCategorySelect();
  }
}

function updateCategorySelect() {
  const categorySelect = el('categorySelect');
  if (!categorySelect) return;
  
  const sortedCategories = Array.from(categories).sort();
  
  categorySelect.innerHTML = `
    <option value="">Selecione uma categoria</option>
    ${sortedCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
    <option value="custom">+ Nova categoria</option>
  `;
}
async function deleteTransaction(id) {
  // Encontra o item da transação
  const transactionItem = document.querySelector(`[data-id="${id}"]`).closest('.transaction-item');
  
  // Adiciona animação de saída
  transactionItem.style.transform = 'translateX(-100%)';
  transactionItem.style.opacity = '0';
  
  // Aguarda a animação terminar
  setTimeout(async () => {
    const { error } = await supabaseClient
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) {
      // Reverte a animação em caso de erro
      transactionItem.style.transform = 'translateX(0)';
      transactionItem.style.opacity = '1';
      alert('Erro ao excluir: ' + error.message);
      return;
    }

    await loadAllTransactions();
  }, 300);
}

function renderDashboard(rows) {
  // Totais do mês
  const income = rows
    .filter((r) => r.type === "income")
    .reduce((s, r) => s + Number(r.amount), 0);

  const expense = rows
    .filter((r) => r.type === "expense")
    .reduce((s, r) => s + Number(r.amount), 0);

  const balance = income - expense;

  // Atualiza os cards do dashboard
  if (document.getElementById("incomeTotal"))
    el("incomeTotal").textContent = money(income);
  if (document.getElementById("expenseTotal"))
    el("expenseTotal").textContent = money(expense);
  if (document.getElementById("balanceTotal")) {
    const balanceEl = el("balanceTotal");
    balanceEl.textContent = money(balance);
    // Adiciona classe para cor baseada no saldo
    balanceEl.className = `value ${balance >= 0 ? 'positive' : 'negative'}`;
  }

  // ===== Gráfico 1: Pizza (gastos por categoria no mês) =====
  const byCat = {};
  rows
    .filter((r) => r.type === "expense")
    .forEach((r) => {
      const cat = r.category || "Sem categoria";
      byCat[cat] = (byCat[cat] || 0) + Number(r.amount);
    });

  const pieLabels = Object.keys(byCat);
  const pieValues = Object.values(byCat);
  const colors = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', 
    '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'
  ];

  // Calcula porcentagem do saldo restante
  const totalIncome = income || 1;
  const remainingBalance = income - expense;
  const remainingPercentage = Math.max(0, (remainingBalance / totalIncome) * 100);

  const pieCanvas = document.getElementById("pieChart");
  if (pieCanvas) {
    if (pieChart) pieChart.destroy();
    
    pieChart = new Chart(pieCanvas, {
      type: "doughnut",
      data: {
        labels: pieLabels.length ? pieLabels : ["Sem dados"],
        datasets: [{
          data: pieValues.length ? pieValues : [1],
          backgroundColor: colors,
          borderWidth: 0,
          cutout: '70%'
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { 
          legend: { 
            position: "bottom",
            labels: { color: '#e2e8f0', usePointStyle: true }
          }
        }
      },
      plugins: [{
        id: 'centerText',
        afterDraw: function(chart) {
          const ctx = chart.ctx;
          const width = chart.width;
          const height = chart.height;
          
          ctx.restore();
          ctx.font = 'bold 20px Inter';
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'center';
          
          const text = remainingPercentage.toFixed(0) + '%';
          const textX = width / 2;
          const textY = height / 2 - 5;
          
          ctx.fillStyle = remainingPercentage > 50 ? '#10b981' : remainingPercentage > 20 ? '#eab308' : '#ef4444';
          ctx.fillText(text, textX, textY);
          
          ctx.font = '10px Inter';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText('restante', textX, textY + 15);
          
          ctx.save();
        }
      }]
    });
  }

  // ===== Gráfico 2: Linha (saldo acumulado por dia no mês) =====
  const byDay = {};
  rows.forEach((r) => {
    const sign = r.type === "income" ? 1 : -1;
    byDay[r.date] = (byDay[r.date] || 0) + sign * Number(r.amount);
  });

  const days = Object.keys(byDay).sort();
  let acc = 0;
  const lineValues = days.map((d) => (acc += byDay[d]));

  const lineCanvas = document.getElementById("lineChart");
  if (lineCanvas) {
    if (lineChart) lineChart.destroy();
    lineChart = new Chart(lineCanvas, {
      type: "line",
      data: {
        labels: days.length ? days.map(d => new Date(d).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})) : ["Sem dados"],
        datasets: [{
          data: lineValues.length ? lineValues : [0],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 5
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { 
            ticks: { color: '#94a3b8' },
            grid: { color: 'rgba(148, 163, 184, 0.1)' }
          },
          y: { 
            ticks: { 
              color: '#94a3b8',
              callback: (v) => money(v)
            },
            grid: { color: 'rgba(148, 163, 184, 0.1)' }
          },
        },
      },
    });
  }
}

async function renderLast6MonthsBar() {
  // últimos 6 meses
  const now = new Date();
  const start6 = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const iso6 = start6.toISOString().slice(0, 10);

  const { data: rows6, error } = await supabaseClient
    .from("transactions")
    .select("*")
    .gte("date", iso6);

  if (error) return alert("Erro ao carregar (6 meses): " + error.message);

  const byMonth = {};
  (rows6 || [])
    .filter((r) => r.type === "expense")
    .forEach((r) => {
      const ym = r.date.slice(0, 7); // YYYY-MM
      byMonth[ym] = (byMonth[ym] || 0) + Number(r.amount);
    });

  const months = Object.keys(byMonth).sort();
  const monthVals = months.map((m) => byMonth[m]);
  const monthLabels = months.map(m => {
    const [year, month] = m.split('-');
    return new Date(year, month - 1).toLocaleDateString('pt-BR', {month: 'short', year: '2-digit'});
  });

  const barCanvas = document.getElementById("barChart");
  if (barCanvas) {
    if (barChart) barChart.destroy();
    barChart = new Chart(barCanvas, {
      type: "bar",
      data: {
        labels: monthLabels.length ? monthLabels : ["Sem dados"],
        datasets: [{
          data: monthVals.length ? monthVals : [0],
          backgroundColor: 'rgba(239, 68, 68, 0.8)',
          borderColor: '#ef4444',
          borderWidth: 1,
          borderRadius: 8,
          borderSkipped: false
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { 
            ticks: { color: '#94a3b8' },
            grid: { display: false }
          },
          y: { 
            ticks: { 
              color: '#94a3b8',
              callback: (v) => money(v)
            },
            grid: { color: 'rgba(148, 163, 184, 0.1)' }
          },
        },
      },
    });
  }
}

// ===== auto-login =====
(async function init() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (session) {
    showApp();
    await loadDashboardAndList();
  } else {
    showAuth();
  }
})();
