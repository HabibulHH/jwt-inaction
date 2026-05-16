# JWT & Base64 Encoding — Complete Notes

This document captures the full Q&A journey from learning what Base64 is, all the way to understanding why JWTs need Base64url encoding.

---

# Part 1: Base64 Fundamentals (Umbrella Discussion)

## Q1: What is Base64?

**Base64 is an encoding scheme** — it converts any data (binary or text) into a string using only 64 safe characters: `A-Z`, `a-z`, `0-9`, `+`, `/`, with `=` for padding.

### Why is it used?

Some systems only handle plain text safely — binary bytes or special characters get corrupted. Base64 turns everything into a string that travels safely anywhere.

| Use case | Example |
|---|---|
| JWT tokens | Header and payload are base64url-encoded |
| Email attachments | Images/files sent as text inside email |
| Data URLs | `data:image/png;base64,iVBOR...` |
| Binary in JSON APIs | JSON only supports text |
| HTTP Basic Auth | `Authorization: Basic dXNlcjpwYXNz` |

### How it works

Every **3 bytes** (24 bits) of input become **4 characters** (6 bits each) of output. So the encoded string is **~33% larger** than the original.

```
"Hi"  →  01001000 01101001        (2 bytes = 16 bits)
      →  010010 000110 100100     (6-bit groups + padding)
      →  S      G      k     =    → "SGk="
```

### Important: Base64 is NOT encryption

Anyone can decode Base64. It's just for safely moving data around, not for keeping secrets.

---

## Q2: What are the 64 safe characters?

| Index | Characters | Count |
|---|---|---|
| 0–25 | `A B C D E F G H I J K L M N O P Q R S T U V W X Y Z` | 26 uppercase |
| 26–51 | `a b c d e f g h i j k l m n o p q r s t u v w x y z` | 26 lowercase |
| 52–61 | `0 1 2 3 4 5 6 7 8 9` | 10 digits |
| 62 | `+` | 1 |
| 63 | `/` | 1 |

**Total: 64 characters** → fits exactly in 6 bits (2⁶ = 64).

Plus `=` is used as a **padding** character (not part of the 64) when the input length isn't a multiple of 3 bytes.

### Base64url variant (used in JWTs)

Swaps the two URL-unsafe characters:

- `+` → `-`
- `/` → `_`
- Padding `=` is usually stripped

This is so the encoded string can be safely placed in URLs, filenames, and HTTP headers without needing extra escaping.

---

## Q3: But Base64 uses more memory — what's the benefit?

You're right — Base64 **does** use more memory (~33% bigger). So why do it?

**The trade-off: size vs. safety in transit**

Base64 isn't about saving space — it's about making sure data **survives** through systems that only handle plain text. Without it, binary bytes get corrupted, mangled, or rejected.

### When Base64 is worth it

| Situation | Worth it? | Why |
|---|---|---|
| JWT tokens | Yes | Must fit in headers/URLs |
| Embedding small images in HTML/CSS | Sometimes | Saves a network request |
| Email attachments | Yes | Email protocol is text-only |
| Storing large files in a database | No | Use binary column instead |
| Sending large files over API | No | Use multipart upload |

**Rule of thumb:** Use Base64 only when the transport channel can't handle binary. For storage or large data, keep it raw.

---

## Q4: Why does data get corrupted without Base64? (Easy version)

### Imagine a post office analogy

You want to send a **fragile glass vase** (your data). The post office only accepts **flat envelopes** (text). They won't even touch boxes.

You have two choices:
1. Try to stuff the vase in an envelope → it breaks
2. Take a photo of the vase, mail the photo, and the receiver "rebuilds" it on the other side → safe but the envelope is bigger than the original vase

**Base64 is option 2.** You convert your real data into a "photo" made of safe letters that fit in any envelope.

### Computer version

Your computer talks in **bytes** — numbers from 0 to 255.

Some of those numbers are letters you can see: `A=65`, `B=66`, `a=97`, `1=49`...

But many numbers are **invisible** or **dangerous**:
- `0` = "end of message" — everything after this gets thrown away
- `10` = "new line" — splits your data into two pieces
- `7` = makes the computer go *beep*
- `200` = some random symbol that one computer reads as `È` and another reads as `Ⱦ`

When you send data over the internet (URLs, headers, emails), only the safe visible letters work. If your data has any "dangerous" numbers in it, your message arrives broken.

