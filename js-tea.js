/* ===========================
   使用モデル
   gemini-2.0-flash（無料枠あり）
   ※ Google AI Studio で取得した APIキーを使用
   https://aistudio.google.com/app/apikey
=========================== */
const GEMINI_MODEL    = 'gemini-2.0-flash';   // ✅ 修正: gemini-3.5-flash は存在しないモデルでした
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/* ===========================
   フォームフィールド一覧
   ※ f-scores は削除（テストエントリーで管理）
=========================== */
const FIELD_IDS = [
  'f-name', 'f-grade', 'f-period',
  'f-comp',
  'f-attitude',
  'f-goal', 'f-concerns', 'f-notes',
];

/* ===========================
   テスト種類・実施時期の定義
=========================== */
const TEST_TYPES = ['定期テスト', '実力テスト', '模擬試験', '検定', '入試', 'その他'];

const PERIOD_OPTIONS_BY_TYPE = {
  '定期テスト': [
    '前期中間', '前期期末', '後期中間', '後期期末',
    '1学期中間', '1学期期末', '2学期中間', '2学期期末', '3学期末',
    'カスタム',
  ],
  '実力テスト': [
    '4月', '5月', '6月', '7月', '8月', '9月',
    '10月', '11月', '12月', '1月', '2月', '3月',
    'カスタム',
  ],
  '模擬試験': ['第1回', '第2回', '第3回', '第4回', '第5回', 'カスタム'],
  '検定':     ['第1回', '第2回', '第3回', 'カスタム'],
  '入試':     ['推薦', '一般', 'カスタム'],
  'その他':   ['カスタム'],
};

const DEFAULT_PERIOD_OPTIONS = [
  '前期中間', '前期期末', '後期中間', '後期期末',
  '第1回', '第2回', '第3回', 'カスタム',
];

function getPeriodOptions(type) {
  return PERIOD_OPTIONS_BY_TYPE[type] || DEFAULT_PERIOD_OPTIONS;
}

/* ===========================
   生徒データ管理
=========================== */
let studentCounter = 1;
let currentIndex   = 0;
let students       = [createStudent()];

function createTestEntry() {
  return { type: '', period: '', customPeriod: '', scores: '' };
}

function createStudent() {
  const num  = studentCounter++;
  const data = {};
  FIELD_IDS.forEach(id => { data[id] = ''; });
  data.subjects = [];
  data.tests    = [createTestEntry()]; // テスト結果を配列で管理
  return {
    id:          Date.now() + Math.random(),
    defaultName: `生徒 ${num}`,
    tabName:     `生徒 ${num}`,
    data,
    result: null,
  };
}

/* ===========================
   フォーム保存・復元
=========================== */
function saveCurrentForm() {
  const s = students[currentIndex];
  FIELD_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) s.data[id] = el.value;
  });
  s.data.subjects = [...selectedSubjects];
  s.data.tests    = collectTestEntries();
}

function restoreForm(s) {
  // テキスト・セレクトフィールドを復元
  FIELD_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = s.data[id] || '';
  });

  // 10段階スケールのUI復元
  updateScaleUI(s.data['f-comp'] || '');

  // 科目チップを復元
  selectedSubjects.clear();
  (s.data.subjects || []).forEach(v => selectedSubjects.add(v));
  document.querySelectorAll('#subjects .chip').forEach(chip => {
    chip.classList.toggle('selected', selectedSubjects.has(chip.dataset.val));
  });

  // テストエントリーを復元
  const tests = (s.data.tests && s.data.tests.length > 0)
    ? s.data.tests
    : [createTestEntry()];
  renderTestList(tests);

  // 診断結果パネルを復元
  if (s.result) {
    renderResult(s.result, buildFormData());
    showState('state-result');
  } else {
    showState('state-empty');
  }
}

