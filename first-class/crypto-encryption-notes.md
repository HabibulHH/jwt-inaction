# Node.js Crypto & Encryption — Complete Notes

This document captures the full Q&A journey on encryption using Node's `crypto` module — from understanding ciphers, keys, and IVs to encrypting and decrypting data with AES.

The running example is this code:

```js
const crypto = require('crypto');
const algorithm = 'aes-256-cbc';

const key = crypto.randomBytes(32); // 32 bytes key
const iv = crypto.randomBytes(16);  // initialization vector
const plainText = 'My bank password is';
const cipher = crypto.createCipheriv(algorithm, key, iv);

let encrypted = cipher.update(plainText, 'utf8', 'base64');
encrypted += cipher.final('base64');
console.log('Encrypted:', encrypted);

const decipher = crypto.createDecipheriv(algorithm, key, iv);
let decrypted = decipher.update(encrypted, 'base64', 'utf8');
decrypted += decipher.final('utf8');
console.log('Decrypted:', decrypted);
```

---

## Q1: What is a cipher?

A **cipher** is an algorithm (a set of rules) for scrambling data so outsiders can't read it — and unscrambling it if you have the key.

```
Plain text  →  [ CIPHER + KEY ]  →  Scrambled text
"Hello"     →  encrypt          →  "X8#kP@9"

Scrambled text  →  [ CIPHER + KEY ]  →  Plain text
"X8#kP@9"       →  decrypt          →  "Hello"
```

- The **cipher** is the *method*.
- The **key** is the *secret*.
- Same cipher + same key = you can go both ways. Without the key, scrambled text is useless.

### Tiny example — the Caesar cipher

The oldest cipher: shift every letter by a fixed number.

```
Cipher rule: "shift each letter forward by N"
Key: N = 3
"HELLO"  →  "KHOOR"
```

Modern ciphers like **AES** do the same idea but with extremely complex math and huge keys.

### Two families of ciphers

| Type | How keys work | Example |
|---|---|---|
| **Symmetric** | Same key encrypts AND decrypts | AES, ChaCha20 |
| **Asymmetric** | Public key encrypts, private key decrypts | RSA, ECC |

`aes-256-cbc` is **symmetric** — sender and receiver share one secret key.

> Spelling note: it's **cipher**, not "cypher" (the latter is an older British spelling).

---

## Q2: What does `aes-256-cbc` mean? What are the alternatives?

The string has **3 parts**:

| Part | Meaning |
|---|---|
| `aes` | **The cipher** — AES (Advanced Encryption Standard), worldwide standard since 2001 |
| `256` | **Key size in bits** — 256-bit key (also comes in 128 and 192) |
| `cbc` | **The mode** — how AES processes data longer than one 16-byte block |

### Why a "mode" is needed

AES only encrypts **16 bytes at a time** (one "block"). Real data is longer, so a **mode** decides how to chain blocks together.

### Alternatives — by changing each part

**Change the key size:**

| Algorithm | Key size | Notes |
|---|---|---|
| `aes-128-cbc` | 128-bit | Faster, still very secure |
| `aes-192-cbc` | 192-bit | Rarely used |
| `aes-256-cbc` | 256-bit | Most secure, slightly slower |

**Change the mode (the big one):**

| Mode | Name | Use it? |
|---|---|---|
| `cbc` | Cipher Block Chaining | OK, but **no built-in integrity check** — needs separate HMAC |
| **`gcm`** | Galois/Counter Mode | ✅ **Recommended** — encrypts AND verifies tampering |
| `ctr` | Counter Mode | OK for streaming, no integrity check |
| `ecb` | Electronic Codebook | ❌ **Never use** — leaks patterns |
| `cfb` / `ofb` | Feedback modes | Legacy, rarely needed |

**Change the cipher entirely:**

| Algorithm | Notes |
|---|---|
| `chacha20-poly1305` | Modern alternative to AES — faster on devices without AES hardware, also authenticated |
| `des` / `3des` | ❌ Old and broken — don't use |

### What to pick today

| Use case | Recommended |
|---|---|
| General encryption | `aes-256-gcm` |
| Mobile / no AES hardware | `chacha20-poly1305` |
| Legacy compatibility | `aes-256-cbc` (with a separate HMAC) |
| Anything | **Never** `ecb`, `des`, `3des` |

### See what your system supports

```js
const crypto = require('crypto');
console.log(crypto.getCiphers());
```

---

## Q3: What is the IV (Initialization Vector)?

```js
const iv = crypto.randomBytes(16);  // initialization vector
```

