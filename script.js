// Main application controller for the merged attendance and SGPA dashboard.
(function () {
  const doc = document;

  function $(selector) {
    return doc.querySelector(selector);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function toNumber(value) {
    if (value === '' || value === null || value === undefined) {
      return NaN;
    }
    return Number(value);
  }

  function animateNumber(element, targetValue, options) {
    const config = options || {};
    const duration = config.duration || 650;
    const formatter = config.format || function (value) {
      return Math.round(value).toString();
    };
    const startValue = Number(element.dataset.lastValue || element.textContent.replace(/[^0-9.-]/g, '')) || 0;
    const startTime = performance.now();

    function tick(now) {
      const progress = clamp((now - startTime) / duration, 0, 1);
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      const current = startValue + (targetValue - startValue) * eased;
      element.textContent = formatter(current);
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        element.textContent = formatter(targetValue);
        element.dataset.lastValue = String(targetValue);
      }
    }

    requestAnimationFrame(tick);
  }

  const storageKeys = {
    theme: 'dashboard_theme',
    attendanceTarget: 'att_target',
    attendanceScheduled: 'att_scheduled',
    attendanceConducted: 'att_conducted',
    attendancePresent: 'att_present',
    sgpaRows: 'sgpa_rows'
  };

  const state = {
    attendanceLastOk: null,
    sgpaRowId: 0,
    sgpaDebounceTimer: null,
    sgpaAnimationValue: null,
    prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
  };

  // Theme management for the whole dashboard.
  const themeToggle = $('#themeToggle');
  const themeToggleThumb = $('#themeToggleThumb');
  const themeToggleLabel = $('#themeToggleLabel');

  function applyTheme(theme) {
    const normalizedTheme = theme === 'dark' ? 'dark' : 'light';

    // Briefly attach a class so all surfaces animate during the switch.
    doc.documentElement.classList.add('theme-switching');
    doc.documentElement.setAttribute('data-theme', normalizedTheme);
    themeToggle.setAttribute('aria-pressed', String(normalizedTheme === 'dark'));
    themeToggleThumb.textContent = normalizedTheme === 'dark' ? '◑' : '☀';
    if (themeToggleLabel) {
      themeToggleLabel.textContent = normalizedTheme === 'dark' ? 'AMOLED' : 'Light';
    }
    localStorage.setItem(storageKeys.theme, normalizedTheme);

    // Update the SVG attendance ring gradient to match the active theme.
    const gradientStops = doc.querySelectorAll('#attendanceGradient stop');
    if (gradientStops.length >= 3) {
      if (normalizedTheme === 'dark') {
        gradientStops[0].setAttribute('stop-color', '#00d4ff');
        gradientStops[1].setAttribute('stop-color', '#7c6aff');
        gradientStops[2].setAttribute('stop-color', '#00d4ff');
      } else {
        gradientStops[0].setAttribute('stop-color', '#1761ff');
        gradientStops[1].setAttribute('stop-color', '#16c2d5');
        gradientStops[2].setAttribute('stop-color', '#f8c84f');
      }
    }

    // Remove transition class once the animation settles.
    window.setTimeout(function () {
      doc.documentElement.classList.remove('theme-switching');
    }, 380);
  }

  function initTheme() {
    const savedTheme = localStorage.getItem(storageKeys.theme);
    if (savedTheme) {
      applyTheme(savedTheme);
      return;
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }

  themeToggle.addEventListener('click', function () {
    const currentTheme = doc.documentElement.getAttribute('data-theme');
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  });

  // Attendance calculator state and DOM wiring.
  const attendance = {
    target: $('#target'),
    scheduled: $('#scheduled'),
    conducted: $('#conducted'),
    present: $('#present'),
    targetHint: $('#targetHint'),
    scheduledHint: $('#scheduledHint'),
    conductedHint: $('#conductedHint'),
    presentHint: $('#presentHint'),
    status: $('#attendanceStatus'),
    statusText: $('#attendanceStatusText'),
    statusIcon: $('#attendanceStatusIcon'),
    insightCards: $('#attendanceInsightCards'),
    belowCard: $('#belowCard'),
    aboveCard: $('#aboveCard'),
    needCount: $('#needCount'),
    bunkCount: $('#bunkCount'),
    moodMsg: $('#moodMsg'),
    targetLabel1: $('#targetLabel1'),
    targetLabel2: $('#targetLabel2'),
    targetLabel3: $('#targetLabel3'),
    targetLabel4: $('#targetLabel4'),
    targetPctDisplay: $('#targetPctDisplay'),
    progressPanel: $('#attendanceProgressPanel'),
    extraStatus: $('#hopeMsg'),
    hopeText: $('#hopeText'),
    remainingLectures: $('#remainingLectures'),
    stillNeededLectures: $('#stillNeededLectures'),
    summary: $('#attendanceSummary'),
    curA: $('#curA'),
    curB: $('#curB'),
    curPct: $('#curPct'),
    reqA: $('#reqA'),
    reqB: $('#reqB'),
    finalTotalDisplay: $('#finalTotalDisplay'),
    feasibilityBadge: $('#feasibilityBadge'),
    feasText: $('#feasText'),
    remainCount: $('#remainCount'),
    needTo75: $('#needTo75'),
    progressAria: $('#progressAria'),
    progressInner: $('#progressInner'),
    percentCount: $('#percentCount'),
    subLabel: $('#subLabel'),
    attendanceBar: $('#attendanceBar'),
    resetButton: $('#attendanceReset'),
    quickButton: $('#quick75'),
    heroAttendanceValue: $('#heroAttendanceValue')
  };

  const attendanceRingRadius = 90;
  const attendanceRingCircumference = 2 * Math.PI * attendanceRingRadius;
  attendance.attendanceBar.style.strokeDasharray = attendanceRingCircumference.toFixed(2);
  attendance.attendanceBar.style.strokeDashoffset = attendanceRingCircumference.toFixed(2);

  function attendanceTargetValue() {
    return clamp(toNumber(attendance.target.value), 1, 99);
  }

  function setAttendanceRing(percent) {
    const bounded = clamp(percent, 0, 100);
    const offset = attendanceRingCircumference * (1 - bounded / 100);
    attendance.attendanceBar.style.strokeDashoffset = offset.toFixed(2);
    attendance.attendanceBar.style.stroke = bounded >= attendanceTargetValue() ? 'url(#attendanceGradient)' : 'var(--danger)';
  }

  function setAttendanceStatus(isOk) {
    attendance.status.classList.remove('hidden', 'status-ok', 'status-bad');
    if (isOk) {
      attendance.status.classList.add('status-ok');
      attendance.statusText.textContent = 'At or above target attendance';
      attendance.statusIcon.setAttribute('d', 'M5 13l4 4L19 7');
    } else {
      attendance.status.classList.add('status-bad');
      attendance.statusText.textContent = 'Below target attendance';
      attendance.statusIcon.setAttribute('d', 'M12 8v5m0 4h.01 M12 3l9 16H3l9-16z');
    }
  }

  function attendanceMessageFor(percent) {
    if (percent >= 90) {
      return 'Excellent margin. You can stay relaxed.';
    }
    if (percent >= 80) {
      return 'Strong position. Maintain the pattern.';
    }
    if (percent >= 75) {
      return 'Right above the line. Avoid unnecessary misses.';
    }
    if (percent >= 60) {
      return 'Recoverable, but you need consistency now.';
    }
    return 'Risk is high. Prioritize every class.';
  }

  function resetAttendanceValidation() {
    [attendance.target, attendance.scheduled, attendance.conducted, attendance.present].forEach(function (input) {
      input.classList.remove('error');
    });

    [attendance.targetHint, attendance.scheduledHint, attendance.conductedHint, attendance.presentHint].forEach(function (hint) {
      hint.textContent = '';
      hint.classList.remove('error');
    });
  }

  function setFieldError(input, hint, message) {
    input.classList.add('error');
    hint.textContent = message;
    hint.classList.add('error');
  }

  function validateAttendanceInputs(scheduled, conducted, present, target) {
    let isValid = true;
    resetAttendanceValidation();

    if ([scheduled, conducted, present, target].some(Number.isNaN)) {
      return false;
    }

    if (target < 1 || target >= 100) {
      isValid = false;
      setFieldError(attendance.target, attendance.targetHint, 'Target must be between 1 and 99.');
    }
    if (scheduled < 0) {
      isValid = false;
      setFieldError(attendance.scheduled, attendance.scheduledHint, 'Value cannot be negative.');
    }
    if (conducted < 0) {
      isValid = false;
      setFieldError(attendance.conducted, attendance.conductedHint, 'Value cannot be negative.');
    }
    if (present < 0) {
      isValid = false;
      setFieldError(attendance.present, attendance.presentHint, 'Value cannot be negative.');
    }
    if (isValid && conducted > scheduled) {
      isValid = false;
      setFieldError(attendance.conducted, attendance.conductedHint, 'Conducted lectures cannot exceed scheduled lectures.');
    }
    if (isValid && present > conducted) {
      isValid = false;
      setFieldError(attendance.present, attendance.presentHint, 'Present lectures cannot exceed conducted lectures.');
    }

    return isValid;
  }

  function computeAttendance(scheduled, conducted, present, ratio) {
    if (conducted <= 0) {
      return {
        empty: true,
        percent: 0,
        ok: false,
        need: 0,
        bunks: 0,
        remaining: Math.max(0, scheduled),
        stillNeeded: Math.max(0, Math.ceil(ratio * scheduled))
      };
    }

    const percent = (present / conducted) * 100;
    const ok = percent >= ratio * 100;
    const need = Math.max(0, Math.ceil((ratio * conducted - present) / (1 - ratio)));
    const bunks = Math.max(0, Math.floor(present / ratio - conducted));
    const finalTotal = scheduled;
    const targetAttended = Math.ceil(ratio * finalTotal);
    const remaining = Math.max(0, finalTotal - conducted);
    const stillNeeded = Math.max(0, targetAttended - present);

    return {
      empty: false,
      percent: percent,
      ok: ok,
      need: Number.isFinite(need) ? need : 0,
      bunks: Number.isFinite(bunks) ? bunks : 0,
      remaining: remaining,
      stillNeeded: stillNeeded,
      targetAttended: targetAttended,
      finalTotal: finalTotal
    };
  }

  function showAttendanceEmptyState() {
    attendance.status.classList.add('hidden');
    attendance.insightCards.classList.add('hidden');
    attendance.belowCard.classList.add('hidden');
    attendance.aboveCard.classList.add('hidden');
    attendance.progressPanel.classList.add('hidden');
    attendance.summary.classList.add('hidden');
    attendance.extraStatus.classList.add('hidden');
    attendance.subLabel.textContent = 'Attendance of conducted lectures';
    animateNumber(attendance.percentCount, 0);
    setAttendanceRing(0);
    attendance.heroAttendanceValue.textContent = '0%';
    state.attendanceLastOk = null;
  }

  function maybeCelebrateAttendance() {
    if (state.prefersReducedMotion) {
      return;
    }

    const burst = doc.createElement('div');
    burst.style.position = 'fixed';
    burst.style.inset = '0';
    burst.style.pointerEvents = 'none';
    burst.style.zIndex = '50';

    for (let index = 0; index < 42; index += 1) {
      const particle = doc.createElement('span');
      particle.style.position = 'absolute';
      particle.style.left = Math.random() * 100 + 'vw';
      particle.style.top = '-12px';
      particle.style.width = '10px';
      particle.style.height = '16px';
      particle.style.borderRadius = '3px';
      const isDark = doc.documentElement.getAttribute('data-theme') === 'dark';
      const confettiColors = isDark
        ? ['#00d4ff', '#7c6aff', '#ffd060', '#22c55e']
        : ['#1761ff', '#16c2d5', '#f8c84f', '#1ea971'];
      particle.style.background = confettiColors[index % 4];
      particle.animate([
        { transform: 'translate3d(0, 0, 0) rotate(0deg)', opacity: 1 },
        { transform: 'translate3d(' + (Math.random() * 180 - 90) + 'px, ' + (window.innerHeight * 0.7 + Math.random() * 120) + 'px, 0) rotate(' + (Math.random() * 540) + 'deg)', opacity: 0 }
      ], {
        duration: 1100 + Math.random() * 500,
        easing: 'cubic-bezier(.17,.67,.35,1)',
        fill: 'forwards'
      });
      burst.appendChild(particle);
    }

    doc.body.appendChild(burst);
    window.setTimeout(function () {
      burst.remove();
    }, 1800);
  }

  function updateAttendance() {
    const target = toNumber(attendance.target.value);
    const scheduled = parseInt(attendance.scheduled.value, 10);
    const conducted = parseInt(attendance.conducted.value, 10);
    const present = parseInt(attendance.present.value, 10);

    if (!validateAttendanceInputs(scheduled, conducted, present, target)) {
      showAttendanceEmptyState();
      return;
    }

    localStorage.setItem(storageKeys.attendanceTarget, String(target));
    localStorage.setItem(storageKeys.attendanceScheduled, String(scheduled));
    localStorage.setItem(storageKeys.attendanceConducted, String(conducted));
    localStorage.setItem(storageKeys.attendancePresent, String(present));

    const ratio = clamp(target, 1, 99) / 100;
    const targetLabel = Math.round(ratio * 100) + '%';
    const preciseTarget = (ratio * 100).toFixed(2);
    [attendance.targetLabel1, attendance.targetLabel2, attendance.targetLabel3, attendance.targetLabel4].forEach(function (element) {
      element.textContent = targetLabel;
    });
    attendance.targetPctDisplay.textContent = preciseTarget;
    attendance.progressAria.setAttribute('aria-label', 'Progress to ' + targetLabel + ' of final total');

    const result = computeAttendance(scheduled, conducted, present, ratio);

    if (result.empty) {
      showAttendanceEmptyState();
      return;
    }

    if (state.attendanceLastOk === false && result.ok) {
      maybeCelebrateAttendance();
    }
    state.attendanceLastOk = result.ok;

    setAttendanceStatus(result.ok);
    attendance.insightCards.classList.remove('hidden');
    attendance.subLabel.textContent = 'Attendance of conducted lectures';
    animateNumber(attendance.percentCount, result.percent, {
      format: function (value) {
        return Math.round(value).toString();
      }
    });
    setAttendanceRing(result.percent);
    attendance.heroAttendanceValue.textContent = Math.round(result.percent) + '%';

    if (result.ok) {
      attendance.belowCard.classList.add('hidden');
      attendance.aboveCard.classList.remove('hidden');
      animateNumber(attendance.bunkCount, result.bunks);
      attendance.moodMsg.textContent = attendanceMessageFor(result.percent);
    } else {
      attendance.aboveCard.classList.add('hidden');
      attendance.belowCard.classList.remove('hidden');
      animateNumber(attendance.needCount, result.need);
    }

    const feasible = result.stillNeeded <= result.remaining;
    attendance.progressPanel.classList.remove('hidden');
    attendance.summary.classList.remove('hidden');

    animateNumber(attendance.remainingLectures, result.remaining);
    animateNumber(attendance.stillNeededLectures, result.stillNeeded);
    attendance.stillNeededLectures.classList.remove('counter-positive', 'counter-negative', 'counter-urgent');
    attendance.stillNeededLectures.classList.add(feasible ? 'counter-positive' : 'counter-negative');
    if (!feasible) {
      attendance.stillNeededLectures.classList.add('counter-urgent');
    }

    attendance.extraStatus.classList.remove('hidden', 'status-ok', 'status-bad');
    if (feasible) {
      attendance.extraStatus.classList.add('status-ok');
      attendance.hopeText.textContent = 'Great success. Attending the remaining lectures can still get you to the target.';
    } else {
      attendance.extraStatus.classList.add('status-bad');
      attendance.hopeText.textContent = 'No feasible route remains. There are not enough lectures left to reach the target.';
    }

    animateNumber(attendance.curA, present);
    animateNumber(attendance.curB, conducted);
    animateNumber(attendance.curPct, result.percent, {
      format: function (value) {
        return value.toFixed(2);
      }
    });
    animateNumber(attendance.reqA, result.targetAttended);
    animateNumber(attendance.reqB, result.finalTotal);
    attendance.finalTotalDisplay.textContent = String(result.finalTotal);
    animateNumber(attendance.remainCount, result.remaining);
    animateNumber(attendance.needTo75, result.stillNeeded);

    const progressPercent = result.targetAttended > 0 ? clamp((present / result.targetAttended) * 100, 0, 100) : 100;
    attendance.progressInner.style.width = progressPercent.toFixed(2) + '%';
    attendance.feasibilityBadge.classList.remove('feasibility-good', 'feasibility-bad');
    if (feasible) {
      attendance.feasibilityBadge.classList.add('feasibility-good');
      attendance.feasibilityBadge.textContent = 'Reachable';
      attendance.feasText.textContent = 'You can still reach the target by attending all remaining lectures.';
    } else {
      attendance.feasibilityBadge.classList.add('feasibility-bad');
      attendance.feasibilityBadge.textContent = 'Not Reachable';
      attendance.feasText.textContent = 'Even perfect attendance for the rest of the term will not be enough.';
    }
  }

  function initAttendance() {
    attendance.target.value = localStorage.getItem(storageKeys.attendanceTarget) || '75';
    attendance.scheduled.value = localStorage.getItem(storageKeys.attendanceScheduled) || '';
    attendance.conducted.value = localStorage.getItem(storageKeys.attendanceConducted) || '';
    attendance.present.value = localStorage.getItem(storageKeys.attendancePresent) || '';

    [attendance.target, attendance.scheduled, attendance.conducted, attendance.present].forEach(function (input) {
      input.addEventListener('input', updateAttendance);
      input.addEventListener('change', updateAttendance);
    });

    attendance.quickButton.addEventListener('click', function () {
      const ratio = attendanceTargetValue() / 100;
      let conductedValue = parseInt(attendance.conducted.value || '100', 10);
      if (!Number.isFinite(conductedValue) || conductedValue < 0) {
        conductedValue = 100;
      }
      attendance.conducted.value = String(conductedValue);

      let scheduledValue = parseInt(attendance.scheduled.value || '0', 10);
      if (!Number.isFinite(scheduledValue) || scheduledValue < conductedValue) {
        scheduledValue = conductedValue;
        attendance.scheduled.value = String(scheduledValue);
      }

      attendance.present.value = String(Math.floor(ratio * conductedValue));
      updateAttendance();
    });

    attendance.resetButton.addEventListener('click', function () {
      attendance.target.value = '75';
      attendance.scheduled.value = '';
      attendance.conducted.value = '';
      attendance.present.value = '';
      localStorage.removeItem(storageKeys.attendanceTarget);
      localStorage.removeItem(storageKeys.attendanceScheduled);
      localStorage.removeItem(storageKeys.attendanceConducted);
      localStorage.removeItem(storageKeys.attendancePresent);
      updateAttendance();
    });

    updateAttendance();
  }

  // SGPA calculator state and row management.
  const sgpa = {
    rows: $('#rows'),
    addButton: $('#addRowBtn'),
    resetButton: $('#resetSgpaBtn'),
    value: $('#sgpaValue'),
    credits: $('#totalCredits'),
    help: $('#sgpaHelp'),
    card: $('#sgpaCard'),
    heroValue: $('#heroSgpaValue'),
    subjectCount: $('#heroSubjectCount')
  };

  function sgpaFormat(value) {
    return Number(value).toFixed(2);
  }

  function parseMaybeNumber(value) {
    if (value === '' || value === null || value === undefined) {
      return null;
    }
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  function createSubjectRow(values, focusMarks) {
    const initialValues = values || { marks: '', credits: '' };
    state.sgpaRowId += 1;

    const row = doc.createElement('article');
    row.className = 'subject-row';
    row.dataset.rowId = String(state.sgpaRowId);

    const marksField = doc.createElement('div');
    marksField.className = 'field-stack';
    marksField.innerHTML = '<span class="field-caption">Obtained Marks</span>';
    const marksInput = doc.createElement('input');
    marksInput.className = 'input-control';
    marksInput.type = 'number';
    marksInput.min = '0';
    marksInput.max = '100';
    marksInput.step = '0.01';
    marksInput.inputMode = 'decimal';
    marksInput.placeholder = '80';
    marksInput.setAttribute('aria-label', 'Obtained marks out of 100');
    marksInput.value = initialValues.marks;
    const marksHint = doc.createElement('p');
    marksHint.className = 'helper-text';
    marksField.appendChild(marksInput);
    marksField.appendChild(marksHint);

    const creditsField = doc.createElement('div');
    creditsField.className = 'field-stack';
    creditsField.innerHTML = '<span class="field-caption">Credits</span>';
    const creditsInput = doc.createElement('input');
    creditsInput.className = 'input-control';
    creditsInput.type = 'number';
    creditsInput.min = '0.01';
    creditsInput.step = '0.01';
    creditsInput.inputMode = 'decimal';
    creditsInput.placeholder = '3';
    creditsInput.setAttribute('aria-label', 'Subject credits');
    creditsInput.value = initialValues.credits;
    const creditsHint = doc.createElement('p');
    creditsHint.className = 'helper-text';
    creditsField.appendChild(creditsInput);
    creditsField.appendChild(creditsHint);

    const gpChip = doc.createElement('div');
    gpChip.className = 'gp-chip';
    gpChip.textContent = 'GP: --';

    const removeButton = doc.createElement('button');
    removeButton.className = 'remove-row-button';
    removeButton.type = 'button';
    removeButton.textContent = 'Remove';
    removeButton.addEventListener('click', function () {
      removeSubjectRow(row);
    });

    row.appendChild(marksField);
    row.appendChild(creditsField);
    row.appendChild(gpChip);
    row.appendChild(removeButton);

    function onInput() {
      scheduleSgpaRecalc();
    }

    marksInput.addEventListener('input', onInput);
    creditsInput.addEventListener('input', onInput);
    sgpa.rows.appendChild(row);
    updateSubjectCount();

    if (focusMarks) {
      marksInput.focus();
    }

    scheduleSgpaRecalc();
  }

  function removeSubjectRow(row) {
    if (sgpa.rows.children.length === 1) {
      row.querySelector('input').focus();
      return;
    }

    row.classList.add('removing');
    window.setTimeout(function () {
      row.remove();
      updateSubjectCount();
      scheduleSgpaRecalc();
    }, state.prefersReducedMotion ? 0 : 220);
  }

  function validateSubjectRow(row) {
    const marksInput = row.children[0].querySelector('input');
    const marksHint = row.children[0].querySelector('.helper-text');
    const creditsInput = row.children[1].querySelector('input');
    const creditsHint = row.children[1].querySelector('.helper-text');
    const gpChip = row.children[2];

    let valid = true;
    const marks = parseMaybeNumber(marksInput.value);
    const credits = parseMaybeNumber(creditsInput.value);

    marksHint.textContent = '';
    creditsHint.textContent = '';
    row.classList.remove('invalid');
    marksInput.classList.remove('error');
    creditsInput.classList.remove('error');

    if (marks === null || marks < 0 || marks > 100) {
      valid = false;
      row.classList.add('invalid');
      marksInput.classList.add('error');
      marksHint.textContent = 'Enter marks from 0 to 100.';
    }
    if (credits === null || credits <= 0) {
      valid = false;
      row.classList.add('invalid');
      creditsInput.classList.add('error');
      creditsHint.textContent = 'Credits must be greater than 0.';
    }

    if (!valid) {
      gpChip.textContent = 'GP: --';
      return null;
    }

    const gradePoint = (marks / 100) * 10;
    gpChip.textContent = 'GP: ' + sgpaFormat(gradePoint);
    return {
      marks: marks,
      credits: credits,
      gradePoint: gradePoint
    };
  }

  function collectSubjectRows() {
    const rows = [];
    Array.from(sgpa.rows.children).forEach(function (row) {
      const result = validateSubjectRow(row);
      if (result) {
        rows.push(result);
      }
    });
    return rows;
  }

  function computeSgpa(rows) {
    let weightedTotal = 0;
    let totalCredits = 0;
    rows.forEach(function (row) {
      weightedTotal += row.credits * row.gradePoint;
      totalCredits += row.credits;
    });

    if (!totalCredits) {
      return { sgpa: null, credits: 0 };
    }

    return {
      sgpa: weightedTotal / totalCredits,
      credits: totalCredits
    };
  }

  function pulseSgpaCard() {
    sgpa.card.classList.remove('sgpa-card-pulse');
    void sgpa.card.offsetWidth;
    sgpa.card.classList.add('sgpa-card-pulse');
  }

  function updateSgpaOutput(nextSgpa, totalCredits) {
    if (nextSgpa === null) {
      sgpa.value.textContent = '--';
      sgpa.credits.textContent = 'Total Credits: 0';
      sgpa.help.textContent = 'Add subjects and enter marks to begin.';
      sgpa.heroValue.textContent = '--';
      state.sgpaAnimationValue = null;
      persistSgpaRows();
      return;
    }

    const finalValue = Number(sgpaFormat(nextSgpa));
    const startValue = state.sgpaAnimationValue === null ? finalValue : state.sgpaAnimationValue;
    const animationDuration = state.prefersReducedMotion ? 0 : 700;
    sgpa.credits.textContent = 'Total Credits: ' + sgpaFormat(totalCredits).replace(/\.00$/, '');
    sgpa.help.textContent = 'Weighted average using marks-to-grade-point conversion.';
    pulseSgpaCard();

    if (animationDuration === 0) {
      sgpa.value.textContent = sgpaFormat(finalValue);
      sgpa.heroValue.textContent = sgpaFormat(finalValue);
      state.sgpaAnimationValue = finalValue;
      persistSgpaRows();
      return;
    }

    const startedAt = performance.now();
    function frame(now) {
      const progress = clamp((now - startedAt) / animationDuration, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (finalValue - startValue) * eased;
      const rendered = sgpaFormat(current);
      sgpa.value.textContent = rendered;
      sgpa.heroValue.textContent = rendered;

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        state.sgpaAnimationValue = finalValue;
        sgpa.value.textContent = sgpaFormat(finalValue);
        sgpa.heroValue.textContent = sgpaFormat(finalValue);
        persistSgpaRows();
      }
    }

    requestAnimationFrame(frame);
  }

  function scheduleSgpaRecalc() {
    window.clearTimeout(state.sgpaDebounceTimer);
    state.sgpaDebounceTimer = window.setTimeout(recalculateSgpa, 120);
  }

  function recalculateSgpa() {
    const validRows = collectSubjectRows();
    const result = computeSgpa(validRows);
    updateSgpaOutput(result.sgpa, result.credits);
  }

  function serializeSgpaRows() {
    return Array.from(sgpa.rows.children).map(function (row) {
      return {
        marks: row.children[0].querySelector('input').value,
        credits: row.children[1].querySelector('input').value
      };
    });
  }

  function persistSgpaRows() {
    localStorage.setItem(storageKeys.sgpaRows, JSON.stringify(serializeSgpaRows()));
  }

  function updateSubjectCount() {
    sgpa.subjectCount.textContent = String(sgpa.rows.children.length || 0);
  }

  function resetSgpa() {
    sgpa.rows.innerHTML = '';
    state.sgpaAnimationValue = null;
    createSubjectRow({ marks: '', credits: '' }, false);
    updateSgpaOutput(null, 0);
  }

  function initSgpa() {
    sgpa.addButton.addEventListener('click', function () {
      createSubjectRow({ marks: '', credits: '' }, true);
    });

    sgpa.resetButton.addEventListener('click', function () {
      localStorage.removeItem(storageKeys.sgpaRows);
      resetSgpa();
    });

    const savedRows = localStorage.getItem(storageKeys.sgpaRows);
    if (savedRows) {
      try {
        const parsedRows = JSON.parse(savedRows);
        if (Array.isArray(parsedRows) && parsedRows.length > 0) {
          parsedRows.forEach(function (row, index) {
            createSubjectRow({ marks: row.marks || '', credits: row.credits || '' }, index === 0 && false);
          });
          scheduleSgpaRecalc();
          return;
        }
      } catch (error) {
        localStorage.removeItem(storageKeys.sgpaRows);
      }
    }

    createSubjectRow({ marks: '', credits: '' }, false);
    updateSgpaOutput(null, 0);
  }

  // Lightweight debug tests retained for quick console verification.
  function approxEqual(left, right, epsilon) {
    return Math.abs(left - right) <= (epsilon || 0.01);
  }

  window.runAcademicDashboardTests = function () {
    const rows = [
      { marks: 80, credits: 3, gradePoint: 8 },
      { marks: 70, credits: 4, gradePoint: 7 },
      { marks: 50, credits: 2, gradePoint: 5 }
    ];
    const result = computeSgpa(rows);
    console.assert(approxEqual(Number(sgpaFormat(result.sgpa)), 6.89), 'Expected SGPA 6.89');
    console.assert(approxEqual(result.credits, 9), 'Expected total credits 9');

    const attendanceResult = computeAttendance(120, 100, 76, 0.75);
    console.assert(attendanceResult.ok === true, 'Attendance should be above 75 percent');
    console.assert(attendanceResult.bunks >= 0, 'Bunks should be non-negative');
    console.log('Academic dashboard tests passed');
  };

  initTheme();
  initAttendance();
  initSgpa();
})();