/* ===========================
   タブ描画
=========================== */
function renderTabs() {
  const list = document.getElementById('tab-list');
  list.innerHTML = '';

  students.forEach((s, i) => {
    const tab = document.createElement('button');
    tab.className = 'tab-item' + (i === currentIndex ? ' active' : '');
    tab.setAttribute('data-idx', i);
    tab.type = 'button';
    tab.innerHTML = `
      <i class="ti ti-user-circle"></i>
      <span class="tab-label">${escapeHtml(s.tabName)}</span>
      ${students.length > 1
        ? `<span class="tab-close" data-idx="${i}" title="削除"><i class="ti ti-x"></i></span>`
        : ''}
    `;

    // タブ本体クリック → 切り替え
    tab.addEventListener('click', e => {
      if (e.target.closest('.tab-close')) return;
      switchTab(i);
    });

    // × ボタンクリック → 削除
    const closeBtn = tab.querySelector('.tab-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', e => {
        e.stopPropagation();
        removeStudent(i);
      });
    }

    list.appendChild(tab);
  });

  // アクティブタブが見えるようにスクロール
  const activeTab = list.querySelector('.tab-item.active');
  if (activeTab) {
    activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }
}

/* ===========================
   タブ操作
=========================== */
function switchTab(idx) {
  saveCurrentForm();
  currentIndex = idx;
  renderTabs();
  restoreForm(students[currentIndex]);
}

function addStudent() {
  saveCurrentForm();
  students.push(createStudent());
  currentIndex = students.length - 1;
  renderTabs();
  restoreForm(students[currentIndex]);

  // 追加後にリストを末尾へスクロール
  const list = document.getElementById('tab-list');
  setTimeout(() => { list.scrollLeft = list.scrollWidth; }, 50);
}

function removeStudent(idx) {
  if (students.length === 1) return;
  students.splice(idx, 1);
  if (currentIndex >= students.length) currentIndex = students.length - 1;
  renderTabs();
  restoreForm(students[currentIndex]);
}

/* ===========================
   ユーティリティ
=========================== */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ===========================
   エラー表示ヘルパー（✅ 追加: alert の代替）
=========================== */
function showInlineError(message) {
  const errEl = document.getElementById('state-error');
  errEl.innerHTML = `
    <div class="error-box">
      <i class="ti ti-alert-triangle"></i>
      <span>${message}</span>
    </div>
  `;
  showState('state-error');
}

/* ===========================
   10段階評価スケール
=========================== */
function updateScaleUI(val) {
  document.querySelectorAll('#comp-scale .scale-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.val === String(val));
  });
}

document.querySelectorAll('#comp-scale .scale-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const val = btn.dataset.val;
    document.getElementById('f-comp').value = val;
    updateScaleUI(val);
  });
});

/* ===========================
   科目チップの選択
=========================== */
const selectedSubjects = new Set();

document.querySelectorAll('#subjects .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const val = chip.dataset.val;
    if (selectedSubjects.has(val)) {
      selectedSubjects.delete(val);
      chip.classList.remove('selected');
    } else {
      selectedSubjects.add(val);
      chip.classList.add('selected');
    }
  });
});

/* ===========================
   生徒名変更でタブ名をリアルタイム更新
=========================== */
document.getElementById('f-name').addEventListener('input', e => {
  const name = e.target.value.trim();
  students[currentIndex].tabName = name || students[currentIndex].defaultName;
  // 再描画せずラベルだけ更新（スクロール位置を保持）
  const labels = document.querySelectorAll('#tab-list .tab-label');
  if (labels[currentIndex]) {
    labels[currentIndex].textContent = students[currentIndex].tabName;
  }
});

