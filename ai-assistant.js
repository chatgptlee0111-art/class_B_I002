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
      appendMessage('model', '嗨！我可以幫你查看行程、比較哪一天比較空，也可以回答課表相關問題。', false);
    }
  }

  status.textContent = model ? 'Gemini · gemini-3.8-flash' : (aiSetupError ? 'Gemini 設定待完成' : '行程查詢可用');
  if (aiSetupError) status.title = aiSetupError;
  launcher.hidden = false;
  restoreHistory();

  function openPanel() {
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    input.focus();
  }

  function closePanel() {
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus();
  }

  launcher.addEventListener('click', () => panel.hidden ? openPanel() : closePanel());
  closeButton?.addEventListener('click', closePanel);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) closePanel();
  });

  clearButton?.addEventListener('click', () => {
    if (!history.length) {
      toast('目前沒有已儲存的對話');
      return;
    }
    if (!confirm('清除這台瀏覽器中此帳號的 AI 對話紀錄？行程資料不會受到影響。')) return;
    history = [];
    localStorage.removeItem(storageKey);
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

  function isDeleteAllEventsRequest(text) {
    const deleteVerb = /刪除|刪掉|清除|移除/.test(text);
    const allItems = /所有|全部|整個|全部的/.test(text);
    const schedule = /行程|預約|活動/.test(text);
    return deleteVerb && allItems && schedule;
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
    if (!model) {
      if (isTodayScheduleRequest(question)) {
        appendMessage('model', localTodaySummary());
        return;
      }
      appendMessage('model', aiSetupError || 'Gemini 尚未完成設定。請先設定 Firebase AI Logic 與 App Check，再試一次。');
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
      if (/app.?check|403|PERMISSION_DENIED|firebasevertexai|terms/i.test(detail)) {
        appendMessage('model', 'Gemini 尚未完成 Firebase AI Logic／App Check 設定。請確認已接受 Google Generative Language API 服務條款、啟用 AI Logic，並為這個 Web App 完成 reCAPTCHA Enterprise App Check 註冊。');
      } else {
        appendMessage('model', `Gemini 暫時無法回覆（${error?.code || '連線失敗'}）。請稍後再試。`);
      }
    } finally {
      sendButton.disabled = false;
      input.disabled = false;
      input.focus();
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
    try {
      if (isDeleteAllEventsRequest(question)) {
        const data = getData();
        const count = (data.items || []).filter(item => item.type === 'event').length;
        if (!count) {
          appendMessage('model', '目前沒有一般行程可刪除。課業任務與固定課表不屬於這項刪除範圍。');
          return;
        }
        const confirmed = confirm(`即將刪除 ${count} 筆一般行程；課業任務與固定課表會保留。此操作無法復原，確定繼續嗎？`);
        if (!confirmed) {
          appendMessage('model', '已取消，沒有刪除任何行程。');
          return;
        }
        data.items = data.items.filter(item => item.type !== 'event');
        const saved = await save();
        render();
        if (saved) {
          toast(`已刪除 ${count} 筆行程`);
          appendMessage('model', `已刪除 ${count} 筆一般行程。課業任務與固定課表都保留了。`);
        } else {
          toast('行程已移除，但雲端尚未儲存；請按右上方「重試儲存」');
          appendMessage('model', `目前畫面已移除 ${count} 筆一般行程，但雲端儲存尚未完成。請按右上方「重試儲存」後再離開頁面；課業任務與固定課表都保留了。`);
        }
        return;
      }
      if (isCompareRequest(question)) {
        appendMessage('model', compareWeek(question));
        return;
      }
      await sendToGemini(question);
    } finally {
      busy = false;
      sendButton.disabled = false;
    }
  }

  form.addEventListener('submit', handleSubmit);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
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
