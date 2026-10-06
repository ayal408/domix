using System.Net;

namespace serverApi.Services.Implementations;

/// <summary>All system-generated email text, in the same languages as the client.</summary>
public static class EmailText
{
    public static string Language(string? language)
    {
        var value = language?.Trim().ToLowerInvariant().Split('-', '_')[0];
        return value is "en" or "es" or "fr" or "he" ? value : "he";
    }
    public static string Pick(string? language, string he, string en, string es, string fr) => Language(language) switch
    {
        "en" => en, "es" => es, "fr" => fr, _ => he
    };
    public static string Safe(string? value) => WebUtility.HtmlEncode(value ?? "");
    public static string Paragraph(string value) => "<p>" + Safe(value).Replace("\n", "<br>") + "</p>";
    public static string Footer(string? language) => Pick(language, "DOMIX — הבית הבא שלך מתחיל כאן.", "DOMIX — find your next home.", "DOMIX — encuentra tu próximo hogar.", "DOMIX — trouvez votre prochain logement.");

    public static (string Subject, string Html) Verification(string name, string url, string? language)
    {
        var title = Pick(language, "אימות כתובת המייל שלך ב־DOMIX", "Confirm your DOMIX email address", "Confirma tu correo de DOMIX", "Confirmez votre adresse e-mail DOMIX");
        var greeting = Pick(language, $"שלום {name},", $"Hi {name},", $"Hola {name},", $"Bonjour {name},");
        var text = Pick(language, "יש לאמת את כתובת המייל כדי להשלים את יצירת החשבון. הקישור תקף ל־24 שעות.", "Please confirm your email address to finish setting up your account. This link expires in 24 hours.", "Confirma tu correo para completar la creación de tu cuenta. El enlace caduca en 24 horas.", "Confirmez votre adresse e-mail pour terminer la création de votre compte. Ce lien expire dans 24 heures.");
        var button = Pick(language, "אימות כתובת המייל", "Verify my email", "Verificar mi correo", "Vérifier mon adresse e-mail");
        return (title, EmailTemplates.Render(title, Paragraph(greeting) + Paragraph(text), button, url, language));
    }
    public static (string Subject, string Html) PasswordReset(string name, string url, string? language)
    {
        var title = Pick(language, "איפוס הסיסמה שלך ב־DOMIX", "Reset your DOMIX password", "Restablece tu contraseña de DOMIX", "Réinitialisez votre mot de passe DOMIX");
        var text = Pick(language, $"שלום {name}, התקבלה בקשה לאיפוס הסיסמה שלך. ניתן לבחור סיסמה חדשה באמצעות הכפתור. הקישור תקף ל־24 שעות.", $"Hi {name}, we received a request to reset your password. Choose a new one using the button below. This link expires in 24 hours.", $"Hola {name}, recibimos una solicitud para restablecer tu contraseña. Elige una nueva con el botón. El enlace caduca en 24 horas.", $"Bonjour {name}, nous avons reçu une demande de réinitialisation de votre mot de passe. Choisissez-en un nouveau avec le bouton. Ce lien expire dans 24 heures.");
        var ignore = Pick(language, "אם לא ביקשת לאפס את הסיסמה, אפשר להתעלם מהמייל.", "If you did not request this, you can safely ignore this email.", "Si no lo solicitaste, puedes ignorar este correo.", "Si vous n’avez pas fait cette demande, vous pouvez ignorer cet e-mail.");
        var button = Pick(language, "בחירת סיסמה חדשה", "Reset my password", "Restablecer mi contraseña", "Réinitialiser mon mot de passe");
        return (title, EmailTemplates.Render(title, Paragraph(text) + Paragraph(ignore), button, url, language));
    }
    public static (string Subject, string Html) Message(string name, string content, string url, string? language)
    {
        var title = Pick(language, $"הודעה חדשה מ־{name} ב־DOMIX", $"New DOMIX message from {name}", $"Nuevo mensaje de {name} en DOMIX", $"Nouveau message de {name} sur DOMIX");
        var button = Pick(language, "מענה ב־DOMIX", "Reply on DOMIX", "Responder en DOMIX", "Répondre sur DOMIX");
        return (title, EmailTemplates.Render(title, Paragraph(content), button, url, language));
    }
    public static (string Subject, string Html) Support(string name, string message, string? transcript, string reference, string url, string? language, bool receipt)
    {
        var title = receipt
            ? Pick(language, "פנייתך לתמיכת DOMIX התקבלה", "We received your DOMIX support request", "Recibimos tu solicitud de soporte de DOMIX", "Votre demande d’assistance DOMIX a été reçue")
            : Pick(language, "פנייה חדשה לתמיכת DOMIX", "New DOMIX support request", "Nueva solicitud de soporte de DOMIX", "Nouvelle demande d’assistance DOMIX");
        var intro = receipt
            ? Pick(language, "הפנייה נשמרה והועברה לצוות התמיכה. תוכן הפנייה מופיע בהמשך.", "Your request was saved and forwarded to our support team. Your message is shown below.", "Tu solicitud se guardó y se envió al equipo de soporte. Tu mensaje aparece a continuación.", "Votre demande a été enregistrée et transmise à notre équipe. Votre message figure ci-dessous.")
            : Pick(language, $"התקבלה פנייה מ־{name}.", $"A request was received from {name}.", $"Se recibió una solicitud de {name}.", $"Une demande a été reçue de {name}.");
        var refLabel = Pick(language, "מספר פנייה", "Request reference", "Referencia", "Référence");
        var body = Paragraph(intro) + Paragraph(refLabel + ": " + reference) + Paragraph(message);
        if (!receipt && !string.IsNullOrWhiteSpace(transcript))
            body += "<hr>" + Paragraph(Pick(language, "תמליל השיחה", "Conversation transcript", "Transcripción de la conversación", "Transcription de la conversation")) + Paragraph(transcript);
        var button = Pick(language, "פתיחת תיבת התמיכה", "Open support inbox", "Abrir bandeja de soporte", "Ouvrir la boîte d’assistance");
        return (title, EmailTemplates.Render(title, body, receipt ? null : button, receipt ? null : url, language));
    }
    public static string MatchesTitle(string name, int count, string? language) => Pick(language,
        $"DOMIX — {count} התאמות חדשות לחיפוש ״{name}״", $"DOMIX — {count} new matches for \"{name}\"", $"DOMIX — {count} nuevas coincidencias para «{name}»", $"DOMIX — {count} nouveaux résultats pour «{name}»");
}
