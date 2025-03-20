const BOT_TOKEN = '8187353779:AAGps6cekrxUmKvYnXV9janleVGRd3wYuE8';
const API_URL = `https://api.telegram.org/bot${8187353779:AAGps6cekrxUmKvYnXV9janleVGRd3wYuE8}/`;

const checkProxyUrl = 'https://prod-test.jdevcloud.com/check';
const geoIpUrl = 'https://api.ip.sb/geoip/';

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (path === '/webhook' && method === 'POST') {
        const requestBody = await request.json();
        const message = requestBody.message?.text;

        if (message && message.match(/^\/check (.+):(\d+)$/)) {
            const match = message.match(/^\/check (.+):(\d+)$/);
            const ip = match[1] || "1.1.1.1";
            const port = match[2] || "443";

            const proxyResult = await isProxy(ip, port);
            const ipDetails = await getIpDetails(ip);
            let responseText;

            if (proxyResult.status) {
                responseText = formatProxyResponse(ip, port, ipDetails, proxyResult, true);
            } else {
                responseText = formatProxyResponse(ip, port, ipDetails, proxyResult, false);
            }

            await sendTelegramMessage(requestBody.message.chat.id, responseText, requestBody.message.message_id);
        } else {
            const usageMessage = "Usage: /check <ip>:<port>\nExample: /check 1.1.1.1:443";
            await sendTelegramMessage(requestBody.message.chat.id, usageMessage, requestBody.message.message_id);
        }

        return new Response('OK');
    }

    return new Response('Invalid Request', { status: 400 });
}

async function isProxy(ip, port) {
    const url = `${checkProxyUrl}?ip=${ip}&port=${port}`;
    const response = await fetch(url);
    const data = await response.json();

    let latency = null;
    if (response.ok && data.is_proxy === true) {
        latency = data.response_time;

        return {
          status: true,
          message: 'Proxy is working',
          data: { latency }
        };
    }

    return {
        status: false,
        error: 'Proxy not detected'
    };
}

async function getIpDetails(ip) {
    const url = `${geoIpUrl}${ip}`;
    const response = await fetch(url);
    return response.ok ? await response.json() : null;
}

function countryCodeToFlag(countryCode) {
    countryCode = countryCode.toUpperCase();
    return [...countryCode].map(c => String.fromCodePoint(c.charCodeAt(0) + 127397)).join('');
}

function formatProxyResponse(ip, port, ipDetails, proxyResult, isWorking) {
    let responseText = isWorking ? "✅ Proxy is working!" : "❌ Proxy not detected!";

    responseText += "\n\n```Details\n";
    responseText += `IP          : ${ip}\n`;
    responseText += `Port        : ${port}\n`;

    if (ipDetails) {
        const { country, country_code, organization, isp, asn, timezone, latitude, longitude } = ipDetails;
        const flagEmoji = countryCodeToFlag(country_code);
        if (country) responseText += `Country     : ${country} (${flagEmoji})\n`;
        if (organization) responseText += `Organization: ${organization}\n`;
        if (isp) responseText += `ISP         : ${isp}\n`;
        if (asn) responseText += `ASN         : AS${asn}\n`;
        if (timezone) responseText += `Timezone    : ${timezone}\n`;
    }

    responseText += `Proxy       : ${isWorking ? 'true' : 'false'}`;

    if (proxyResult.data && proxyResult.data.latency) {
        responseText += `\nResponse    : ${proxyResult.data.latency}ms`;
    }

    responseText += "```\n";

    if (ipDetails?.latitude && ipDetails?.longitude) {
        responseText += `🌍 [View on Google Maps](https://www.google.com/maps?q=${ipDetails.latitude},${ipDetails.longitude})`;
    }

    return responseText;
}

async function sendTelegramMessage(chatId, text, messageId) {
    const url = `${API_URL}sendMessage`;
    const body = JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        reply_to_message_id: messageId
    });

    await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: body
    });
}
