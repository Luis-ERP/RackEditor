const STORAGE_KEY = 'rack-editor:tutorial-progress';

function loadCompletedLabsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCompletedLabsToStorage(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {}
}

export function createTutorialStore() {
  let _activeLab = null;
  let _currentStepIndex = 0;
  let _completedLabs = new Set(
    typeof window !== 'undefined' ? loadCompletedLabsFromStorage() : [],
  );
  let _collapsed = false;

  const _listeners = [];

  function _notify() {
    for (const fn of _listeners) fn();
  }

  function subscribe(listener) {
    _listeners.push(listener);
    return () => {
      const idx = _listeners.indexOf(listener);
      if (idx >= 0) _listeners.splice(idx, 1);
    };
  }

  function startLab(labDefinition) {
    _activeLab = labDefinition;
    _currentStepIndex = 0;
    _collapsed = false;
    _notify();
  }

  function goBack() {
    if (!_activeLab || _currentStepIndex === 0) return;
    _currentStepIndex--;
    _notify();
  }

  function advanceStep() {
    if (!_activeLab) return;
    if (_currentStepIndex < _activeLab.steps.length - 1) {
      _currentStepIndex++;
      _notify();
    } else {
      completeLab();
    }
  }

  function completeLab() {
    if (!_activeLab) return;
    _completedLabs.add(_activeLab.id);
    saveCompletedLabsToStorage([..._completedLabs]);
    _activeLab = null;
    _notify();
  }

  function exitLab() {
    _activeLab = null;
    _notify();
  }

  function setCollapsed(v) {
    _collapsed = v;
    _notify();
  }

  function resetProgress() {
    _completedLabs.clear();
    saveCompletedLabsToStorage([]);
    _notify();
  }

  function getState() {
    return {
      activeLab: _activeLab,
      currentStepIndex: _currentStepIndex,
      currentStep: _activeLab?.steps[_currentStepIndex] ?? null,
      totalSteps: _activeLab?.steps.length ?? 0,
      completedLabs: new Set(_completedLabs),
      collapsed: _collapsed,
      isActive: Boolean(_activeLab),
    };
  }

  return {
    subscribe,
    startLab,
    goBack,
    advanceStep,
    completeLab,
    exitLab,
    setCollapsed,
    resetProgress,
    getState,
  };
}
