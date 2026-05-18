// Node v10.15.3
const axios = require('axios').default; // npm install axios
const CryptoJS = require('crypto-js'); // npm install crypto-js
const express = require('express'); // npm install express
const bodyParser = require('body-parser'); // npm install body-parser
const moment = require('moment'); // npm install moment
const qs = require('qs');
require('dotenv').config();

const app = express();

// APP INFO, STK TEST: 4111 1111 1111 1111
const config = {
  app_id: process.env.ZALOPAY_APP_ID || '2553',
  key1: process.env.ZALOPAY_KEY1 || '',
  key2: process.env.ZALOPAY_KEY2 || '',
  endpoint: process.env.ZALOPAY_ENDPOINT || 'https://sb-openapi.zalopay.vn/v2/create',
};
const isZaloConfigured = Boolean(config.key1 && config.key2);

app.use(bodyParser.json());

/**
 * methed: POST
 * Sandbox	POST	https://sb-openapi.zalopay.vn/v2/create
 * Real	POST	https://openapi.zalopay.vn/v2/create
 * description: create order, payment
 */
app.post('/payment', async (req, res) => {
  if (!isZaloConfigured) {
    return res.status(500).json({ error: 'ZaloPay is not configured' });
  }

  const embed_data = {
    //after successful payment, it will redirect to this link (usually your successful payment web link)
    redirecturl: 'https://phongthuytaman.com',
  };

  const items = [];
  const transID = Math.floor(Math.random() * 1000000);

  const order = {
    app_id: config.app_id,
    app_trans_id: `${moment().format('YYMMDD')}_${transID}`, // translation missing: vi.docs.shared.sample_code.comments.app_trans_id
    app_user: 'user123',
    app_time: Date.now(), // miliseconds
    item: JSON.stringify(items),
    embed_data: JSON.stringify(embed_data),
    amount: 50000,
    //after payment is done, zalopay server will POST to this url to notify our server
    //Note: need to use ngrok for public url so Zalopay Server can call it
    callback_url: 'https://b074-1-53-37-194.ngrok-free.app/callback',
    description: `Lazada - Payment for the order #${transID}`,
    bank_code: '',
  };

  // appid|app_trans_id|appuser|amount|apptime|embeddata|item
  const data =
    config.app_id +
    '|' +
    order.app_trans_id +
    '|' +
    order.app_user +
    '|' +
    order.amount +
    '|' +
    order.app_time +
    '|' +
    order.embed_data +
    '|' +
    order.item;
  order.mac = CryptoJS.HmacSHA256(data, config.key1).toString();

  try {
    const result = await axios.post(config.endpoint, null, { params: order });

    return res.status(200).json(result.data);
  } catch (error) {
 console.log(error);
  }
});

/**
 * method: POST
 * description: callback for Zalopay Server to call when payment is successful.
 * Only when ZaloPay has successfully collected money from the customer will it call this API to notify the result.
 */
app.post('/callback', (req, res) => {
  if (!isZaloConfigured) {
    return res.status(500).json({ return_code: -1, return_message: 'ZaloPay not configured' });
  }

  let result = {};
 console.log(req.body);
  try {
    let dataStr = req.body.data;
    let reqMac = req.body.mac;

    let mac = CryptoJS.HmacSHA256(dataStr, config.key2).toString();
 console.log('mac =', mac);

    // check valid callback (from ZaloPay server)
    if (reqMac !== mac) {
      // invalid callback
      result.return_code = -1;
      result.return_message = 'mac not equal';
    } else {
      // successful payment
      // merchant updates order status here
      let dataJson = JSON.parse(dataStr, config.key2);
 console.log(
        "update order's status = success where app_trans_id =",
        dataJson['app_trans_id'],
      );

      result.return_code = 1;
      result.return_message = 'success';
    }
  } catch (ex) {
 console.log('error:::' + ex.message);
    result.return_code = 0; // ZaloPay server will callback again (max 3 times)
    result.return_message = ex.message;
  }

  // notify result to ZaloPay server
  res.json(result);
});

/**
 * method: POST
 * Sandbox	POST	https://sb-openapi.zalopay.vn/v2/query
 * Real	POST	https://openapi.zalopay.vn/v2/query
 * description:
 * When user pays successfully,
 * ZaloPay will call callback (notify) to merchant so merchant can update Success status on the system.
 * In reality, callback can be missed due to Network timeout,
 * Merchant Service Unavailable/Internal Error...
 * so Merchant needs to implement proactive API call to query order status.
 */

app.post('/check-status-order', async (req, res) => {
  if (!isZaloConfigured) {
    return res.status(500).json({ error: 'ZaloPay is not configured' });
  }

  const { app_trans_id } = req.body;

  let postData = {
    app_id: config.app_id,
    app_trans_id, // Input your app_trans_id
  };

  let data = postData.app_id + '|' + postData.app_trans_id + '|' + config.key1; // appid|app_trans_id|key1
  postData.mac = CryptoJS.HmacSHA256(data, config.key1).toString();

  let postConfig = {
    method: 'post',
    url: 'https://sb-openapi.zalopay.vn/v2/query',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    data: qs.stringify(postData),
  };

  try {
    const result = await axios(postConfig);
 console.log(result.data);
    return res.status(200).json(result.data);
    /**
     * sample result
      {
        "return_code": 1, // 1 : Success, 2 : Failed, 3 : Order unpaid or transaction processing
        "return_message": "",
        "sub_return_code": 1,
        "sub_return_message": "",
        "is_processing": false,
        "amount": 50000,
        "zp_trans_id": 240331000000175,
        "server_time": 1711857138483,
        "discount_amount": 0
      }
    */
  } catch (error) {
 console.log('error');
 console.log(error);
  }
});

app.listen(8888, function () {
 console.log('Server is listening at port :8888');
});
