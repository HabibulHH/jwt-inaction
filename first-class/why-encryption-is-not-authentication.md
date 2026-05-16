# Why Encryption Does NOT Protect Server–Client Authentication

A walkthrough of why you cannot use plain `cipher`/`decipher` (encryption) to
verify that data coming back from a client was not tampered with — and why
HMAC / signatures are the right tool.

---

## The core confusion

> "I'll just encrypt the payload, send it to the client, and when it comes
> back I'll check it. If it doesn't match, no access. Where's the problem?"

The problem: **encryption and authentication are two different jobs.**

| Goal | Question it answers | Tool |
|------|--------------------|------|
| **Confidentiality** | "Can an outsider *read* it?" | Encryption (`cipher`/`decipher`) |
| **Integrity / Authentication** | "Did anyone *change* it?" | HMAC / signature / AEAD tag |

Encryption gives you the first. It says **nothing** about the second.

---

## "Client-side e client modify korle amar matha betha keno?"

Because **"the client" is not always your honest user.** The data coming back
can be sent by:

- the user themselves (DevTools, Burp, a proxy) editing the request
- a man-in-the-middle on public wifi
- anyone hitting your API directly, no browser involved

The server cannot tell these apart — it's all "just an HTTP request." So the
server must **never blindly trust data that came back from the client.**

```
You sent  : amount=1000&user=habib
Came back : amount=1&user=habib      <-- the money is YOUR business's, not theirs
Came back : role=admin               <-- privilege escalation
Came back : userId=5 -> userId=6     <-- accessing someone else's account
```

If the data never left the server, there'd be no problem. The problem starts
the moment data travels through untrusted territory (client / network) and
comes back.

---

## Why plain cipher/decipher fails: there is no "check" step

### HMAC has a comparison step

```
expected = HMAC(received_message, secret)
expected === received_hmac ?          <-- this comparison happens
```

Tampering breaks the comparison → detected.

### cipher/decipher has NO comparison step

```
decipher(ciphertext) -> plaintext
```

That's it. It just transforms bytes → bytes. There is no "expected", nothing
is compared. Whatever you feed in, *something* comes out.

**Proof (see `integrity-demo.js`):** flip one bit inside the first block of an
AES-256-CBC ciphertext and decrypt it:

```
CBC tampered -> "<garbage>"
>>> NO ERROR. padding sits in the last block, so block-1 tampering slips through.
```

No error. The server gets attacker-influenced data and **has no idea it
changed.** CTR mode is even worse — it's fully malleable, an attacker who
knows the plaintext layout can rewrite it precisely.

> The padding error you sometimes see from `decipher.final()` is **not**
> integrity protection. It only checks the *last* block's padding, it's
> ~1/256 likely to pass by accident, and where it does fire it's the basis
> of the **padding oracle attack**.

---

## "Just compare the ciphertext to the expected one"

To compare against an "expected" value you must **either**:

1. **Store** the original ciphertext/plaintext → now you are **stateful**,
   the exact thing you were trying to avoid. And if you're storing the
   original anyway, why send it to the client at all? Just keep it server-side.
2. **Regenerate** the expected value → regenerate from *what*? From the
   original plaintext — which is exactly the thing the client is sending you
   and you're trying to verify. **Circular.**

---

## "Then I'll re-encrypt the decrypted payload and compare"

This is mathematically a no-op:

```
payload'  = decrypt(ciphertext')
expected  = encrypt(payload') = encrypt(decrypt(ciphertext')) = ciphertext'
```

`encrypt` and `decrypt` are inverses, so `expected === ciphertext'` is
**always true**, no matter what the attacker sent. It's an identity
(`C → P → C`), not a check. It catches nothing.

The root cause: with encryption you hold **one** value (the ciphertext).
To verify by comparison you need **two** independent, correlated values.

---

## Why HMAC works: two correlated values travel together

```
Sent to client:  { message, tag }     <-- TWO things
                 tag = HMAC(message, secret)
```

Verify: recompute `HMAC(received_message, secret)`, compare to the received
`tag`. If the attacker changes `message`, they need a new matching `tag` —
which they cannot produce without the `secret`.

That **redundancy** — two values where one is derived from the other — is
what makes tamper-detection possible. Encryption produces only one value, so
there is no redundancy to check.

### "But I could send payload + ciphertext both, like HMAC"

Yes — and then it *would* work structurally. But at that point you have
literally rebuilt HMAC, just with encryption as the MAC function, and badly:

- it must be deterministic → you must fix the IV → **IV reuse weakness**
- a block cipher used as a MAC (CBC-MAC) is forgeable for variable-length
  messages if you roll it yourself
- HMAC is the purpose-built, decades-analyzed tool for exactly this

Case B = "HMAC, but worse." So just use HMAC.

---

## The verification function needs two properties

For "recompute and compare" verification to work, the function must be:

| Property | Meaning | HMAC | Encryption (random IV) | Encryption (fixed IV) |
|----------|---------|------|------------------------|------------------------|
| **Deterministic** | same input → same output | ✅ | ❌ (random IV) | ✅ but insecure |
| **Unforgeable** | can't produce valid output without the secret | ✅ | — | no separate tag to compare |

Encryption has **neither** in a usable form.

---

## Connection to password hashing

Password check *is* the "compute and compare" idea — and it works:

```
signup : store  hash(password)  in DB
login  : hash(incoming password) === stored hash ?
```

But here the "expected" comes **from the DB — it's stored**. That is
**stateful**, and for passwords that's fine (you already have a user table).

The whole point of HMAC / JWT is to do the *same* "compute and compare" idea
**statelessly**:

- **Password model:** expected comes from the DB (stateful).
- **HMAC model:** expected is recomputed from (the message that travels
  alongside) + the secret (stateless).

---

## How this maps to JWT

- A JWT does **not** encrypt its payload — anyone can base64-decode and read it.
- A JWT is **signed** (HMAC), because what it needs is **integrity**, not
  confidentiality: "nobody changed `role` or `userId`."
- Structure: `header.payload.signature`, where
  `signature = HMAC(header + "." + payload, server_secret)`.
- Change the payload → recomputed signature won't match → token rejected.
- The attacker can't forge a new signature because the `secret` lives only on
  the server.
- Note: a JWT signature does **not** become invalid when the user changes
  their password — it's signed with the server secret, not the password. To
  invalidate old tokens you need a separate mechanism (token version, short
  expiry + refresh tokens, blacklist).

---

## Bottom line

| If you need... | Use |
|----------------|-----|
| "Nobody can read it" | Encryption (AES) |
| "Nobody changed it" (stateless verify) | HMAC / signature |
| Both | AES-GCM (encryption + auth tag), or encrypt-then-MAC |

Encryption is not authentication. The thing you **cannot skip** for
tamper-detection is the integrity tag — and plain `cipher`/`decipher` does
not have one.