/* ===========================
   フォーム値を収集するヘルパー
=========================== */
function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function buildFormData() {
  const compVal = getVal('f-comp');

  // テストエントリーをAIプロンプト用テキストに変換
  const tests       = collectTestEntries();
  const filledTests = tests.filter(t => t.scores || t.type);
  let scoresText    = '未入力';

  if (filledTests.length > 0) {
    scoresText = filledTests.map((t, i) => {
      const parts  = [];
      if (t.type) parts.push(t.type);
      const period = t.period === 'カスタム' ? (t.customPeriod || '') : t.period;
      if (period) parts.push(period);
      const label  = parts.length > 0 ? `[${parts.join(' ')}]` : `[テスト${i + 1}]`;
      return t.scores ? `${label} ${t.scores}` : label;
    }).join('\n');
  }

  return {
    name:     getVal('f-name')     || '未入力',
    grade:    getVal('f-grade')    || '未入力',
    period:   getVal('f-period')   || '未入力',
    subjects: [...selectedSubjects].join('、') || '未入力',
    scores:   scoresText,
    comp:     compVal ? `${compVal} / 10` : '未入力',
    attitude: getVal('f-attitude') || '未入力',
    goal:     getVal('f-goal')     || '未入力',
    concerns: getVal('f-concerns') || '未入力',
    notes:    getVal('f-notes')    || '未入力',
  };
}

/* ===========================
   状態切り替え
=========================== */
function showState(id) {
  ['state-empty', 'state-loading', 'state-error', 'state-result'].forEach(s => {
    document.getElementById(s).style.display = (s === id) ? '' : 'none';
  });
}

/* ===========================
   テストエントリー管理
=========================== */

/** テストリスト全体を再描画 */
function renderTestList(tests) {
  const list = document.getElementById('test-list');
  list.innerHTML = '';
  tests.forEach((t, i) => list.appendChild(createTestEntryElement(t, i)));
}

/** 1件のテストエントリー要素を生成してイベントをバインドする */
function createTestEntryElement(test, idx) {
  const div      = document.createElement('div');
  div.className  = 'test-entry';

  const periodOpts = getPeriodOptions(test.type);
  const isCustom   = test.period === 'カスタム';

  // ✅ 修正: chip ボタンに type="button" を追加（フォーム誤送信防止）
  div.innerHTML = `
    <div class="test-entry-header">
      <span class="test-entry-num">テスト ${idx + 1}</span>
      <button class="test-remove-btn" type="button" title="このテストを削除">
        <i class="ti ti-trash"></i>
      </button>
    </div>

    <div class="test-field">
      <label class="test-field-label">試験の種類</label>
      <div class="chip-group test-type-chips">
        ${TEST_TYPES.map(t =>
          `<button type="button" class="chip${t === test.type ? ' selected' : ''}" data-val="${escapeHtml(t)}">${escapeHtml(t)}</button>`
        ).join('')}
      </div>
    </div>

    <div class="test-field">
      <label class="test-field-label">実施時期</label>
      <select class="test-period-select">
        <option value="">選択してください</option>
        ${periodOpts.map(p =>
          `<option value="${escapeHtml(p)}"${p === test.period ? ' selected' : ''}>${escapeHtml(p)}</option>`
        ).join('')}
      </select>
      <input
        type="text"
        class="test-period-custom"
        placeholder="例：2025年6月"
        value="${escapeHtml(test.customPeriod || '')}"
        style="display:${isCustom ? '' : 'none'}"
      >
    </div>

    <div class="test-field">
      <label class="test-field-label">点数・結果</label>
      <textarea class="test-scores" placeholder="例：数学 75点、英語 82点">${escapeHtml(test.scores || '')}</textarea>
    </div>
  `;

  // ── 試験の種類チップ ──
  div.querySelectorAll('.test-type-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      div.querySelectorAll('.test-type-chips .chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');

      // 実施時期のオプションを種類に合わせて更新
      const newOpts = getPeriodOptions(chip.dataset.val);
      const sel     = div.querySelector('.test-period-select');
      sel.innerHTML = `<option value="">選択してください</option>` +
        newOpts.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');

      // カスタム入力を非表示にリセット
      div.querySelector('.test-period-custom').style.display = 'none';
      div.querySelector('.test-period-custom').value = '';
    });
  });

  // ── 実施時期セレクト ──
  div.querySelector('.test-period-select').addEventListener('change', function () {
    const customEl = div.querySelector('.test-period-custom');
    customEl.style.display = this.value === 'カスタム' ? '' : 'none';
    if (this.value !== 'カスタム') customEl.value = '';
  });

  // ── 削除ボタン ──
  div.querySelector('.test-remove-btn').addEventListener('click', () => {
    const list = document.getElementById('test-list');
    div.remove();
    renumberTestEntries();
    // 全件削除された場合は空のエントリーを自動追加
    if (!list.querySelector('.test-entry')) {
      list.appendChild(createTestEntryElement(createTestEntry(), 0));
    }
  });

  return div;
}

