const STORAGE_KEY = "studyflow-data-v1";

const defaultData = {
  tasks: [
    { id: 1, title: "مراجعة 10 كلمات بالإنجليزية", subject: "English", done: false },
    { id: 2, title: "حل تمرين فرنسي", subject: "French", done: false },
    { id: 3, title: "مراجعة درس العربية", subject: "Arabic", done: false }
  ],
  focusMinutes: 0,
  streak: 1,
  lastStudyDate: new Date().toISOString().slice(0, 10),
  dark: false
};

let data = loadData();
let currentFilter = "all";
let timer = { total: 25 * 60, remaining: 25 * 60, running: false, interval: null };

const $ = id => document.getElementById(id);

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved ? { ...defaultData, ...saved } : structuredClone(defaultData);
  } catch {
    return structuredClone(defaultData);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function formatDate() {
  return new Intl.DateTimeFormat("ar-DZ", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  }).format(new Date());
}

function updateClock() {
  $("clock").textContent = new Date().toLocaleTimeString("ar-DZ", {
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
}

function render() {
  renderTasks();
  updateStats();
  renderSubjectStats();
  document.body.classList.toggle("dark", data.dark);
  $("themeBtn").textContent = data.dark ? "☀️ الوضع الفاتح" : "🌙 الوضع الليلي";
}

function renderTasks() {
  const visible = data.tasks.filter(task =>
    currentFilter === "all" ? true : currentFilter === "active" ? !task.done : task.done
  );

  const html = visible.length ? visible.map(taskTemplate).join("") :
    `<div class="empty muted">لا توجد مهام هنا حاليًا.</div>`;

  $("allTasks").innerHTML = html;
  $("dashboardTasks").innerHTML = data.tasks.slice(0, 5).map(taskTemplate).join("") ||
    `<div class="empty muted">أضف أول مهمة لك.</div>`;

  document.querySelectorAll(".check").forEach(btn => {
    btn.onclick = () => toggleTask(Number(btn.dataset.id));
  });
  document.querySelectorAll(".delete-task").forEach(btn => {
    btn.onclick = () => deleteTask(Number(btn.dataset.id));
  });
}

function taskTemplate(task) {
  return `
    <div class="task-item">
      <button class="check ${task.done ? "done" : ""}" data-id="${task.id}" aria-label="تغيير حالة المهمة">
        ${task.done ? "✓" : ""}
      </button>
      <div class="task-main">
        <div class="task-title ${task.done ? "done" : ""}">${escapeHtml(task.title)}</div>
        <div class="task-subject">${escapeHtml(task.subject)}</div>
      </div>
      <button class="delete-task" data-id="${task.id}" aria-label="حذف">×</button>
    </div>`;
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[ch]));
}

function toggleTask(id) {
  const task = data.tasks.find(t => t.id === id);
  if (!task) return;
  const wasDone = task.done;
  task.done = !task.done;
  if (!wasDone && task.done) updateStreak();
  saveData();
  render();
}

function deleteTask(id) {
  data.tasks = data.tasks.filter(t => t.id !== id);
  saveData();
  render();
}

function updateStreak() {
  const today = new Date().toISOString().slice(0, 10);
  if (data.lastStudyDate === today) return;

  const previous = new Date(data.lastStudyDate);
  const now = new Date(today);
  const diff = Math.round((now - previous) / 86400000);

  data.streak = diff === 1 ? data.streak + 1 : 1;
  data.lastStudyDate = today;
}

function updateStats() {
  const total = data.tasks.length;
  const completed = data.tasks.filter(t => t.done).length;
  const percent = total ? Math.round((completed / total) * 100) : 0;

  $("completedCount").textContent = completed;
  $("totalCount").textContent = total;
  $("focusMinutes").textContent = data.focusMinutes;
  $("streak").textContent = data.streak;
  $("statTotal").textContent = total;
  $("statCompleted").textContent = completed;
  $("statFocus").textContent = data.focusMinutes;
  $("statPercent").textContent = percent + "%";

  const subject = data.tasks.find(t => !t.done)?.subject || data.tasks[0]?.subject || "—";
  $("activeSubject").textContent = subject;

  $("progressPercent").textContent = percent + "%";
  $("progressRing").style.background =
    `conic-gradient(#fff ${percent * 3.6}deg, rgba(255,255,255,.2) 0deg)`;
}