---

## Q5: What does "safe visible" actually mean?

Look at your keyboard. Every key you can press makes a **visible** character:

```
A B C D ... a b c ... 1 2 3 ... ! @ # $ % ...
```

These are **safe visible characters**. You can see them, type them, copy them, paste them, print them. They behave normally everywhere.

But inside a computer, data is stored as **numbers** (0 to 255). Not every number maps to a visible key:

```
Number 65  →  "A"        ← visible, safe
Number 97  →  "a"        ← visible, safe
Number 49  →  "1"        ← visible, safe

Number 0   →  (nothing visible)  ← INVISIBLE, dangerous
Number 10  →  (new line)         ← INVISIBLE, dangerous
Number 200 →  (some weird symbol) ← unpredictable
```

Only **about 95 numbers** out of 256 are "safe visible". The other 161 are invisible control codes or unpredictable symbols.

---

## Q6: How exactly do "dangerous numbers" break messages?

### Example 1: The number `0` destroys the message

In C-based systems, the number `0` means **"the message ends here."**

```
H  e  l  l  o  0  W  o  r  l  d
72 101 108 108 111 0  87 111 114 108 100
```

The receiver reads `0` in the middle and thinks: *"Message ended at position 5."*

Result: It only keeps `Hello` and **throws away `World`**. Your data is silently destroyed.

### Example 2: The number `10` (newline) splits HTTP

HTTP requests look like this:

```
GET /home HTTP/1.1
Host: google.com
Authorization: Bearer abc123
```

Each line is separated by the number `10` (newline). If your token contains `10`:

```
Authorization: Bearer abc[10]X-Admin: yes
```

The server thinks: *"A new header started! `X-Admin: yes` — okay, I'll trust this user as admin!"*

**Result: A hacker can pretend to be admin** — this is called **header injection**.

### Example 3: The character `&` breaks URLs

```
https://site.com/api?token=abc&def
                              ↑
                  URL parser thinks: "new item starts here"
```

Your token is **corrupted** — split in half silently.

### Example 4: Byte `200` means different things on different computers

- Computer A reads byte `200` as `È` (one alphabet system)
- Computer B reads the same byte `200` as `Ⱦ` (a different system)

The bytes are the same, but the **interpretation** is different. Your signature breaks.

---

## Q7: Why does `0` mean "end of string"?

This is a historical question from the **C programming language (1972)**.

### The problem

How does a computer know where text ends in memory?

```
Memory:  [72] [101] [108] [108] [111] [?] [?] [?] [?] ...
          H    e    l    l    o   ← then what?
```

Two solutions:

**Option A: Store the length at the beginning**
```
[5] [H] [e] [l] [l] [o]
 ↑ "this word is 5 letters long"
```

**Option B: Mark the end with a special byte**
```
[H] [e] [l] [l] [o] [0]
                     ↑ "stop here"
```

### C chose Option B because:

1. **Simplicity:** Just read until you hit `0`
2. **`0` was unused:** Doesn't represent any visible ASCII letter
3. **Memory was tiny:** In 1972, saving even one byte mattered

This is called **null-terminated strings**.

### Why this still affects us 50 years later

C became the foundation of **everything**:
- Linux, Windows, macOS kernels
- Network protocols
- File formats
- Programming language runtimes

Even modern languages (Python, JavaScript) that don't use null-terminated strings internally still have to **talk to** C-based systems. When they hand data to those systems, a `0` byte can still cut things short.

### Was it a good choice?

Honestly... no. It caused decades of:
- **Buffer overflows** (Heartbleed, etc.)
- **Truncation attacks** (inject `0` to cut data short)
- **Performance costs** (must scan every byte to find length)

Modern languages like Rust, Go, and Swift use Option A. But C's convention is too deeply baked in to escape.

---

## Q8: So Base64 is an encoding (not encryption)?

**Yes — this is a critical distinction.**

### Encoding vs. Encryption

| Property | Encoding (Base64) | Encryption (AES, RSA) |
|---|---|---|
| Goal | Compatibility | Secrecy |
| Needs a key? | No | Yes |
| Anyone can reverse? | Yes | Only with key |
| Output looks scrambled? | Yes | Yes |
| Is it secure? | **No** | Yes |
| Example | `SGVsbG8=` | `4f3a9b8e2c7d...` |

### Common encodings

