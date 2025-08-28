document.addEventListener('DOMContentLoaded', () => {
  // Sections
  const form = document.querySelector('.quiz-form');
  const welcome = document.getElementById('welcome');
  const quiz = document.getElementById('quiz');
  const complete = document.getElementById('complete');

  // Quiz DOM
  const questionText = document.getElementById('question-text');
  const optionsList = document.getElementById('options-list');
  const nextBtn = document.getElementById('next-btn');

  // Timer DOM (header)
  const timeLabel = document.getElementById('time-label');      // shows mm:ss
  const timebarFill = document.getElementById('timebar-fill');  // progress fill div
  const questionCountEl = document.getElementById('question-count'); // shows "2/10"

  // Completion DOM
  const scoreText = document.getElementById('score-text');
  const retakeBtn = document.getElementById('retake-btn');
  const scoreMsg = document.getElementById('score-message');

  // Rules modal DOM (ensure the modal markup is present in HTML)
  const rulesLink = document.querySelector('.rules-link');
  const rulesModal = document.getElementById('rules-modal');
  const modalBackdrop = rulesModal ? rulesModal.querySelector('.modal-backdrop') : null;
  const modalCloseBtn = rulesModal ? rulesModal.querySelector('.modal-close') : null;

  // State
  let questions = [];
  let currentIndex = 0;
  let correctCount = 0;
  let revealedForCurrent = false;

  let timeoutId = null;  // moves to next question at end of time
  let intervalId = null; // updates timer label + bar
  let lastFocus = null;  // modal focus restore

  // Utilities
  function clearTimers() {
    clearTimeout(timeoutId);
    clearInterval(intervalId);
    timeoutId = null;
    intervalId = null;
  }

  function fmt(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function resetRunState() {
    clearTimers();
    questions = [];
    currentIndex = 0;
    correctCount = 0;
    revealedForCurrent = false;

    questionText.textContent = '';
    optionsList.classList.remove('options-locked');
    optionsList.innerHTML = '';

    if (timeLabel) timeLabel.textContent = '00:00';
    if (timebarFill) timebarFill.style.width = '0%';
    if (questionCountEl) questionCountEl.textContent = '';
  }

  function updateQuestionCount(i, total) {
    if (!questionCountEl) return;
    const current = Math.min(i + 1, total);
    questionCountEl.textContent = `${current}/${total}`;
  }

  // Reveal + scoring
  function revealAnswer(q) {
    optionsList.classList.add('options-locked');

    const selected = optionsList.querySelector('input[name="answer"]:checked');
    const selectedVal = selected ? selected.value : null;
    const correctVal = q.correctAnswer; // "A" | "B" | "C" | "D"

    const correctLabel = optionsList.querySelector(`label.option[data-value="${correctVal}"]`);
    if (correctLabel) correctLabel.classList.add('correct');

    if (selectedVal && selectedVal !== correctVal) {
      const wrongLabel = optionsList.querySelector(`label.option[data-value="${selectedVal}"]`);
      if (wrongLabel) wrongLabel.classList.add('incorrect');
    }

    if (!revealedForCurrent) {
      if (selectedVal && selectedVal === correctVal) {
        correctCount += 1;
      }
      revealedForCurrent = true;
    }
  }

  // Render a question
  function renderQuestion(i) {
    const q = questions[i];
    if (!q) {
      showComplete();
      return false;
    }

    revealedForCurrent = false;

    // Update question count
    updateQuestionCount(i, questions.length);

    // Reset timer UI
    const initial = Number.isFinite(q.timeLimit) ? q.timeLimit : 10;
    if (timeLabel) timeLabel.textContent = fmt(initial);
    if (timebarFill) timebarFill.style.width = '0%';

    // Question text
    questionText.textContent = q.question;

    // Options
    optionsList.classList.remove('options-locked');
    optionsList.innerHTML = '';
    q.options.forEach((opt, idx) => {
      const id = `opt-${q.id}-${idx}`;
      const value = opt.charAt(0); // extract letter prefix
      const li = document.createElement('li');
      li.innerHTML = `
        <label class="option topic" data-value="${value}" for="${id}">
          <input type="radio" name="answer" id="${id}" value="${value}">
          ${opt}
        </label>
      `;
      optionsList.appendChild(li);
    });

    return true;
  }

  // bar and auto-advance
  function scheduleAdvance() {
    const q = questions[currentIndex];
    const totalSeconds = Number.isFinite(q?.timeLimit) ? q.timeLimit : 10;
    const totalMs = Math.max(1, totalSeconds) * 1000;

    if (timeLabel) timeLabel.textContent = fmt(totalSeconds);
    if (timebarFill) timebarFill.style.width = '0%';

    clearInterval(intervalId);
    let elapsedMs = 0;
    const stepMs = 50; // 20 fps for smooth bar

    intervalId = setInterval(() => {
      elapsedMs += stepMs;
      const remaining = Math.max(0, totalMs - elapsedMs);
      const remainingSec = Math.ceil(remaining / 1000);
      if (timeLabel) timeLabel.textContent = fmt(remainingSec);

      const pct = Math.min(100, (elapsedMs / totalMs) * 100);
      if (timebarFill) timebarFill.style.width = `${pct}%`;

      if (elapsedMs >= totalMs) {
        clearInterval(intervalId);
      }
    }, stepMs);

    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      // Reveal if not revealed yet
      if (!optionsList.classList.contains('options-locked')) {
        revealAnswer(q);
      }
      // short pause to show colors
      setTimeout(() => {
        currentIndex += 1;
        if (renderQuestion(currentIndex)) {
          scheduleAdvance();
        } else {
          clearTimers();
        }
      }, 800);
    }, totalMs);
  }

  // Immediate feedback on selection (optional)
  optionsList.addEventListener('change', (e) => {
    const input = e.target;
    if (input && input.name === 'answer') {
      if (!optionsList.classList.contains('options-locked')) {
        revealAnswer(questions[currentIndex]);
      }
    }
  });

  // Next button support (optional)
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      clearTimers();
      const q = questions[currentIndex];
      if (q && !optionsList.classList.contains('options-locked')) {
        revealAnswer(q);
      }
      setTimeout(() => {
        currentIndex += 1;
        if (renderQuestion(currentIndex)) {
          scheduleAdvance();
        } else {
          clearTimers();
        }
      }, 400);
    });
  }

  // Completion
  function showComplete() {
    const total = questions.length || 1;
    const percent = Math.round((correctCount / total) * 100);
    if (scoreText) scoreText.textContent = `${percent}%`;

    // Performance message
    let msg = '';
    let color = 'black';
    if (percent > 80) {
      msg = 'Great job! Score above 80%.';
      color = 'rgba(6, 175, 82, 1)';
    } else if (percent >= 60) {
      msg = 'Well done! Score between 60% and 80%.';
      color = 'rgba(155, 189, 5, 1)';
    } else {
      msg = 'Keep practicing! Score below 60%.';
      color = 'rgba(175, 155, 6, 1)';
    }
    if (scoreMsg) {
        scoreMsg.style.color = color;
        scoreMsg.textContent = msg
    };

    quiz.classList.add('hidden');
    complete.classList.remove('hidden');

    clearTimers();
    if (timeLabel) timeLabel.textContent = '00:00';
    if (timebarFill) timebarFill.style.width = '0%';
  }

  // Retake
  if (retakeBtn) {
    retakeBtn.addEventListener('click', () => {
      complete.classList.add('hidden');
      welcome.classList.remove('hidden');
      resetRunState();
      form.reset();
    });
  }

  // Modal helpers
  function openModal(modalEl) {
    if (!modalEl) return;
    lastFocus = document.activeElement;
    modalEl.classList.remove('hidden');
    modalEl.setAttribute('aria-hidden', 'false');
    const focusTarget = modalEl.querySelector('.modal-close') || modalEl;
    focusTarget.focus();
    document.documentElement.style.overflow = 'hidden';
  }

  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.add('hidden');
    modalEl.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    if (lastFocus && typeof lastFocus.focus === 'function') {
      lastFocus.focus();
    }
  }

  // Open/close rules modal
  rulesLink?.addEventListener('click', (e) => {
    e.preventDefault();
    openModal(rulesModal);
  });
  modalBackdrop?.addEventListener('click', (e) => {
    // Click on backdrop closes
    if (e.target === modalBackdrop || e.target.dataset.close !== undefined) {
      closeModal(rulesModal);
    }
  });
  modalCloseBtn?.addEventListener('click', () => closeModal(rulesModal));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && rulesModal && !rulesModal.classList.contains('hidden')) {
      closeModal(rulesModal);
    }
  });

  // Start flow
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const topic = new FormData(form).get('topic');

    // Prep UI
    resetRunState();
    welcome.classList.add('hidden');
    complete.classList.add('hidden');
    quiz.classList.remove('hidden');

    // Load questions.json (must be served via http(s), not file://)
    let data;
    try {
      const res = await fetch('./questions.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (err) {
      console.error('Failed to load questions.json', err);
      questionText.textContent = 'Failed to load questions.';
      return;
    }

    // Map selected radio value to category id (adjust to actual JSON)
    const topicToCategory = {
      js: 'js_basics',
      angular: 'angular_basics',
      react: 'react_advanced',
      flutter: 'flutter_basics'
    };
    const categoryId = topicToCategory[topic] || 'js_basics';

    const category = data.categories.find(c => c.id === categoryId);
    if (!category || !Array.isArray(category.questions) || category.questions.length === 0) {
      questionText.textContent = 'No questions available for this topic.';
      return;
    }

    // Initialize questions
    questions = category.questions.slice();
    currentIndex = 0;
    correctCount = 0;

    // Render first and start timer
    if (renderQuestion(currentIndex)) {
      scheduleAdvance();
    }
  });
});
