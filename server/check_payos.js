const PayOS = require('@payos/node');
console.log('Type of PayOS:', typeof PayOS);
console.log('PayOS keys:', Object.keys(PayOS));
console.log('PayOS prototype:', PayOS.prototype);
try {
    const test = new PayOS('id', 'key', 'checksum');
    console.log('Constructor worked');
} catch (e) {
    console.log('Constructor failed:', e.message);
}