| Encoding | Purpose |
|---|---|
| **Base64** | Make binary safe for text channels |
| **URL encoding** (`%20` for space) | Make special characters safe for URLs |
| **HTML encoding** (`&amp;` for `&`) | Make characters safe inside HTML |
| **UTF-8** | Represent any language's letters as bytes |
| **Hex** (`48 65 6c 6c 6f`) | Human-readable binary view |

### Critical warning

A JWT looks scrambled, but the header and payload are **just Base64-encoded JSON** — anyone can decode them. The only protected part is the **signature** at the end (HMAC cryptography).

**Never put secrets in a JWT payload.** It's encoded, not encrypted — it's public.

### One-line rule

> **Encoding** = "make data fit somewhere" (public, reversible by anyone)
> **Encryption** = "make data unreadable" (requires a secret key)

---

## Q9: Are ALL unsupported characters converted to Base64 before sending?

**No — Base64 is just one tool**. Different channels use different solutions.

| Channel | What it can carry | How "unsafe" stuff is handled |
|---|---|---|
| **URLs** | Limited ASCII letters/digits | **URL encoding** (percent encoding) |
| **HTML content** | Text, but `<`, `>`, `&` are special | **HTML entities** |
| **JSON bodies** | Text only (UTF-8 strings) | **Base64** (for binary) |
| **HTTP headers** | Printable ASCII, no newlines | **Base64** or restricted to safe chars |
| **Email body** | 7-bit ASCII (historically) | **Base64** or **Quoted-Printable** |
| **HTTP body (raw)** | Anything, including binary | **No encoding needed** — sent as-is |

### Different encodings for different channels

**URL encoding** (not Base64):
```
hello world & friends  →  hello%20world%20%26%20friends
```

**HTML entities** (not Base64):
```html
if a < b then...  →  if a &lt; b then...
```

**JSON escape sequences** (text) + Base64 (binary):
```json
{ "data": "iVBORw0KGgoAAAANSUhEUg..." }
```

**Raw binary HTTP body** (no encoding) — when uploading a photo to Instagram, the bytes go raw with `Content-Type: image/jpeg`. That's why a 5MB photo doesn't waste 33% bandwidth on Base64.

### The general rule

```
Where is the data going?

├── In a URL?           → URL encoding
├── In HTML?            → HTML entities
├── In an HTTP header?  → Base64 (or restrict to safe chars)
├── In JSON as binary?  → Base64
├── In email?           → Base64 / Quoted-Printable
└── In HTTP body alone? → Raw, with correct Content-Type
```

### HTTPS doesn't change this

HTTPS encrypts data **in transit**, but once it arrives, the URL parser, HTML renderer, JSON parser, etc., still need to do their jobs. Encoding solves **format compatibility**; encryption solves **secrecy**. Different problems, different solutions.

---

# Part 2: JWT-Specific — Why Base64url for JWTs?

### Top reasons (ranked by importance)

