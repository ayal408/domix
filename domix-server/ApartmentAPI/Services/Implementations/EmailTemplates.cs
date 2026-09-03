namespace serverApi.Services.Implementations
{
    /// <summary>
    /// Wraps transactional email content in DOMIX's branding — table-based layout with inline
    /// styles throughout (not a stylesheet), since that's what actually renders consistently across
    /// Gmail, Outlook and Apple Mail. A solid `background-color` always precedes the CSS gradient so
    /// clients that ignore gradients (Outlook desktop) still get the right brand color, not a blank.
    /// </summary>
    public static class EmailTemplates
    {
        private const string Primary = "#7c3aed";
        private const string BrandGradient = "linear-gradient(90deg,#7c3aed,#10b981)";
        private const string Background = "#f7f8fa";
        private const string Foreground = "#14151a";
        private const string Muted = "#6b7280";
        private const string Border = "#e3e5ea";
        private const string FontStack = "Arial, Helvetica, sans-serif";

        /// <param name="heading">Plain text, HTML-encoded by the caller if it contains user input.</param>
        /// <param name="bodyHtml">Already-safe HTML (the caller HTML-encodes any interpolated user input).</param>
        /// <param name="ctaText">Button label; omit together with <paramref name="ctaUrl"/> for a plain notice email.</param>
        public static string Render(string heading, string bodyHtml, string? ctaText = null, string? ctaUrl = null)
        {
            var cta = ctaText != null && ctaUrl != null
                ? $"""
                   <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 4px;">
                     <tr>
                       <td style="background-color:{Primary};background:{BrandGradient};border-radius:8px;">
                         <a href="{ctaUrl}" style="display:inline-block;padding:12px 28px;font-family:{FontStack};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">{ctaText}</a>
                       </td>
                     </tr>
                   </table>
                   """
                : "";

            return $"""
                <!DOCTYPE html>
                <html>
                <body style="margin:0;padding:0;background-color:{Background};font-family:{FontStack};">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:{Background};padding:32px 16px;">
                    <tr>
                      <td align="center">
                        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid {Border};">
                          <tr>
                            <td style="background-color:{Primary};background:{BrandGradient};padding:22px 32px;">
                              <span style="font-family:{FontStack};font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">DOMIX</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:32px;">
                              <h1 style="margin:0 0 16px;font-family:{FontStack};font-size:20px;color:{Foreground};">{heading}</h1>
                              <div style="font-family:{FontStack};font-size:15px;line-height:1.6;color:{Foreground};">{bodyHtml}</div>
                              {cta}
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:18px 32px;background-color:{Background};border-top:1px solid {Border};">
                              <p style="margin:0;font-family:{FontStack};font-size:12px;color:{Muted};">DOMIX &mdash; find your next home.</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
                """;
        }
    }
}
