/**
 * Meet Hang-Up Guard — Content Script
 *
 * Watches for the "Leave call" button in Google Meet's DOM,
 * injects a lock overlay, and requires confirmation before hanging up.
 */

(function meetHangUpGuard() {
  "use strict";

  const BUTTON_ARIA_LABEL = "Leave call";
  const LOCK_ICON_URL = chrome.runtime.getURL("lock-icon.svg");

  // Gemini sidebar selectors — verify these against live Meet DOM
  const GEMINI_TOGGLE_LABELS = ["Ask Gemini", "Gemini"];
  const GEMINI_SEND_LABELS = ["Send", "Submit"];
  const GEMINI_SIDEBAR_TIMEOUT_MS = 5000;

  const SUMMARY_PROMPT =
    "This is an AI summary of a 1:1 meeting, help me summarize it in a few bullet points " +
    "(split by topic discussed) with takeaway and actions.\n" +
    "Keep it short, no more than 10 topics, the less the better.\n" +
    "Topics points shorter than 50 words.\n" +
    "Actions shorter than 30 words.\n" +
    "Follow the Structure:\n" +
    "Notes: - topic description - topic comment1 / 2 / 3…\n" +
    "Actions: - Action 1 / 2 / 3";

  let overlay = null;
  let hangUpButton = null;
  let resizeObserver = null;
  let dialogBackdrop = null;

  // ── Overlay positioning ──────────────────────────────────────────

  function positionOverlay() {
    if (!overlay || !hangUpButton) return;
    const rect = hangUpButton.getBoundingClientRect();
    overlay.style.top = rect.top + "px";
    overlay.style.left = rect.left + "px";
    overlay.style.width = rect.width + "px";
    overlay.style.height = rect.height + "px";
  }

  // ── Toast notification ───────────────────────────────────────────

  function showToast(msg) {
    const toast = document.createElement("div");
    toast.className = "mhg-toast";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.remove();
    }, 3000);
  }

  // ── Gemini sidebar interaction ───────────────────────────────────

  function findGeminiToggle() {
    for (const label of GEMINI_TOGGLE_LABELS) {
      const btn = document.querySelector('[aria-label="' + label + '"]');
      if (btn) return btn;
    }
    return null;
  }

  function findGeminiSendButton(container) {
    for (const label of GEMINI_SEND_LABELS) {
      const btn = container.querySelector('[aria-label="' + label + '"]');
      if (btn) return btn;
    }
    // Fallback: look for a submit-type button
    return container.querySelector('button[type="submit"]');
  }

  function injectPromptIntoField(field) {
    if (field.isContentEditable) {
      field.focus();
      field.textContent = SUMMARY_PROMPT;
      field.dispatchEvent(
        new InputEvent("input", { bubbles: true, inputType: "insertText" })
      );
    } else {
      // input or textarea
      const nativeSetter = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(field),
        "value"
      );
      if (nativeSetter && nativeSetter.set) {
        nativeSetter.set.call(field, SUMMARY_PROMPT);
      } else {
        field.value = SUMMARY_PROMPT;
      }
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function waitForInputAndSubmit() {
    const deadline = Date.now() + GEMINI_SIDEBAR_TIMEOUT_MS;

    const sidebarObserver = new MutationObserver(function () {
      if (Date.now() > deadline) {
        sidebarObserver.disconnect();
        showToast("Gemini input field not found");
        return;
      }

      // Look for an input/textarea or contenteditable inside the sidebar
      const field =
        document.querySelector(
          '[aria-label*="Ask Gemini"] input, [aria-label*="Ask Gemini"] textarea, ' +
          '[aria-label*="Ask Gemini"] [contenteditable="true"], ' +
          '[aria-label*="Gemini"] input, [aria-label*="Gemini"] textarea, ' +
          '[aria-label*="Gemini"] [contenteditable="true"]'
        ) ||
        // Broader fallback: any visible input/textarea near the sidebar
        document.querySelector(
          '[role="complementary"] input, [role="complementary"] textarea, ' +
          '[role="complementary"] [contenteditable="true"]'
        );

      if (!field) return;

      sidebarObserver.disconnect();
      injectPromptIntoField(field);

      // Brief delay for UI to register the input before clicking send
      setTimeout(function () {
        const container = field.closest('[role="complementary"]') || document.body;
        const sendBtn = findGeminiSendButton(container);
        if (sendBtn) {
          sendBtn.click();
        } else {
          // Fallback: try Enter key
          field.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "Enter",
              code: "Enter",
              keyCode: 13,
              bubbles: true,
            })
          );
        }
      }, 300);
    });

    sidebarObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function triggerGeminiSummary() {
    const geminiBtn = findGeminiToggle();
    if (!geminiBtn) {
      showToast("Gemini is not available");
      return;
    }
    geminiBtn.click();
    waitForInputAndSubmit();
  }

  // ── Confirmation dialog ──────────────────────────────────────────

  function showDialog() {
    if (dialogBackdrop) return; // already open

    dialogBackdrop = document.createElement("div");
    dialogBackdrop.className = "mhg-backdrop";
    dialogBackdrop.setAttribute("role", "dialog");
    dialogBackdrop.setAttribute("aria-modal", "true");
    dialogBackdrop.setAttribute("aria-label", "Confirm leaving call");

    const dialog = document.createElement("div");
    dialog.className = "mhg-dialog";

    const title = document.createElement("h2");
    title.className = "mhg-dialog-title";
    title.textContent = "Leave this call?";

    const message = document.createElement("p");
    message.className = "mhg-dialog-message";
    message.textContent =
      "You clicked the hang-up button. Are you sure you want to leave?";

    const actions = document.createElement("div");
    actions.className = "mhg-dialog-actions";

    const summarizeBtn = document.createElement("button");
    summarizeBtn.className = "mhg-btn mhg-btn-summarize";
    summarizeBtn.textContent = "Summarize & Stay";

    const leaveBtn = document.createElement("button");
    leaveBtn.className = "mhg-btn mhg-btn-leave";
    leaveBtn.textContent = "Leave call";

    const stayBtn = document.createElement("button");
    stayBtn.className = "mhg-btn mhg-btn-stay";
    stayBtn.textContent = "Stay";

    actions.appendChild(summarizeBtn);
    actions.appendChild(leaveBtn);
    actions.appendChild(stayBtn);
    dialog.appendChild(title);
    dialog.appendChild(message);
    dialog.appendChild(actions);
    dialogBackdrop.appendChild(dialog);
    document.body.appendChild(dialogBackdrop);

    // Focus "Stay" by default — safe choice
    stayBtn.focus();

    // ── Dialog event handlers ──

    stayBtn.addEventListener("click", dismissDialog);

    leaveBtn.addEventListener("click", function () {
      dismissDialog();
      leaveCall();
    });

    summarizeBtn.addEventListener("click", function () {
      dismissDialog();
      triggerGeminiSummary();
    });

    // Escape dismisses
    dialogBackdrop.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        dismissDialog();
      }
      // Trap tab focus inside dialog
      if (e.key === "Tab") {
        const focusable = [summarizeBtn, leaveBtn, stayBtn];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    // Click outside dialog dismisses
    dialogBackdrop.addEventListener("click", function (e) {
      if (e.target === dialogBackdrop) {
        dismissDialog();
      }
    });
  }

  function dismissDialog() {
    if (dialogBackdrop) {
      dialogBackdrop.remove();
      dialogBackdrop = null;
    }
    // Return focus to overlay
    if (overlay) overlay.focus();
  }

  // ── Leave call ───────────────────────────────────────────────────

  function leaveCall() {
    if (!hangUpButton) return;
    // Save reference before removeOverlay nulls it
    const btn = hangUpButton;
    removeOverlay();
    btn.click();
  }

  // ── Overlay lifecycle ────────────────────────────────────────────

  function injectOverlay(button) {
    if (overlay) return; // already guarding
    hangUpButton = button;

    overlay = document.createElement("button");
    overlay.className = "mhg-lock-overlay";
    overlay.setAttribute("aria-label", "Hang-up button is locked. Click to unlock.");
    overlay.setAttribute("title", "Click to leave call");
    overlay.type = "button";

    const icon = document.createElement("img");
    icon.src = LOCK_ICON_URL;
    icon.alt = "Locked";
    icon.setAttribute("draggable", "false");
    overlay.appendChild(icon);

    document.body.appendChild(overlay);
    positionOverlay();

    // Click overlay → show confirmation
    overlay.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      showDialog();
    });

    // Keep overlay aligned on resize
    resizeObserver = new ResizeObserver(positionOverlay);
    resizeObserver.observe(hangUpButton);
    window.addEventListener("resize", positionOverlay);
    window.addEventListener("scroll", positionOverlay, true);
  }

  function removeOverlay() {
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    window.removeEventListener("resize", positionOverlay);
    window.removeEventListener("scroll", positionOverlay, true);
    hangUpButton = null;
    dismissDialog();
  }

  // ── DOM observation ──────────────────────────────────────────────

  function findHangUpButton() {
    return document.querySelector(
      '[aria-label="' + BUTTON_ARIA_LABEL + '"]'
    );
  }

  function scan() {
    const button = findHangUpButton();
    if (button && !overlay) {
      injectOverlay(button);
    } else if (!button && overlay) {
      // Button removed (call ended or navigated away)
      removeOverlay();
    }
  }

  const observer = new MutationObserver(function () {
    scan();
  });

  function startObserving() {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
    // Initial scan in case button is already present
    scan();
  }

  // ── SPA navigation handling ──────────────────────────────────────

  // Meet is a SPA — re-scan on navigation
  const originalPushState = history.pushState;
  history.pushState = function () {
    originalPushState.apply(this, arguments);
    scan();
  };

  window.addEventListener("popstate", scan);

  // ── Boot ─────────────────────────────────────────────────────────

  if (document.body) {
    startObserving();
  } else {
    document.addEventListener("DOMContentLoaded", startObserving);
  }
})();