/** DOM からテストエントリーデータを収集する */
function collectTestEntries() {
  const entries = [];
  document.querySelectorAll('#test-list .test-entry').forEach(entryEl => {
    const typeChip     = entryEl.querySelector('.test-type-chips .chip.selected');
    const type         = typeChip ? typeChip.dataset.val : '';
    const period       = entryEl.querySelector('.test-period-select')?.value || '';
    const customPeriod = entryEl.querySelector('.test-period-custom')?.value.trim() || '';
    const scores       = entryEl.querySelector('.test-scores')?.value.trim() || '';
    entries.push({ type, period, customPeriod, scores });
  });
  return entries;
}

/** エントリーを削除した後に番号を振り直す */
function renumberTestEntries() {
  document.querySelectorAll('#test-list .test-entry').forEach((el, i) => {
    const numEl = el.querySelector('.test-entry-num');
    if (numEl) numEl.textContent = `テスト ${i + 1}`;
  });
}

// テスト追加ボタン
document.getElementById('test-add-btn').addEventListener('click', () => {
  const list   = document.getElementById('test-list');
  const newIdx = list.querySelectorAll('.test-entry').length;
  list.appendChild(createTestEntryElement(createTestEntry(), newIdx));

  // 追加したエントリーが見えるようにスクロール
  const panel = document.getElementById('form-panel');
  setTimeout(() => {
    panel.scrollTo({ top: panel.scrollHeight, behavior: 'smooth' });
  }, 50);
});

/* ===========================
   AI診断レポートを生成する
=========================== */
document.getElementById('gen-btn').addEventListener('click', async () => {
  // ✅ 修正: alert() の代わりにページ内エラー表示（alert はブラウザ環境によってブロックされる場合がある）
  const apiKey = document.getElementById('api-key')?.value.trim();
  if (!apiKey) {
    showInlineError(
      'APIキーを入力してください。<br>' +
      '<small><a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style="color:inherit;">Google AI Studio で無料取得できます →</a></small>'
    );
    return;
  }

  const btn = document.getElementById('gen-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2"></i> AIが分析中...';
  showState('state-loading');

  const formData = buildFormData();

  const prompt = `
あなたは経験豊富な塾の教育コンサルタントです。以下の生徒情報を基に総合的な診断レポートを作成してください。

【生徒情報】
名前: ${formData.name}
学年: ${formData.grade}
在籍期間: ${formData.period}
担当科目: ${formData.subjects}
最近のテスト結果: ${formData.scores}
授業の理解度（10段階）: ${formData.comp}
学習態度・自習状況（講師所見）: ${formData.attitude}
目標: ${formData.goal}
現在の課題: ${formData.concerns}
講師メモ: ${formData.notes}

以下の形式でJSONのみを返してください（マークダウン記法・コードブロックなし）:
{
  "overallScore": 1〜5の整数,
  "overallComment": "総合診断コメント（3〜4文）",
  "strengths": ["強み1", "強み2", "強み3"],
  "improvements": ["改善点1", "改善点2", "改善点3"],
  "weeklyPlan": "1週間の推奨学習プラン（具体的に）",
  "monthlyPlan": "1ヶ月の目標と学習方針",
  "instructorAdvice": "講師へのアドバイス（2〜3文）",
  "parentMessage": "保護者向けコメント文案（そのまま使える文章）",
  "urgentAction": "今すぐ取り組むべきこと（1つ、具体的に）"
}
`.trim();

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1500 },
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const msg = errBody?.error?.message || `${response.status} ${response.statusText}`;
      throw new Error(msg);
    }

    const data     = await response.json();
    const rawText  = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean    = rawText.replace(/```json|```/g, '').trim();
    const result   = JSON.parse(clean);

    // 結果をその生徒に保存
    students[currentIndex].result = result;

    renderResult(result, formData);
    showState('state-result');

  } catch (err) {
    showInlineError(
      '診断の生成に失敗しました。APIキーとネットワーク接続を確認してください。<br>' +
      `<small>${escapeHtml(err.message)}</small>`
    );

  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-sparkles"></i> AI診断レポートを生成する';
  }
});

