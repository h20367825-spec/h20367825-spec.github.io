(() => {
  const data = window.LOCAL_AI_RADAR_DATA;
  const profileSelect = document.querySelector('#profile-select');
  const useCaseSelect = document.querySelector('#usecase-select');
  const prioritySelect = document.querySelector('#priority-select');
  const resultList = document.querySelector('#recommendations');
  const summary = document.querySelector('#result-summary');

  const verdictLabel = {
    local_feasible: '适合本地运行',
    local_slow: '可以运行，速度偏慢',
    local_unlikely: '不建议本地运行',
    cloud_only: '仅云端'
  };

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function render() {
    if (!data || !profileSelect || !useCaseSelect || !prioritySelect || !resultList) return;
    const key = `${profileSelect.value}|${useCaseSelect.value}|${prioritySelect.value}`;
    const result = data.recommendations[key];
    const profile = data.profiles.find((item) => item.slug === profileSelect.value);
    if (!result || !profile) return;

    const best = result[0];
    summary.innerHTML = `<strong>${escapeHtml(profile.label)}</strong> · ${escapeHtml(data.useCaseLabels[useCaseSelect.value])}：首选 <strong>${escapeHtml(best.name)}</strong>。页面速度均为模型估算，实际表现请以本机测试为准。`;
    resultList.innerHTML = result.slice(0, 5).map((model, index) => `
      <article class="recommendation">
        <div class="rank">${index + 1}</div>
        <div>
          <p class="recommendation-name">${escapeHtml(model.name)}</p>
          <div class="recommendation-meta">${escapeHtml(model.quantization)} · 预计占用 ${model.estimatedLoadGb} GB · ${escapeHtml(verdictLabel[model.localVerdict])}</div>
        </div>
        <div class="recommendation-speed">
          <span class="speed-value">${model.estimatedTokensPerSec == null ? '—' : `${model.estimatedTokensPerSec} tok/s`}</span>
          <span class="speed-label">估算生成速度</span>
        </div>
      </article>
    `).join('');

    const url = new URL(window.location.href);
    url.searchParams.set('device', profileSelect.value);
    url.searchParams.set('use', useCaseSelect.value);
    url.searchParams.set('priority', prioritySelect.value);
    history.replaceState({}, '', url);
  }

  if (profileSelect && data) {
    const params = new URLSearchParams(window.location.search);
    const requestedProfile = params.get('device');
    const requestedUseCase = params.get('use');
    const requestedPriority = params.get('priority');
    if (data.profiles.some((item) => item.slug === requestedProfile)) profileSelect.value = requestedProfile;
    if (data.useCases.includes(requestedUseCase)) useCaseSelect.value = requestedUseCase;
    if (data.priorities.includes(requestedPriority)) prioritySelect.value = requestedPriority;
    [profileSelect, useCaseSelect, prioritySelect].forEach((control) => control.addEventListener('change', render));
    render();
  }

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-copy]');
    if (!button) return;
    const value = button.getAttribute('data-copy');
    try {
      await navigator.clipboard.writeText(value);
      const previous = button.textContent;
      button.textContent = '已复制';
      window.setTimeout(() => { button.textContent = previous; }, 1200);
    } catch {
      button.textContent = '请手动复制';
    }
  });
})();
