using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace SimuladorFinanciero.Api.Services;

public interface IEmailService
{
    Task EnviarEmailAsync(string destinatario, string asunto, string cuerpoHtml);
}

public class SmtpEmailService : IEmailService
{
    private readonly IConfiguration _config;

    public SmtpEmailService(IConfiguration config) => _config = config;

    public async Task EnviarEmailAsync(string destinatario, string asunto, string cuerpoHtml)
    {
        var host     = _config["Smtp:Host"] ?? throw new InvalidOperationException("Smtp:Host no está configurado.");
        var port     = int.Parse(_config["Smtp:Port"] ?? "587");
        var user     = _config["Smtp:User"] ?? throw new InvalidOperationException("Smtp:User no está configurado.");
        var password = _config["Smtp:Password"] ?? throw new InvalidOperationException("Smtp:Password no está configurado.");
        var fromName = _config["Smtp:FromName"] ?? "InvestLab";

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(fromName, user));
        message.To.Add(MailboxAddress.Parse(destinatario));
        message.Subject = asunto;
        message.Body = new TextPart("html") { Text = cuerpoHtml };

        using var client = new SmtpClient();
        await client.ConnectAsync(host, port, SecureSocketOptions.StartTls);
        await client.AuthenticateAsync(user, password);
        await client.SendAsync(message);
        await client.DisconnectAsync(true);
    }
}
