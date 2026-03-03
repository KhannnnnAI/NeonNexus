/**
 * MOMO PAYMENT GATEWAY (SERVER-SIDE)
 * ----------------------------------
 * WARNING: This file contains the Secret Key and MUST run on the server (Node.js).
 * Do NOT include this file directly in your frontend (HTML/Client JS).
 *
 * Usage:
 * const { createMomoPayment } = require('./momo');
 * createMomoPayment(50000, "Order123", "Pay with MoMo").then(payUrl => ...);
 */

const https = require('https');
const crypto = require('crypto');

// Configuration
const config = {
    accessKey: 'F8BBA842ECF85',
    secretKey: 'K951B6PE1waDMi640xX08PD3vg6EkVlz',
    partnerCode: 'MOMO',
    partnerName: 'NeonNexus',
    storeId: 'NeonNexusStore',
    redirectUrl: 'http://127.0.0.1:5500/final/keygen.html', // Default fallback
    ipnUrl: 'https://webhook.site/b3088a6a-2d17-4f8d-a383-71389a6c600b',      // Must be public URL for MoMo to call
    requestType: 'payWithMethod',
    autoCapture: true,
    lang: 'vi'
};

/**
 * Create a payment request to MoMo
 * @param {string|number} amount - The amount to pay (VND)
 * @param {string} orderId - Unique order ID
 * @param {string} orderInfo - Order description
 * @param {string} extraData - Optional extra data (Base64)
 * @returns {Promise<any>} - Returns information from MoMo API (payUrl, etc.)
 */
/**
 * Create a payment request to MoMo
 * @param {string|number} amount - The amount to pay (VND)
 * @param {string} orderId - Unique order ID
 * @param {string} orderInfo - Order description
 * @param {string} returnUrl - URL to redirect after payment (optional)
 * @param {string} extraData - Optional extra data (Base64)
 * @returns {Promise<any>} - Returns information from MoMo API (payUrl, etc.)
 */
function createMomoPayment(amount, orderId, orderInfo = 'Pay with MoMo', returnUrl = null, extraData = '') {
    return new Promise((resolve, reject) => {
        // Ensure inputs are strings and amount is integer
        const strAmount = Math.round(Number(amount)).toString();
        const requestId = orderId; // Using orderId as requestId for simplicity
        
        // Use provided returnUrl or default from config
        const redirectUrl = returnUrl || config.redirectUrl;

        // 1. Create Raw Signature
        // Format: accessKey=$accessKey&amount=$amount&extraData=$extraData&ipnUrl=$ipnUrl&orderId=$orderId&orderInfo=$orderInfo&partnerCode=$partnerCode&redirectUrl=$redirectUrl&requestId=$requestId&requestType=$requestType
        const rawSignature = `accessKey=${config.accessKey}&amount=${strAmount}&extraData=${extraData}&ipnUrl=${config.ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${config.partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${config.requestType}`;

        console.log("--------------------RAW SIGNATURE----------------");
        console.log(rawSignature);

        // 2. Hash Signature (HMAC SHA256)
        const signature = crypto.createHmac('sha256', config.secretKey)
            .update(rawSignature)
            .digest('hex');

        console.log("--------------------SIGNATURE----------------");
        console.log(signature);

        // 3. Prepare Request Body
        const requestBody = JSON.stringify({
            partnerCode: config.partnerCode,
            partnerName: config.partnerName,
            storeId: config.storeId,
            requestId: requestId,
            amount: strAmount,
            orderId: orderId,
            orderInfo: orderInfo,
            redirectUrl: redirectUrl,
            ipnUrl: config.ipnUrl,
            lang: config.lang,
            requestType: config.requestType,
            autoCapture: config.autoCapture,
            extraData: extraData,
            orderGroupId: '',
            signature: signature
        });

        // 4. Send Request (HTTPS)
        const options = {
            hostname: 'test-payment.momo.vn',
            port: 443,
            path: '/v2/gateway/api/create',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestBody)
            }
        };

        console.log("Sending request to MoMo...");
        
        const req = https.request(options, (res) => {
            console.log(`Status: ${res.statusCode}`);
            let body = '';

            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                body += chunk;
            });

            res.on('end', () => {
                try {
                    const parsedBody = JSON.parse(body);
                    console.log('Response Body:', parsedBody);
                    resolve(parsedBody);
                } catch (e) {
                    reject(new Error("Failed to parse response: " + body));
                }
            });
        });

        req.on('error', (e) => {
            console.error(`Problem with request: ${e.message}`);
            reject(e);
        });

        req.write(requestBody);
        req.end();
    });
}

// Example Self-Execution (if run directly: node momo.js)
if (require.main === module) {
    const testOrderId = config.partnerCode + new Date().getTime();
    createMomoPayment('50000', testOrderId, 'Test Payment')
        .then(data => {
            console.log("SUCCESS! Payment URL:", data.payUrl);
        })
        .catch(err => {
            console.error("FAILURE:", err);
        });
}

module.exports = { createMomoPayment };