function renderSubjectStats() {
  const subjects = {};
  data.tasks.forEach(t => {
    if (!subjects[t.subject]) subjects[t.subject] = { total: 0, done: 0 };
    subjects[t.subject].total++;
    if (t.done) subjects[t.subject].done++;
  });

  $("subjectStats").innerHTML = Object.keys(subjects).length ?
    Object.entries(subjects).map(([name, value]) => {
      const p = Math.round(value.done / value.total * 100);
      return `
        <div class="progress-row">
          <div class="progress-label">
            <span>${escapeHtml(name)}</span><b>${p}%</b>
          </div>
          <div class="bar"><span style="width:${p}%"></span></div>
        </div>`;
    }).join("") :
    `<p class="muted">أضف مهامًا لتظهر إحصائيات المواد.</p>`;
}

function showSection(id) {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active-section"));
  $(id).classList.add("active-section");
  document.querySelectorAll(".nav-item").forEach(n =>
    n.classList.toggle("active", n.dataset.section === id)
  );
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll(".nav-item").forEach(btn => {
  btn.onclick = () => showSection(btn.dataset.section);
});
document.querySelectorAll("[data-go]").forEach(btn => {
  btn.onclick = () => showSection(btn.dataset.go);
});

$("taskForm").onsubmit = e => {
  e.preventDefault();
  const title = $("taskInput").value.trim();
  if (!title) return;
  data.tasks.unshift({
    id: Date.now(),
    title,
    subject: $("subjectInput").value,
    done: false
  });
  $("taskInput").value = "";
  saveData();
  render();
};

document.querySelectorAll(".filter").forEach(btn => {
  btn.onclick = () => {
    currentFilter = btn.dataset.filter;
    document.querySelectorAll(".filter").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    renderTasks();
  };
});

$("themeBtn").onclick = () => {
  data.dark = !data.dark;
  saveData();
  render();
};

$("resetBtn").onclick = () => {
  if (!confirm("هل تريد حذف جميع بيانات لوحة الدراسة؟")) return;
  data = structuredClone(defaultData);
  saveData();
  stopTimer();
  resetTimer(25);
  render();
};

function updateTimerDisplay() {
  const mins = Math.floor(timer.remaining / 60).toString().padStart(2, "0");
  const secs = (timer.remaining % 60).toString().padStart(2, "0");
  $("mainTimer").textContent = `${mins}:${secs}`;
  $("miniTimer").textContent = `${mins}:${secs}`;
}

function startTimer() {
  if (timer.running) {
    stopTimer();
    return;
  }
  timer.running = true;
  $("startPause").textContent = "⏸ إيقاف";
  $("timerStatus").textContent = "أنت في جلسة تركيز الآن...";

  timer.interval = setInterval(() => {
    timer.remaining--;
    updateTimerDisplay();

    if (timer.remaining <= 0) {
      stopTimer();
      data.focusMinutes += Math.round(timer.total / 60);
      saveData();
      render();
      alert("أحسنت! انتهت جلسة التركيز 🎉");
      resetTimer(Math.round(timer.total / 60));
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(timer.interval);
  timer.interval = null;
  timer.running = false;
  $("startPause").textContent = "▶ بدء";
}

function resetTimer(minutes) {
  stopTimer();
  timer.total = minutes * 60;
  timer.remaining = timer.total;
  $("timerStatus").textContent = "جاهز للتركيز";
  updateTimerDisplay();
}

$("startPause").onclick = startTimer;
$("resetTimer").onclick = () => resetTimer(Math.round(timer.total / 60));

document.querySelectorAll(".mode").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".mode").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    resetTimer(Number(btn.dataset.minutes));
  };
});

$("greeting").textContent = "مرحبًا بك في StudyFlow 👋";
$("todayText").textContent = formatDate();
setInterval(updateClock, 1000);
updateClock();
render();