**1. JWTs travel inside HTTP headers — headers only allow printable ASCII**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
```
The HMAC signature is 32 random bytes — full binary. Without Base64url, the signature definitely contains bytes that would break the header.

**2. JWTs also travel in URLs and cookies — both need URL-safe characters**
- URLs: `?token=eyJhbGc...` (email verification, magic links, OAuth)
- Cookies: `Set-Cookie: session=eyJhbGc...`
- Standard Base64 uses `+` and `/` which break URLs → Base64url swaps to `-` and `_`

**3. The signature is raw binary — it MUST be encoded to be a string**
The 32-byte HMAC output isn't a string at all. Base64url turns it into 43 safe text characters.

**4. JWTs need a clean `.` separator for parsing**
`<header>.<payload>.<signature>` — Base64url alphabet doesn't include `.`, so splitting always works.

**5. Cross-platform consistency — same bytes on every system**
Raw bytes have encoding ambiguity (UTF-8 vs Latin-1), line-ending issues (`\n` vs `\r\n`), etc. Base64url uses only universal ASCII.

**6. Compact and copy-pasteable**
No whitespace, quotes, or special characters. Works in logs, configs, QR codes, env files.

---

# Part 3: Deep Dive — Why HTTP & URL Restrictions Exist

## Question 1: Why do HTTP headers only allow printable ASCII?

The "headers only allow printable ASCII" rule isn't arbitrary — it's there for several concrete reasons rooted in how HTTP actually works on the wire.

### 1. Header parsing depends on specific control characters

HTTP headers use special bytes as structural delimiters:

- `\r\n` (CRLF) marks the end of a header line
- `\r\n\r\n` marks the end of the entire header block
- `:` separates header name from value
- `,` separates multi-value headers

If you allowed arbitrary bytes in header values, the parser couldn't tell where one header ends and another begins. A raw `\n` byte inside your JWT signature would make the server think your header ended early.

### 2. CRLF injection attacks (the big security reason)

This is the killer reason. If an attacker can sneak `\r\n` into a header value, they can inject entirely new headers or even a fake response body. This is called **HTTP Response Splitting** or **Header Injection**.

Example attack — imagine a signature byte sequence happened to be `\r\n`:

```
Authorization: Bearer abc\r\n
Set-Cookie: session=attacker_value\r\n
X-Evil:
```

The server/proxy now sees two headers. The attacker just set a cookie. Restricting to printable ASCII makes this structurally impossible.

### 3. Null bytes truncate strings in C-based servers

Most HTTP servers (nginx, Apache, older Node bindings) are written in C or wrap C libraries. C strings end at the first `\0` byte. A null byte in your header value would silently chop the rest of the value off — and worse, different layers of your stack might disagree about where the value ends, leading to **request smuggling** attacks.

### 4. Proxies, load balancers, and middleboxes assume ASCII

Your request passes through CDNs, reverse proxies, WAFs, and gateways. Many of these were built decades ago and assume header values are printable ASCII. Non-ASCII bytes can:

- Get silently stripped
- Cause the proxy to reject the request
- Be re-encoded inconsistently between hops
- Trigger different parsing in proxy vs. origin (→ request smuggling again)

### 5. Logging and observability break

Headers end up in access logs, APM tools, error reports, and terminals. Binary bytes corrupt log files, break `grep`, mess up JSON-encoded log lines, and can even inject ANSI escape codes into terminals (which has been used for real attacks — like making `tail -f` execute commands).

### 6. RFC 7230 explicitly says so

The HTTP spec (**RFC 7230 §3.2.6**) defines header field values as `VCHAR` (visible ASCII, `0x21–0x7E`) plus spaces and tabs. Anything else is "obsolete" and servers are allowed to reject it. Following the spec means your token works with **every** HTTP implementation, not just lenient ones.

### Summary for the JWT context

A raw HMAC-SHA256 signature is 32 bytes of uniform random data. Statistically, ~88% of those bytes fall outside printable ASCII. Almost every signature would contain a `\n`, `\0`, or high-bit byte that breaks one of the rules above.

Base64url encoding expands 32 bytes → 43 characters of `[A-Z a-z 0-9 - _]`, all safely in the printable ASCII range, no `+`, `/`, or `=` (which have their own issues in URLs and headers).

That's why **Base64url isn't optional for JWTs** — it's what makes the token transportable through the messy reality of HTTP infrastructure.

---

## Question 2: Why don't URLs allow all characters?

The reason URLs can't allow all characters comes down to **URLs have structure, and certain characters define that structure**.

### 1. Reserved characters define URL anatomy

A URL isn't just a string — it's a structured format where specific characters act as delimiters. Look at this URL:

```
https://user:pass@app.com:8080/path/to/page?token=abc&user=hira#section
```

Each special character has a job:

| Character | Role |
|---|---|
| `:` | Separates scheme, port, user:pass |
| `//` | Marks start of authority (host) |
| `@` | Separates userinfo from host |
| `/` | Path separator |
| `?` | Starts query string |
| `&` | Separates query parameters |
| `=` | Separates key from value |
| `#` | Starts fragment (client-side only) |
| `;` | Path parameter separator (legacy) |

If your JWT contained a raw `?`, the parser would think the query string started in the middle of your token. If it contained `&`, it would split into two fake query parameters. The structure would collapse.

### 2. The `+` → space problem (historical baggage)

This one is weird but important. In `application/x-www-form-urlencoded` (the format used in query strings and HTML form submissions), `+` was defined to mean a **literal space character**. This dates back to early HTML forms in the 1990s.

So when a server sees:

```
?token=eyJ+abc
```

It decodes the `+` as a space:

```
token = "eyJ abc"
```

Your JWT is now corrupted. That's why **Base64url replaces `+` with `-`** — the `-` has no special meaning anywhere in URLs.

