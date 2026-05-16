
const crypto = require('crypto');
const algorithm = 'aes-256-cbc';

const key = crypto.randomBytes(32); // 32 bytes key
const iv = crypto.randomBytes(16);  // initialization vector
const plainText = 'My bank password is'; // 19 
const cipher = crypto.createCipheriv(algorithm, key, iv);



let encrypted = cipher.update(plainText, 'utf8', 'base64');
encrypted += cipher.final('base64');

console.log('Encrypted:', encrypted);
// client XW6CRr7hm/a+/Tp66HDKjFYv02HCko+WJ/MzV5VPxf0= 
// req body XW6CRr7hm/a+/Tp66HDKjFYv02HCko+WJ/MzV5VPxf0= 
// 

const decipher = crypto.createDecipheriv(algorithm, key, iv);
let decrypted = decipher.update(encrypted, 'base64', 'utf8');
decrypted += decipher.final('utf8');

console.log('Decrypted:', decrypted);

//1d4a00572718d7cb5a5d8c878963ef345473ff7cd1e9f915279f0b6a28d24e20
//N/Lvl1XVoHzOSmC7wFu3MLjPdEC76qIQCeH6Ojznyzs=a