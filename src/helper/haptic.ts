/**
 * Light tap haptic. Call from a click handler (needs a user gesture).
 * Android: Vibration API. iOS 18+ Safari has no `vibrate`, but toggling a native `<input switch>` plays the system
 * tap haptic, so click a throwaway hidden one. Elsewhere it's a silent no-op.
 */
export function haptic() {
  if ("vibrate" in navigator) {
    navigator.vibrate(10);
    return;
  }
  const label = document.createElement("label");
  label.ariaHidden = "true";
  label.style.display = "none";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  label.append(input);
  document.head.append(label);
  label.click();
  label.remove();
}