/* ===========================
   診断結果をHTMLに描画する
=========================== */
function renderResult(d, formData) {
  const stars  = '★'.repeat(d.overallScore) + '☆'.repeat(5 - d.overallScore);
  const subLine = [formData.grade, formData.subjects]
    .filter(v => v !== '未入力').join(' ／ ');

  const strengthsHTML    = (d.strengths    || []).map(s => `<li>${s}</li>`).join('');
  const improvementsHTML = (d.improvements || []).map(s => `<li>${s}</li>`).join('');

  const html = `
    <!-- 総合評価 -->
    <div class="result-card card-hero">
      <div class="hero-row">
        <div>
          <div class="hero-name">${escapeHtml(formData.name)} さん — AI診断レポート</div>
          <div class="hero-sub">${escapeHtml(subLine)}</div>
        </div>
        <div>
          <div class="score-stars">${stars}</div>
          <div class="score-label">総合評価 ${d.overallScore} / 5</div>
        </div>
      </div>
      <div class="card-body">${d.overallComment || ''}</div>
    </div>

    <!-- 今すぐ取り組むべきこと -->
    <div class="result-card card-urgent">
      <div class="card-label">
        <i class="ti ti-alert-circle"></i> 今すぐ取り組むべきこと
      </div>
      <div class="card-body">${d.urgentAction || ''}</div>
    </div>

    <!-- 強み・改善点 -->
    <div class="two-col">
      <div class="result-card card-strengths">
        <div class="card-label"><i class="ti ti-thumb-up"></i> 強み</div>
        <ul class="diag-list">${strengthsHTML}</ul>
      </div>
      <div class="result-card card-improvements">
        <div class="card-label"><i class="ti ti-trending-up"></i> 改善点</div>
        <ul class="diag-list">${improvementsHTML}</ul>
      </div>
    </div>

    <!-- 1週間の学習プラン -->
    <div class="result-card card-neutral">
      <div class="card-label"><i class="ti ti-calendar-week"></i> 1週間の推奨学習プラン</div>
      <div class="card-body">${d.weeklyPlan || ''}</div>
    </div>

    <!-- 1ヶ月の目標 -->
    <div class="result-card card-neutral">
      <div class="card-label"><i class="ti ti-calendar-month"></i> 1ヶ月の目標と方針</div>
      <div class="card-body">${d.monthlyPlan || ''}</div>
    </div>

    <!-- 講師アドバイス -->
    <div class="result-card card-neutral">
      <div class="card-label"><i class="ti ti-bulb"></i> 講師へのアドバイス</div>
      <div class="card-body">${d.instructorAdvice || ''}</div>
    </div>

    <!-- 保護者向けコメント -->
    <div class="result-card card-neutral">
      <div class="card-label"><i class="ti ti-mail"></i> 保護者向けコメント文案</div>
      <div class="parent-block" id="parent-text">${d.parentMessage || ''}</div>
      <button type="button" class="copy-btn" id="copy-btn">
        <i class="ti ti-copy"></i> コピー
      </button>
    </div>
  `;

  document.getElementById('state-result').innerHTML = html;

  document.getElementById('copy-btn').addEventListener('click', () => {
    const text = document.getElementById('parent-text').innerText;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('copy-btn');
      btn.innerHTML = '<i class="ti ti-check"></i> コピーしました';
      setTimeout(() => {
        btn.innerHTML = '<i class="ti ti-copy"></i> コピー';
      }, 2000);
    });
  });
}

/* ===========================
   初期化
=========================== */
document.getElementById('tab-add-btn').addEventListener('click', addStudent);
renderTabs();
restoreForm(students[currentIndex]);
