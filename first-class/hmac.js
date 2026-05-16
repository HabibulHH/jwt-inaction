//  Hash-based Message Authentication Code
//  no db call
const crypto = require('crypto');
const SECRET ="sdhfh#sfdn0990"
//  Secure Hash Algorithm 256-bit.
const data  =  crypto.createHmac("sha256", SECRET)
  .update("message")
  .digest("hex");

console.log(data);

//Encryption:
//data লুকাও, পরে ফেরত আনো

//Hashing:
//data থেকে fingerprint বানাও, ফেরত আনা যায় না

//HMAC:
//data + secret দিয়ে trusted fingerprint বানাও