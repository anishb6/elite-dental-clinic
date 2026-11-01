/** Mandatory, affirmative privacy-consent checkbox (the server stores when and what was accepted). */
export function PrivacyConsentField({ error }: { error?: string | undefined }) {
  return (
    <div className="sm:col-span-2 flex flex-col gap-1 pt-1">
      <div className="flex items-start gap-2.5">
        <input
          id="privacy_consent"
          name="privacy_consent"
          type="checkbox"
          required
          aria-describedby="privacy-consent-hint"
          aria-invalid={Boolean(error)}
          className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-ring"
        />
        <label
          htmlFor="privacy_consent"
          id="privacy-consent-hint"
          className="text-xs text-muted-foreground leading-snug"
        >
          I consent to Elite Dental Clinic processing my contact details to coordinate and confirm
          my dental appointment. Details will not be shared with third parties for marketing.{" "}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            View Privacy Notice
          </a>
          .
        </label>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
