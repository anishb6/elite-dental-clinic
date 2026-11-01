/**
 * Bot trap. Hidden from real visitors with CSS; bots tend to fill in every field.
 * The form and the server both silently discard a submission where `website` is filled in.
 * `aria-hidden` + `tabIndex={-1}` keep it away from assistive tech and keyboard users.
 */
export function HoneypotField() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "-9999px",
        width: "1px",
        height: "1px",
        overflow: "hidden",
      }}
    >
      <label htmlFor="website-hp">Website</label>
      <input id="website-hp" name="website" type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}
