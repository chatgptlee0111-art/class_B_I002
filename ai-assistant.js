import { initializeActionEditor } from './assistant-actions.js?v=20261122-safari-touch';
const escapeText = value => String(value ?? '');

export function initializeScheduleAssistant({ userId, getData, model, aiSetupError = '', save, render, toast }) {
  const launcher = document.getElementById('aiLauncher');
  const panel = document.getElementById('aiPanel');
  const closeButton = document.getElementById('aiClose');
  const clearButton = document.getElementById('aiClear');
  const form = document.getElementById('aiForm');
  const input = document.getElementById('aiInput');
  const sendButton = document.getElementById('aiSend');
  const messages = document.getElementById('aiMessages');
  const status = document.getElementById('aiStatus');

  if (!launcher || !panel || !form || !input || !messages) return;

  const storageKey = `shiguang-ai-chat-v1-${userId}`;
  let history = [];
  let busy = false;
  let backgroundScroll = null;
  let backgroundRegions = [];
  let touchPoint = null;
  const actionEditor = initializeActionEditor({ getData, save, render, toast, appendMessage, messages });
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(saved)) {
      history = saved
        .filter(message => ['user', 'model'].includes(message?.role) && typeof message.text === 'string')
        .slice(-20);
    }
  } catch {
    history = [];
  }
  while (history.length && history[0].role !== 'user') history.shift();
  if (history.length && history[history.length - 1].role !== 'model') history.pop();

  function trimHistory() {
    while (history.length > 20) history.splice(0, 2);
    while (history.length && history[0].role !== 'user') history.shift();
  }

  function persistHistory() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(history.slice(-20)));
    } catch {
      status.textContent = '本機儲存空間不足，對話不會保留';
    }
  }

  function appendMessage(role, text, persist = true) {
    const bubble = document.createElement('div');
    bubble.className = `ai-bubble ${role}`;
    bubble.textContent = escapeText(text);
    messages.append(bubble);
    messages.scrollTop = messages.scrollHeight;
    if (persist && ['user', 'model'].includes(role)) {
      history.push({ role, text: escapeText(text) });
      trimHistory();
      persistHistory();
    }
    return bubble;
  }

  function restoreHistory() {
    messages.replaceChildren();
    if (history.length) {
      history.forEach(message => appendMessage(message.role, message.text, false));
    } else {
      appendMessage('model', '嗨！我可以幫你新增、修改行程或課業任務，也能查今日安排與比較空檔。\n\n試試「幫我新增明天下午三點的微積分讀書行程」，或「把「微積分讀書」改到下週五 18:30」。我會先列出可編輯草稿，確認後才儲存。', false);
    }
  }

  status.textContent = model ? 'Gemini 問答 · 行程操作可用' : '本機行程操作可用 · Gemini 問答未啟用';
  if (aiSetupError) status.title = aiSetupError;
  launcher.hidden = false;
  restoreHistory();

  // iOS can pan the visual viewport even with a fixed body and overflow:hidden.
  // Cancel only gestures that cannot be consumed by a scroll area in the panel.
  function canConsumeScroll(target, dx, dy) {
    if (!panel.contains(target)) return false;
    const horizontal = Math.abs(dx) > Math.abs(dy);
    const delta = horizontal ? dx : dy;
    if (!delta) return true;
    for (let node = target; node && panel.contains(node); node = node.parentElement) {
      const style = getComputedStyle(node);
      const overflow = horizontal ? style.overflowX : style.overflowY;
      const size = horizontal ? node.scrollWidth - node.clientWidth : node.scrollHeight - node.clientHeight;
      const position = horizontal ? node.scrollLeft : node.scrollTop;
      if (/(auto|scroll)/.test(overflow) && size > 1) return delta < 0 ? position > 1 : position < size - 1;
      if (node === panel) break;
    }
    return false;
  }
  function startTouch(event) {
    const point = event.touches.length === 1 ? event.touches[0] : null;
    touchPoint = point ? { x: point.clientX, y: point.clientY } : null;
  }
  function guardTouch(event) {
    if (!touchPoint || event.touches.length !== 1) return;
    const point = event.touches[0];
    const dx = touchPoint.x - point.clientX, dy = touchPoint.y - point.clientY;
    touchPoint = { x: point.clientX, y: point.clientY };
    if (!canConsumeScroll(event.target, dx, dy) && event.cancelable) event.preventDefault();
  }
  function guardWheel(event) {
    if (!event.ctrlKey && !canConsumeScroll(event.target, event.deltaX, event.deltaY) && event.cancelable) event.preventDefault();
  }
  function openPanel() {
    if (backgroundScroll) return;
    backgroundScroll = { left: window.scrollX, top: window.scrollY };
    document.body.style.setProperty('--assistant-page-top', `${-backgroundScroll.top}px`);
    document.body.style.setProperty('--assistant-page-left', `${-backgroundScroll.left}px`);
    document.documentElement.classList.add('assistant-open');
    panel.hidden = false;
    document.body.classList.add('assistant-open');
    backgroundRegions = [...document.querySelectorAll('#plannerApp,.mobile-nav')].map(node => ({ node, inert: node.inert }));
    backgroundRegions.forEach(({ node }) => { node.inert = true; });
    document.addEventListener('touchstart', startTouch, { passive: true, capture: true });
    document.addEventListener('touchmove', guardTouch, { passive: false, capture: true });
    document.addEventListener('wheel', guardWheel, { passive: false, capture: true });
    launcher.setAttribute('aria-expanded', 'true');
    if (window.matchMedia('(pointer:coarse)').matches) closeButton?.focus({ preventScroll: true });
    else input.focus({ preventScroll: true });
  }

  function closePanel() {
    if (panel.contains(document.activeElement)) document.activeElement.blur();
    panel.hidden = true;
    document.removeEventListener('touchstart', startTouch, true);
    document.removeEventListener('touchmove', guardTouch, true);
    document.removeEventListener('wheel', guardWheel, true);
    touchPoint = null;
    backgroundRegions.forEach(({ node, inert }) => { node.inert = inert; });
    backgroundRegions = [];
    document.body.classList.remove('assistant-open');
    document.documentElement.classList.remove('assistant-open');
    document.body.style.removeProperty('--assistant-page-top');
    document.body.style.removeProperty('--assistant-page-left');
    if (backgroundScroll) {
      window.scrollTo({ ...backgroundScroll, behavior: 'instant' });
      backgroundScroll = null;
    }
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus({ preventScroll: true });
  }

  launcher.addEventListener('click', () => panel.hidden ? openPanel() : closePanel());
  closeButton?.addEventListener('click', closePanel);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) closePanel();
  });

  clearButton?.addEventListener('click', () => {
    if (busy) return;
    if (actionEditor.hasUnsavedDraft()) { toast('請先完成草稿的雲端儲存再清除對話'); return; }
    if (!history.length) {
      toast('目前沒有已儲存的對話');
      return;
    }
    if (!confirm('清除這台瀏覽器中此帳號的 AI 對話紀錄？行程資料不會受到影響。')) return;
    history = [];
    actionEditor.discardDraft();
    try { localStorage.removeItem(storageKey); } catch {}
    restoreHistory();
  });

  function dateString(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function mondayOf(date) {
    const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return monday;
  }

  function formatDay(date) {
    return new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(date);
  }

  function minutesFromTime(value) {
    const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hours = Number(match[1]), minutes = Number(match[2]);
    return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
  }

  function activeSlotsFor(date, timetable) {
    const key = dateString(date);
    return timetable.filter(slot => Number(slot.day) === date.getDay()
      && (!slot.coverageStart || slot.coverageStart <= key)
      && (!slot.coverageEnd || slot.coverageEnd >= key));
  }

  function isCompareRequest(text) {
    return /(哪天|哪一天|比較空|較空|空檔|空閒|有空|行程少)/.test(text);
  }

  function compareWeek(text) {
    const data = getData();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentWeek = mondayOf(today);
    const nextWeek = /下週|下周|下一週|下一周/.test(text);
    const nextMonday = new Date(currentWeek.getFullYear(), currentWeek.getMonth(), currentWeek.getDate() + 7);
    const start = nextWeek ? nextMonday : today;
    const currentSunday = new Date(currentWeek.getFullYear(), currentWeek.getMonth(), currentWeek.getDate() + 6);
    const dayCount = nextWeek ? 7 : Math.max(1, Math.round((currentSunday - today) / 86400000) + 1);
    const days = Array.from({ length: dayCount }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      const key = dateString(date);
      const windowStart = key === dateString(today) ? Math.max(8 * 60, now.getHours() * 60 + now.getMinutes()) : 8 * 60;
      const windowMinutes = Math.max(0, 22 * 60 - windowStart);
      const intervals = [];
      const slots = activeSlotsFor(date, data.timetable || []);
      for (const slot of slots) {
        const begin = minutesFromTime(slot.start), end = minutesFromTime(slot.end);
        if (begin !== null && end !== null && end > begin) intervals.push([begin, end]);
      }

      const events = (data.items || []).filter(item => item.type === 'event' && item.date === key);
      for (const item of events) {
        const begin = minutesFromTime(item.time);
        if (begin === null) {
          intervals.push([8 * 60, 22 * 60]);
          continue;
        }
        const end = minutesFromTime(item.endTime || item.end) ?? begin + 60;
        intervals.push([begin, Math.max(begin + 1, end)]);
      }

      const clipped = intervals
        .map(([begin, end]) => [Math.max(windowStart, begin), Math.min(22 * 60, end)])
        .filter(([begin, end]) => end > begin)
        .sort((a, b) => a[0] - b[0]);
      let occupied = 0, cursor = -1;
      for (const [begin, end] of clipped) {
        if (begin > cursor) occupied += end - begin;
        else if (end > cursor) occupied += end - cursor;
        cursor = Math.max(cursor, end);
      }
      return { date, slots, events, occupied, windowMinutes, tasks: (data.items || []).filter(item => item.type === 'task' && item.date === key).length };
    });

    const minimum = Math.min(...days.map(day => day.occupied));
    const best = days.filter(day => day.occupied === minimum);
    const availableHours = day => Math.max(0, (day.windowMinutes - day.occupied) / 60).toFixed(1).replace(/\.0$/, '');
    const bestText = best.map(day => `${formatDay(day.date)}（約 ${availableHours(day)} 小時可用）`).join('、');
    const detail = days.map(day => {
      const free = availableHours(day);
      return `${formatDay(day.date)}：固定課 ${day.slots.length} 堂、行程 ${day.events.length} 筆，約 ${free} 小時可用${day.tasks ? `；另有 ${day.tasks} 筆作業期限` : ''}`;
    }).join('\n');
    return `${nextWeek ? '下週' : '本週剩餘日期'}目前看起來比較空的是：${bestText}。\n\n${detail}\n\n估算以每日 08:00–22:00 為區間（今天只計算現在起至 22:00）；沒有結束時間的行程按 1 小時計算，固定課使用課表起訖時間，作業期限不計入占用時數。`;
  }

  function isTodayScheduleRequest(text) {
    return /(今天|今日)/.test(text) && /(行程|安排|課程|課表|待辦)/.test(text);
  }

  function localTodaySummary() {
    const data = getData(), today = new Date(), key = dateString(today);
    const entries = [
      ...activeSlotsFor(today, data.timetable || []).map(slot => ({ time: slot.start || '', end: slot.end || '', title: slot.title || slot.subject, kind: '固定課' })),
      ...(data.items || []).filter(item => item.date === key).map(item => ({ time: item.time || '', title: item.title, kind: item.type === 'task' ? '課業任務' : '行程' }))
    ].sort((a, b) => a.time.localeCompare(b.time));
    if (!entries.length) return `今天（${formatDay(today)}）沒有已登記的課程、行程或待辦。`;
    return `今天（${formatDay(today)}）的安排：\n${entries.map(entry => `• ${entry.time || '全天'}${entry.end ? `–${entry.end}` : ''}　${entry.title}（${entry.kind}）`).join('\n')}`;
  }

  function scheduleContext() {
    const data = getData();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 14);
    const startKey = dateString(start), endKey = dateString(end);
    const entries = (data.items || [])
      .filter(item => item.date >= startKey && item.date <= endKey)
      .slice(0, 60)
      .map(item => ({ type: item.type, title: item.title, subject: item.subject, date: item.date, time: item.time || '', endTime: item.endTime || '' }));
    const recurringClasses = [];
    for (let offset = 0; offset <= 14; offset++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
      for (const slot of activeSlotsFor(date, data.timetable || [])) {
        recurringClasses.push({ date: dateString(date), title: slot.title, subject: slot.subject, start: slot.start, end: slot.end });
      }
    }
    return { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, today: startKey, scheduleWindow: `${startKey} through ${endKey}`, entries, recurringClasses };
  }

  async function sendToGemini(question) {
    const restoreInputFocus = document.activeElement === input && !window.matchMedia('(pointer:coarse)').matches;
    if (!model) {
      if (isTodayScheduleRequest(question)) {
        appendMessage('model', localTodaySummary());
        return;
      }
      appendMessage('model', '目前可以直接新增、修改行程、查詢今日安排與比較空檔。\n\n例如：\n• 幫我新增明天下午三點「微積分讀書」\n• 把「微積分讀書」改到下週五 18:30\n• 今天有哪些行程？\n\n自由問答的 Gemini 尚未啟用；行程操作仍可使用。');
      return;
    }

    const pending = document.createElement('div');
    pending.className = 'ai-bubble model pending';
    pending.textContent = '正在整理你的行程…';
    messages.append(pending);
    messages.scrollTop = messages.scrollHeight;
    sendButton.disabled = true;
    input.disabled = true;
    try {
      const previousTurns = history.slice(0, -1);
      const chat = model.startChat({ history: previousTurns.map(message => ({ role: message.role, parts: [{ text: message.text }] })) });
      const prompt = `使用者問題：\n${question}\n\n必要的行程資料（不要猜測資料中沒有的時間或事件）：\n${JSON.stringify(scheduleContext())}`;
      const result = await chat.sendMessage(prompt);
      const answer = result.response.text().trim() || 'Gemini 目前沒有可顯示的回覆，請換個方式問問看。';
      pending.remove();
      history.push({ role: 'model', text: answer });
      trimHistory();
      persistHistory();
      appendMessage('model', answer, false);
    } catch (error) {
      pending.remove();
      const detail = `${error?.code || ''} ${error?.message || ''}`;
      if (/429|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(detail)) {
        appendMessage('model', 'Gemini 目前使用量已達限制，請稍後再試。你仍可使用行程查詢與新增、修改草稿。');
      } else if (/500|503|high demand|overloaded|unavailable|Timeout|timed out|abort/i.test(detail)) {
        appendMessage('model', 'Gemini 目前忙碌或回覆逾時，請稍後重新送出問題。行程資料不受影響。');
      } else if (/app.?check|403|PERMISSION_DENIED|terms/i.test(detail)) {
        appendMessage('model', 'Gemini 尚未完成 Firebase AI Logic／App Check 設定。請確認已接受 Google Generative Language API 服務條款、啟用 AI Logic，並為這個 Web App 完成 reCAPTCHA Enterprise App Check 註冊。');
      } else {
        appendMessage('model', `Gemini 暫時無法回覆（${error?.code || '連線失敗'}）。請稍後再試。`);
      }
    } finally {
      sendButton.disabled = false;
      input.disabled = false;
      if (!panel.hidden && restoreInputFocus) input.focus({ preventScroll: true });
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const question = input.value.trim();
    if (!question || busy) return;
    input.value = '';
    appendMessage('user', question);
    busy = true;
    sendButton.disabled = true;
    if (clearButton) clearButton.disabled = true;
    try {
      if (actionEditor.hasUnsavedDraft()) {
        appendMessage('model', '上一筆變更尚未完成雲端儲存，請先在草稿卡按「重試雲端儲存」，避免遺失修改。');
        return;
      }
      if (actionEditor.handleRequest(question)) return;
      if (isCompareRequest(question)) {
        appendMessage('model', compareWeek(question));
        return;
      }
      if (isTodayScheduleRequest(question)) { appendMessage('model', localTodaySummary()); return; }
      await sendToGemini(question);
    } finally {
      busy = false;
      sendButton.disabled = false;
      if (clearButton) clearButton.disabled = false;
    }
  }

  form.addEventListener('submit', handleSubmit);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  document.querySelectorAll('[data-ai-prompt]').forEach(button => {
    button.addEventListener('click', () => {
      input.value = button.dataset.aiPrompt || '';
      form.requestSubmit();
    });
  });
}