### 3. `/` is the path separator

Standard Base64 uses `/`. But in a URL:

```
https://app.com/verify?token=eyJ/hbGc/iOiJ
```

Depending on where the token is placed, parsers might get confused — and if the token is in the path itself (like `/verify/eyJ/hbGc/...`), the `/` characters create fake path segments. **Base64url swaps `/` for `_`**, which has no structural meaning.

### 4. Unsafe characters break across systems

Beyond reserved characters, **RFC 3986** defines "unsafe" characters that cause problems for different reasons:

- **Space** — terminates URLs in many contexts (browsers, terminals, email clients)
- **`<` `>`** — used for HTML tags, would break embedded URLs in HTML
- **`"`** — used to wrap URLs in HTML attributes (`href="..."`)
- **`{` `}` `|` `\` `^` `~` `` ` ``** — historically mangled by gateways and email systems
- **`%`** — reserved because it starts percent-encoding (`%20` for space)
- **`#`** — fragment identifier, never sent to server, would silently truncate your token

### 5. Non-ASCII bytes have encoding ambiguity

URLs are transmitted as ASCII. If you put `café.com/token=ñ` in a URL, what bytes go on the wire?

- UTF-8 encoding? `c3 a9`
- Latin-1 encoding? `e9`
- Something else?

Different browsers, servers, and proxies historically disagreed. The safest answer: **only allow ASCII**, and percent-encode everything else (`%C3%A9`). This is why **IDN** (internationalized domain names) uses **Punycode** — `café.com` becomes `xn--caf-dma.com` on the wire.

### 6. Percent-encoding exists, but it's expensive and error-prone

You could keep using `+` and `/` and just percent-encode them:

```
?token=eyJ%2BhbGc%2FiOiJ
```

But this has problems:

- **Triples the size** of those characters (1 byte → 3 bytes)
- **Double-encoding bugs** — if any layer encodes twice, `%2B` becomes `%252B`, and the token breaks
- **Different layers decode at different times** — your CDN, framework, and app might each decode once, or not at all
- **Cookies have their own escaping rules** that differ from URLs

**Base64url sidesteps all of this** by producing tokens that need zero escaping anywhere they go.

### 7. The `=` padding problem

Standard Base64 pads output to a multiple of 4 with `=`:

```
eyJhbGciOiJIUzI1NiJ9==
```

But `=` is the **query parameter separator**! A URL like:

```
?token=eyJhbGc==&user=hira
```

Some parsers see `token = eyJhbGc`, then `=` (empty key), then `&user=hira`. Total mess.

**Base64url drops padding entirely** — you can recompute it from the length (`length % 4`), so it's not needed for decoding.

### The deeper "why"

URLs were designed in **1994 (RFC 1738)** to be universally transportable — typeable on a keyboard, printable in books, speakable over the phone, embeddable in plain-text emails, parseable by simple state machines written in any language. That meant restricting to a small, unambiguous character set:

**Unreserved characters (always safe):** `A-Z a-z 0-9 - . _ ~`

Notice Base64url uses exactly: `A-Z a-z 0-9 - _` — a strict subset of unreserved characters. That's not a coincidence. The JWT designers picked Base64url specifically because it's bulletproof across every URL context.

---

## The takeaway for your code

Those three lines in [app.js:8-10](app.js#L8-L10) are doing critical work:

```js
.replace(/=/g, '')   // Remove padding (breaks query strings)
.replace(/\+/g, '-') // + means space in form-encoding
.replace(/\//g, '_'); // / is the path separator
```

They transform a Base64 string from "works in some contexts" to **"works everywhere a URL or HTTP value can live"** — headers, query params, path segments, cookies, even SMS links and QR codes.

That's why every JWT library on earth does this same transformation.

---

## Quick reference card

### HTTP header rules
- Printable ASCII only (`0x21–0x7E` + space + tab)
- No `\r`, `\n`, `\0`
- Defined by RFC 7230 §3.2.6
- Violations risk: header injection, request smuggling, log corruption

### URL safe characters
- Unreserved: `A-Z a-z 0-9 - . _ ~`
- Everything else has a meaning OR must be percent-encoded
- Defined by RFC 3986

### Base64url alphabet
- `A-Z a-z 0-9 - _`
- No padding (`=` dropped)
- 64 characters, fits exactly in 6 bits
- Subset of unreserved URL characters → safe everywhere
