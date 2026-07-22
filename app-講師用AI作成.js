/* ===========================
   使用モデル
   gemini-2.0-flash（無料枠あり）
   ※ Google AI Studio で取得した APIキーを使用
   https://aistudio.google.com/app/apikey
=========================== */
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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
   フォーム値を取得するヘルパー
=========================== */
function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
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
   AI診断レポートを生成する
=========================== */
document.getElementById('gen-btn').addEventListener('click', async () => {
  const apiKey = getVal('api-key');
  if (!apiKey) {
    alert('Google AI Studio の APIキーを入力してください。\nhttps://aistudio.google.com/app/apikey');
    return;
  }

  // ボタンを無効化
  const btn = document.getElementById('gen-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2"></i> AIが分析中...';

  showState('state-loading');

  // フォームデータを収集
  const formData = {
    name:     getVal('f-name')     || '未入力',
    grade:    getVal('f-grade')    || '未入力',
    period:   getVal('f-period')   || '未入力',
    subjects: [...selectedSubjects].join('、') || '未入力',
    scores:   getVal('f-scores')   || '未入力',
    hw:       getVal('f-hw')       || '未入力',
    comp:     getVal('f-comp')     || '未入力',
    attend:   getVal('f-attend')   || '未入力',
    attitude: getVal('f-attitude') || '未入力',
    study:    getVal('f-study')    || '未入力',
    conc:     getVal('f-conc')     || '未入力',
    goal:     getVal('f-goal')     || '未入力',
    concerns: getVal('f-concerns') || '未入力',
    parent:   getVal('f-parent')   || '未入力',
    notes:    getVal('f-notes')    || '未入力',
  };

  // プロンプトを組み立て
  const prompt = `
あなたは経験豊富な塾の教育コンサルタントです。以下の生徒情報を基に総合的な診断レポートを作成してください。

【生徒情報】
名前: ${formData.name}
学年: ${formData.grade}
在籍期間: ${formData.period}
担当科目: ${formData.subjects}
最近のテスト結果: ${formData.scores}
宿題提出率: ${formData.hw}
授業の理解度: ${formData.comp}
出席率: ${formData.attend}
授業態度: ${formData.attitude}
週の自習時間: ${formData.study}
集中力: ${formData.conc}
目標: ${formData.goal}
現在の課題: ${formData.concerns}
保護者コメント: ${formData.parent}
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
    // Gemini API を呼び出す
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1500,
        }
      })
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const msg = errBody?.error?.message || `${response.status} ${response.statusText}`;
      throw new Error(msg);
    }

    // レスポンスを解析
    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = rawText.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    renderResult(result, formData);
    showState('state-result');

  } catch (err) {
    const errEl = document.getElementById('state-error');
    errEl.innerHTML = `
      <div class="error-box">
        <i class="ti ti-alert-triangle"></i>
        <span>
          診断の生成に失敗しました。APIキーとネットワーク接続を確認してください。<br>
          <small>${err.message}</small>
        </span>
      </div>
    `;
    showState('state-error');

  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-sparkles"></i> AI診断レポートを生成する';
  }
});

/* ===========================
   診断結果をHTMLに描画する
=========================== */
function renderResult(d, formData) {
  const stars = '★'.repeat(d.overallScore) + '☆'.repeat(5 - d.overallScore);
  const subLine = [formData.grade, formData.subjects]
    .filter(v => v !== '未入力').join(' ／ ');

  const strengthsHTML  = (d.strengths    || []).map(s => `<li>${s}</li>`).join('');
  const improvementsHTML = (d.improvements || []).map(s => `<li>${s}</li>`).join('');

  const html = `
    <!-- 総合評価 -->
    <div class="result-card card-hero">
      <div class="hero-row">
        <div>
          <div class="hero-name">${formData.name} さん — AI診断レポート</div>
          <div class="hero-sub">${subLine}</div>
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
        <div class="card-label">
          <i class="ti ti-thumb-up"></i> 強み
        </div>
        <ul class="diag-list">${strengthsHTML}</ul>
      </div>
      <div class="result-card card-improvements">
        <div class="card-label">
          <i class="ti ti-trending-up"></i> 改善点
        </div>
        <ul class="diag-list">${improvementsHTML}</ul>
      </div>
    </div>

    <!-- 1週間の学習プラン -->
    <div class="result-card card-neutral">
      <div class="card-label">
        <i class="ti ti-calendar-week"></i> 1週間の推奨学習プラン
      </div>
      <div class="card-body">${d.weeklyPlan || ''}</div>
    </div>

    <!-- 1ヶ月の目標 -->
    <div class="result-card card-neutral">
      <div class="card-label">
        <i class="ti ti-calendar-month"></i> 1ヶ月の目標と方針
      </div>
      <div class="card-body">${d.monthlyPlan || ''}</div>
    </div>

    <!-- 講師アドバイス -->
    <div class="result-card card-neutral">
      <div class="card-label">
        <i class="ti ti-bulb"></i> 講師へのアドバイス
      </div>
      <div class="card-body">${d.instructorAdvice || ''}</div>
    </div>

    <!-- 保護者向けコメント -->
    <div class="result-card card-neutral">
      <div class="card-label">
        <i class="ti ti-mail"></i> 保護者向けコメント文案
      </div>
      <div class="parent-block" id="parent-text">${d.parentMessage || ''}</div>
      <button class="copy-btn" id="copy-btn">
        <i class="ti ti-copy"></i> コピー
      </button>
    </div>
  `;

  document.getElementById('state-result').innerHTML = html;

  // コピーボタンのイベント
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