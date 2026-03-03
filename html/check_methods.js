const { PayOS } = require('@payos/node');
const payOS = new PayOS({
  clientId: 'test',
  apiKey: 'test',
  checksumKey: 'test'
});

console.log('Has createPaymentLink:', typeof payOS.createPaymentLink);
console.log('Has paymentRequests:', typeof payOS.paymentRequests);
if (payOS.paymentRequests) {
    console.log('Has paymentRequests.create:', typeof payOS.paymentRequests.create);
}