The **IV is 16 random bytes** that make encryption produce a **different output every time**, even with the same input and key.

### The problem the IV solves

Without an IV, encryption is deterministic — same input always gives same output:

```
encrypt("My bank password is", key)  →  "a1b2c3..."
encrypt("My bank password is", key)  →  "a1b2c3..."   ← identical! leaks info
```

An attacker could tell two messages are the same without decrypting them.

### What the IV does

The IV is mixed into the first block. Since it's random per message, the whole output changes:

```
encrypt("My bank password is", key, iv1)  →  "a1b2c3..."
encrypt("My bank password is", key, iv2)  →  "x9y8z7..."   ← totally different!
```

### Key vs. IV — crucial difference

| | Key | IV |
|---|---|---|
| Purpose | The secret that locks/unlocks | Randomizes the output |
| Must be secret? | **YES** — never share | **No** — can be public |
| Size (AES) | 32 bytes (256-bit) | 16 bytes (= AES block size) |
| Reuse? | Reusing same key is fine | **Never reuse** with the same key |
| Needed to decrypt? | Yes | Yes |

The IV is **not secret**, but must be **unique and unpredictable** per message. Normally you send the IV alongside the ciphertext (often prepended to it) — the receiver needs it to decrypt.

> Note: for `aes-*-gcm` mode the IV is typically 12 bytes, not 16.

---

## Q4: What's inside the `cipher` object?

Running `console.log(cipher)` shows almost nothing useful:

```
Cipheriv {
  _decoder: null,
  _options: undefined,
  Symbol(kHandle): CipherBase {}
}
```

### Why it looks "empty"

The `cipher` is **not a data object** — it's a **machine (a tool)**. It doesn't *hold* your encrypted text; it's the thing that *does* the encrypting.

Think of it like a blender: `console.log(blender)` won't show you a smoothie — it shows you an appliance with buttons.

### What's actually inside

| Property | What it is |
|---|---|
| `_decoder` | Internal helper for output formatting — ignore |
| `_options` | Internal config — ignore |
| `Symbol(kHandle): CipherBase {}` | **The real engine** — the actual AES math, hidden in C++ |

`kHandle` is where your `key`, `iv`, and the algorithm actually live — Node hides it on purpose (wrapped in native C++) so you can't peek at or break the secret key.

### The useful part — its methods (the "buttons")

| Method | What it does |
|---|---|
| **`update()`** | Feed in data → get encrypted chunk back |
| **`final()`** | "I'm done" → flush the last block |
| `setAutoPadding()` | Control block padding behavior |
| `getAuthTag()` | Get the tamper-check tag (GCM mode only) |
| `setAAD()` | Add extra authenticated data (GCM mode) |

### Mental model

```
createCipheriv(algorithm, key, iv)
        ↓
   builds a "machine" pre-loaded with the algorithm, key, and IV
        ↓
   cipher  ← a one-use machine
        ↓
   you operate it with .update() and .final()
        ↓
   out comes the ciphertext
```

`console.log(cipher)` is not useful — the cipher is a machine, not data. The real output comes from `.update()` and `.final()`.

---

## Q5: What does `cipher.update(plainText, 'utf8', 'hex')` return? Is it a hash?

**No — it is NOT a hash.** It returns a **chunk of encrypted data (ciphertext)** — the scrambled version of your text.

The three arguments:

| Argument | Value | Meaning |
|---|---|---|
| 1st | `plainText` | the data to encrypt |
| 2nd | `'utf8'` | how to **read** the input (it's text) |
| 3rd | `'hex'` (or `'base64'`) | how to **format** the output |

The output *looks* like a hash because both are unreadable strings — but they are completely different things.

### Encryption vs. Hash

| | Encryption | Hash |
|---|---|---|
| Reversible? | ✅ Yes — decrypt back to original | ❌ No — one-way, forever |
| Needs a key? | Yes (key + IV) | No |
| Output size | Grows with input | Fixed size always |
| Purpose | **Hide** data, get it back | **Verify** data (passwords, integrity) |
| Example | `aes-256-cbc` | `sha256`, `bcrypt` |

Your code does **encryption** — the `encrypted` value *can* be turned back into the original. A hash could never be reversed.

> **Encryption locks (and unlocks); a hash shreds (forever).**

---

## Q6: Why `cipher.final()` and why the `+=`?

AES-CBC encrypts in **fixed 16-byte blocks**. Encryption happens in two stages:

```js
let encrypted = cipher.update(plainText, 'utf8', 'base64'); // does the FULL blocks
encrypted += cipher.final('base64');                        // handles the LAST piece
```

### What `update()` does
Encrypts every **complete 16-byte block** it can. Leftover bytes that don't fill a full block are **held back** in a buffer.

### What `final()` does
`'My bank password is'` is **19 bytes** — not a multiple of 16. So there's a leftover chunk. `final()`:
1. Takes the leftover bytes
2. **Pads** them to a full 16-byte block (CBC requires full blocks)
3. Encrypts that last block
4. Returns it

### Why `+=` (concatenate)?
The ciphertext comes out in **two pieces** — `update()`'s part + `final()`'s part. You glue them together. For short data, `update()` may return `''` and `final()` returns everything — but `update() += final()` always works regardless of size.

### What if you skip `final()`?
- The last block of data is **lost** (stuck in the buffer)
- Padding is never added → decryption breaks
- `final()` is **mandatory**, not optional

---

## Q7: Why `'hex'` (or `'base64'`) for the output?

The raw encrypted output is **binary** — bytes 0–255, full of unprintable junk:

```
<Buffer 8f 00 a3 0a ff 1c ...>   ← can't safely print, log, or store this
```

`'hex'` or `'base64'` converts that binary into a **safe, printable string**:

| Format | Looks like | Size |
|---|---|---|
| `'hex'` | `8f00a30aff1c` | 2 chars per byte (bigger) |
| `'base64'` | `jwCjCv8c` | ~1.33 chars per byte (smaller) |

Both are just **display formats** for the same binary ciphertext. `'hex'` is easier to read/debug; `'base64'` is more compact.

---

## Q8: The decipher side — the encoding mirror rule

Encryption and decryption must be **exact mirrors**. The input/output encodings **swap**:

```js
// ENCRYPT:  utf8 (text)  →  base64 (scrambled)
cipher.update(plainText, 'utf8', 'base64')

// DECRYPT:  base64 (scrambled)  →  utf8 (text)
decipher.update(encrypted, 'base64', 'utf8')
```

If they don't match (e.g., encrypt with `'base64'` but decrypt reading `'hex'`), decryption fails or returns garbage.

### Common decipher bugs (and fixes)

| Bug | Problem | Fix |
|---|---|---|
| `decipher` not created | Calling `decipher.update()` with no `decipher` | `crypto.createDecipheriv(algorithm, key, iv)` |
| Wrong input encoding | Reading `'hex'` when ciphertext is `'base64'` | Match the encoding used during encryption |
| Wrong output encoding | Output `'base64'` keeps it scrambled | Use `'utf8'` to get readable text back |
| Result discarded | Return value not stored/printed | Capture with `let decrypted = ...; decrypted += ...` |

### Correct decipher block

```js
const decipher = crypto.createDecipheriv(algorithm, key, iv);
let decrypted = decipher.update(encrypted, 'base64', 'utf8');
decrypted += decipher.final('utf8');
console.log('Decrypted:', decrypted);
```

---

## Important real-world caveat

In the example, encryption and decryption work because `key` and `iv` are in memory from the same run.

In a **real app**, encryption and decryption happen at different times/places. So you must:

- **Save the `iv`** alongside the ciphertext (it's not secret — often prepended to the ciphertext)
- **Keep the `key` secure** (environment variable, secrets manager, key vault — never hardcoded, never committed)

If you restart the script, new random `key`/`iv` are generated and old ciphertext can no longer be decrypted.

---

## Quick reference card

### Anatomy of `aes-256-cbc`
- `aes` = cipher · `256` = key bits · `cbc` = block mode

### Key vs IV
- **Key** = secret, 32 bytes, keep hidden, reusable
- **IV** = not secret, 16 bytes, must be unique per message, send with ciphertext

### Encrypt flow
```
text → createCipheriv(algo, key, iv) → cipher.update() + cipher.final() → ciphertext
```

### Decrypt flow (mirror)
```
ciphertext → createDecipheriv(algo, key, iv) → decipher.update() + decipher.final() → text
```

### Encoding mirror rule
- Encrypt: `update(text, 'utf8', 'base64')`
- Decrypt: `update(ciphertext, 'base64', 'utf8')` — encodings swap

### Cipher object
- It's a **machine**, not data — `console.log(cipher)` shows nothing useful
- Operate it with `.update()` and `.final()`

### Encryption ≠ Hash
- Encryption = reversible (with key). Hash = one-way forever.

### Modern recommendation
- Prefer `aes-256-gcm` over `aes-256-cbc` — same cipher, but also detects tampering
- Never use `ecb`, `des`, `3des`
